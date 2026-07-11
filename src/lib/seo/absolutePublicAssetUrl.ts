/**
 * Turn a stored banner/logo path or absolute URL into a canonical https URL for crawlers (WhatsApp, etc.).
 */
export function absolutePublicAssetUrl(siteBase: string, href: string | null | undefined): string | null {
  if (!href?.trim()) return null;
  const t = href.trim();
  const base = siteBase.replace(/\/$/, "");
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/")) return `${base}${t}`;
  return null;
}
