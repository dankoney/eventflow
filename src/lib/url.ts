import { headers } from "next/headers";

/** Absolute site URL for links in emails and UI (server-only; uses NEXTAUTH_URL when set). */
export function getPublicSiteUrl() {
  const env = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (env) return env;

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}

/** Join hub URL for emails and tooling (uses NEXTAUTH_URL only; no request headers). */
export function getJoinPageAbsoluteUrl(guestId: string): string | null {
  const base = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/join/${guestId}`;
}
