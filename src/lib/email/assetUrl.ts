/**
 * Client-safe email asset URL resolution (no next/headers).
 * Used by email templates that may render in client preview components.
 */

function normalizeBaseUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().replace(/\/$/, "");
  return trimmed || null;
}

/** Public origin from env only — safe for client bundles and server email render. */
export function resolvePublicAppBaseUrlFromEnv(): string | null {
  const candidates = [
    process.env.NEXTAUTH_URL,
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL
  ];

  for (const raw of candidates) {
    const base = normalizeBaseUrl(raw);
    if (base) return base;
  }

  return null;
}

/**
 * Email clients need absolute image URLs. Uploaded assets are often stored as
 * `/uploads/...` paths that work in the browser but break in `<img src>`.
 */
export function resolveEmailAssetUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = resolvePublicAppBaseUrlFromEnv()?.replace(/\/$/, "");
  if (!base) return null;
  if (raw.startsWith("/")) return `${base}${raw}`;
  return `${base}/${raw}`;
}
