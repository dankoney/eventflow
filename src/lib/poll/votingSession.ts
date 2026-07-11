/**
 * Encrypted-at-rest by virtue of HMAC-SHA256 signing — the cookie value is opaque
 * to the client and tampering produces an unverifiable signature. We deliberately
 * avoid pulling a JWT library because (a) the dependency surface is small, (b) the
 * payload only ever moves between this server and itself, and (c) the existing
 * codebase has no other JWT signer (NextAuth handles its own internally).
 *
 * Cookie name is namespaced so it never collides with `next-auth.session-token`.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const POLL_VOTING_COOKIE_NAME = "eventflow_poll_session";
const POLL_VOTING_COOKIE_PATH = "/events";
const POLL_VOTING_DEFAULT_TTL_MS = 30 * 60 * 1000;
const POLL_VOTING_PAYLOAD_VERSION = 1 as const;

export type VotingSessionClaims = {
  /** Schema version — bump when the payload shape changes. */
  v: typeof POLL_VOTING_PAYLOAD_VERSION;
  /** Guest the voter has been authenticated as. */
  gid: string;
  /** Event the session is scoped to. */
  eid: string;
  /** Poll the session is scoped to. */
  pid: string;
  /**
   * PollVerification row id that was just consumed. The ballot submission in Phase 4
   * uses this to atomically mark the row `isUsed=true` and reject a replay.
   */
  vid: string;
  /** Issued-at, epoch seconds. */
  iat: number;
  /** Expiry, epoch seconds. */
  exp: number;
};

function resolveSecret(): Buffer {
  const raw =
    process.env.POLL_VOTING_SESSION_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;
  if (!raw || raw.trim().length < 16) {
    throw new Error(
      "POLL_VOTING_SESSION_SECRET (or AUTH_SECRET / NEXTAUTH_SECRET) must be set to a value of at least 16 characters before issuing a voting session."
    );
  }
  return Buffer.from(raw, "utf8");
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

function sign(payloadB64: string): string {
  return base64UrlEncode(createHmac("sha256", resolveSecret()).update(payloadB64).digest());
}

/**
 * Mint and write the voting-session cookie. Lifetime defaults to 30 minutes so a
 * verified voter has enough time to read the ballot, but a stolen cookie quickly
 * goes cold.
 */
export function issueVotingSession(input: {
  guestId: string;
  eventId: string;
  pollId: string;
  verificationId: string;
  ttlMs?: number;
}): { expiresAt: Date; cookieValue: string } {
  const now = Date.now();
  const ttl = input.ttlMs ?? POLL_VOTING_DEFAULT_TTL_MS;
  const claims: VotingSessionClaims = {
    v: POLL_VOTING_PAYLOAD_VERSION,
    gid: input.guestId,
    eid: input.eventId,
    pid: input.pollId,
    vid: input.verificationId,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + ttl) / 1000)
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(claims));
  const signatureB64 = sign(payloadB64);
  const cookieValue = `${payloadB64}.${signatureB64}`;

  cookies().set(POLL_VOTING_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    /**
     * Scope strictly to the voting feature. The ballot submission is a server action
     * called from `/events/[eventId]/poll`, so this path is sufficient. We avoid
     * setting it on `/` to prevent the cookie from being attached to unrelated
     * traffic across the site.
     */
    path: POLL_VOTING_COOKIE_PATH,
    expires: new Date(now + ttl),
    maxAge: Math.floor(ttl / 1000)
  });

  return { expiresAt: new Date(now + ttl), cookieValue };
}

/**
 * Read + verify the voting cookie. Returns the claims on success, `null` when the
 * cookie is absent, tampered, expired, or has the wrong payload version.
 */
export function readVotingSession(): VotingSessionClaims | null {
  const raw = cookies().get(POLL_VOTING_COOKIE_NAME)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signatureB64] = parts as [string, string];
  let expectedSig: string;
  try {
    expectedSig = sign(payloadB64);
  } catch {
    return null;
  }
  const givenBuf = base64UrlDecode(signatureB64);
  const expectedBuf = base64UrlDecode(expectedSig);
  if (givenBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(givenBuf, expectedBuf)) return null;

  let claims: VotingSessionClaims;
  try {
    claims = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as VotingSessionClaims;
  } catch {
    return null;
  }
  if (claims.v !== POLL_VOTING_PAYLOAD_VERSION) return null;
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) return null;
  if (!claims.gid || !claims.eid || !claims.pid || !claims.vid) return null;
  return claims;
}

/** Wipe the voting cookie (called after submission or on logout). */
export function clearVotingSession(): void {
  cookies().set(POLL_VOTING_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: POLL_VOTING_COOKIE_PATH,
    expires: new Date(0),
    maxAge: 0
  });
}
