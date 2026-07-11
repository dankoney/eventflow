import { headers } from "next/headers";

import { resolveEmailAssetUrl } from "@/lib/email/assetUrl";

function normalizeBaseUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().replace(/\/$/, "");
  return trimmed || null;
}

function isLoopbackBase(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

function resolveHostAndProto(
  getHeader: (name: string) => string | null,
  fallbackProto?: string
): string | null {
  const rawHost = getHeader("x-forwarded-host") ?? getHeader("host");
  const host = rawHost?.split(",")[0]?.trim();
  if (!host) return null;
  const proto =
    getHeader("x-forwarded-proto")?.split(",")[0]?.trim() ?? fallbackProto ?? "https";
  return `${proto}://${host}`.replace(/\/$/, "");
}

function resolveRequestBaseUrl(): string | null {
  try {
    const h = headers();
    return resolveHostAndProto((name) => h.get(name));
  } catch {
    /* headers() unavailable outside a request */
  }
  return null;
}

/** Public origin from an incoming Request (route handlers / API routes). */
export function resolvePublicBaseFromRequest(request: Request): string | null {
  try {
    const fallbackProto = new URL(request.url).protocol.replace(":", "") || "https";
    return resolveHostAndProto((name) => request.headers.get(name), fallbackProto);
  } catch {
    return resolveHostAndProto((name) => request.headers.get(name));
  }
}

/**
 * Canonical public origin for absolute links in emails and redirects.
 * Prefer NEXTAUTH_URL; fall back to PUBLIC_APP_URL or APP_URL when the auth URL
 * is unset or points elsewhere, so per-guest `/join/...` links still resolve.
 * Loopback env values (e.g. dev NEXTAUTH_URL) are skipped when a public URL exists.
 */
export function resolvePublicAppBaseUrl(): string | null {
  const candidates = [
    process.env.NEXTAUTH_URL,
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL
  ];

  for (const raw of candidates) {
    const base = normalizeBaseUrl(raw);
    if (base && !isLoopbackBase(base)) return base;
  }

  for (const raw of candidates) {
    const base = normalizeBaseUrl(raw);
    if (base) return base;
  }

  return null;
}

/**
 * Absolute origin for per-guest links in emails: env first, then the incoming request Host
 * (so server actions from the dashboard still work when env is misconfigured in dev).
 */
export function resolvePublicBaseForLinks(request?: Request): string | null {
  const fromEnv = resolvePublicAppBaseUrl();
  const fromRequest = request
    ? resolvePublicBaseFromRequest(request)
    : resolveRequestBaseUrl();

  if (fromEnv && !isLoopbackBase(fromEnv)) return fromEnv;
  if (fromRequest && !isLoopbackBase(fromRequest)) return fromRequest;
  if (fromEnv) return fromEnv;
  if (fromRequest) return fromRequest;
  return null;
}

/** Request-aware absolute site URL (env base from resolvePublicAppBaseUrl, else Host header). */
export function getPublicSiteUrl() {
  return resolvePublicBaseForLinks() ?? "http://localhost:3000";
}

/** Org-wide public lobby: lists published / live events for flash entry. */
export function getOrgCommandCenterUrl(orgSlug: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/o/${encodeURIComponent(orgSlug)}`;
}

/** Onsite walk-in check-in booth (kiosk) — check in only, not pre-registration. */
export function getEventWalkInCheckInBoothUrl(orgSlug: string, eventId: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/o/${encodeURIComponent(orgSlug)}/${encodeURIComponent(eventId)}/checkin`;
}

/** Public self-registration / event landing page (`/register/[eventId]`). */
export function getEventRegistrationAbsoluteUrl(
  eventId: string,
  request?: Request
): string | null {
  const base = resolvePublicBaseForLinks(request);
  if (!base) return null;
  return `${base}/register/${encodeURIComponent(eventId)}`;
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

/** Personal internal-staff check-in page (token in path). */
export function getInternalStaffMagicCheckInUrl(eventId: string, token: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/register/${encodeURIComponent(eventId)}/i/${encodeURIComponent(token)}`;
}

/**
 * Smart-invitation magic-link URL. The same token is used for accept (RSVP) and decline,
 * routed via `/rsvp/[guestId]/[token]`. Decline page is a subroute.
 */
export function getRsvpAcceptAbsoluteUrl(guestId: string, token: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/rsvp/${encodeURIComponent(guestId)}/${encodeURIComponent(token)}`;
}

export function getRsvpDeclineAbsoluteUrl(guestId: string, token: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/rsvp/${encodeURIComponent(guestId)}/${encodeURIComponent(token)}/decline`;
}

/**
 * Public voting page (Phase 2/3 gate + ballot). Shared from the Event Wizard publish
 * section so guests can paste it into staff comms.
 */
export function getEventPollAbsoluteUrl(eventId: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/events/${encodeURIComponent(eventId)}/poll`;
}

/**
 * Public results page (Phase 4 — admin-published tally). Used in the "publish &
 * notify" broadcast and the share-on-WhatsApp affordance. Returns `null` when no
 * absolute public base is configured.
 */
/** Post-event emoji feedback page (magic link per guest). */
export function getEventFeedbackAbsoluteUrl(
  guestId: string,
  token: string,
  request?: Request
): string | null {
  const base = resolvePublicBaseForLinks(request);
  if (!base) return null;
  return `${base}/feedback/${encodeURIComponent(guestId)}/${encodeURIComponent(token)}`;
}

/** Compact feedback URL for SMS (`/f/[code]` redirects to the full magic link). */
export function getEventFeedbackSmsAbsoluteUrl(smsCode: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/f/${encodeURIComponent(smsCode)}`;
}

/** Compact guest pass URL for SMS (`/j/[code]` redirects to `/join/[guestId]`). */
export function getGuestJoinSmsAbsoluteUrl(joinSmsCode: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/j/${encodeURIComponent(joinSmsCode)}`;
}

/** Compact internal staff notice URL for SMS (`/s/[code]` redirects to check-in page). */
export function getStaffNoticeSmsAbsoluteUrl(staffNoticeSmsCode: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/s/${encodeURIComponent(staffNoticeSmsCode)}`;
}

/** Public feedback portal — guests enter email at `/fb/[code]` to open their form. */
export function getEventFeedbackPortalAbsoluteUrl(shortCode: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/fb/${encodeURIComponent(shortCode)}`;
}

/** One-click emoji rating from email (`?rating=VERY_SATISFIED`, etc.). */
export function getEventFeedbackRatingUrl(
  guestId: string,
  token: string,
  rating: string
): string | null {
  const page = getEventFeedbackAbsoluteUrl(guestId, token);
  if (!page) return null;
  return `${page}?rating=${encodeURIComponent(rating)}`;
}

export function getEventPollResultsAbsoluteUrl(eventId: string): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  return `${base}/events/${encodeURIComponent(eventId)}/poll/results`;
}

export type EmailLogoSources = {
  eventBrandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
};

/**
 * Picks the first resolvable absolute logo URL for transactional email headers.
 * Order: event brand → org logo → org default event brand (Settings).
 */
export function resolveEmailBrandLogoUrl(sources: EmailLogoSources): string | null {
  for (const candidate of [
    sources.eventBrandLogoUrl,
    sources.orgLogoUrl,
    sources.orgDefaultBrandLogoUrl
  ]) {
    const resolved = resolveEmailAssetUrl(candidate);
    if (resolved && /^https?:\/\//i.test(resolved)) return resolved;
  }
  return null;
}

export { resolveEmailAssetUrl } from "@/lib/email/assetUrl";
