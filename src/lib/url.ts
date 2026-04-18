import { headers } from "next/headers";

/**
 * Canonical public origin for absolute links in emails and redirects.
 * Prefer NEXTAUTH_URL; fall back to PUBLIC_APP_URL or APP_URL when the auth URL
 * is unset or points elsewhere, so per-guest `/join/...` links still resolve.
 */
export function resolvePublicAppBaseUrl(): string | null {
  for (const key of ["NEXTAUTH_URL", "PUBLIC_APP_URL", "APP_URL"] as const) {
    const raw = process.env[key]?.trim().replace(/\/$/, "");
    if (raw) return raw;
  }
  return null;
}

/**
 * Absolute origin for per-guest links in emails: env first, then the incoming request Host
 * (so server actions from the dashboard still work when env is misconfigured in dev).
 */
export function resolvePublicBaseForLinks(): string | null {
  const fromEnv = resolvePublicAppBaseUrl();
  if (fromEnv) return fromEnv;
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  } catch {
    /* headers() unavailable outside a request */
  }
  return null;
}

/** Request-aware absolute site URL (env base from resolvePublicAppBaseUrl, else Host header). */
export function getPublicSiteUrl() {
  const env = resolvePublicAppBaseUrl();
  if (env) return env;

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}

/** Join hub URL for emails and tooling. */
export function getJoinPageAbsoluteUrl(guestId: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/join/${guestId}`;
}

/**
 * Per-guest gateway URL: records join in Eventflow then redirects to this guest’s Zoom URL
 * (webinar personal link or meeting shared link). Use this in emails — never the raw Zoom URL.
 */
export function getOpenZoomJoinAbsoluteUrl(guestId: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/join/${guestId}/open-zoom`;
}

/**
 * @deprecated Use {@link getOpenZoomJoinAbsoluteUrl} — same URL (`…/open-zoom`).
 * Kept so older bookmarks to `/zoom` still hit the redirect route.
 */
export function getTrackedZoomJoinAbsoluteUrl(guestId: string): string | null {
  return getOpenZoomJoinAbsoluteUrl(guestId);
}
