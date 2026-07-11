import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Short-lived cookie shown only after a successful ballot so the voter still sees
 * confirmation after the voting session cookie is cleared (avoids RSC remount → gate).
 * Same signing material as {@link ./votingSession.ts}.
 */
export const POLL_THANKS_COOKIE_NAME = "eventflow_poll_thanks";
const POLL_THANKS_COOKIE_PATH = "/events";
const POLL_THANKS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PAYLOAD_VERSION = 1 as const;

export type PollThanksClaims = {
  v: typeof PAYLOAD_VERSION;
  gid: string;
  eid: string;
  pid: string;
  /** Same opaque id emailed to the voter. */
  ref: string;
  iat: number;
  exp: number;
};

function resolveSecret(): Buffer {
  const raw =
    process.env.POLL_VOTING_SESSION_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;
  if (!raw || raw.trim().length < 16) {
    throw new Error(
      "POLL_VOTING_SESSION_SECRET (or AUTH_SECRET / NEXTAUTH_SECRET) must be set before issuing poll cookies."
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

export function issuePollThanksCookie(input: {
  guestId: string;
  eventId: string;
  pollId: string;
  receiptRef: string;
}): void {
  const now = Date.now();
  const claims: PollThanksClaims = {
    v: PAYLOAD_VERSION,
    gid: input.guestId,
    eid: input.eventId,
    pid: input.pollId,
    ref: input.receiptRef,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + POLL_THANKS_TTL_MS) / 1000)
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(claims));
  const signatureB64 = sign(payloadB64);
  const cookieValue = `${payloadB64}.${signatureB64}`;

  cookies().set(POLL_THANKS_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: POLL_THANKS_COOKIE_PATH,
    expires: new Date(now + POLL_THANKS_TTL_MS),
    maxAge: Math.floor(POLL_THANKS_TTL_MS / 1000)
  });
}

export function readPollThanksCookie(): PollThanksClaims | null {
  const raw = cookies().get(POLL_THANKS_COOKIE_NAME)?.value;
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

  let claims: PollThanksClaims;
  try {
    claims = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as PollThanksClaims;
  } catch {
    return null;
  }
  if (claims.v !== PAYLOAD_VERSION) return null;
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) return null;
  if (!claims.gid || !claims.eid || !claims.pid || !claims.ref) return null;
  return claims;
}
