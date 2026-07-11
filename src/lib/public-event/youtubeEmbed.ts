/** Split a stored background-video field into individual URLs (newline or comma separated). */
export function parseBackgroundVideoUrls(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Persist-friendly normalization: one URL per line (YouTube → embed form). */
export function normalizeBackgroundVideoUrlField(raw: string | null | undefined): string | null {
  const lines = parseBackgroundVideoUrls(raw);
  if (!lines.length) return null;
  const normalized = lines.map((line) => toYoutubeEmbedUrl(line) ?? line);
  return normalized.join("\n");
}

/** Extract the 11-char YouTube id from a watch or embed URL. */
export function extractYoutubeVideoId(raw: string | null | undefined): string | null {
  const embed = toYoutubeEmbedUrl(raw);
  if (!embed) return null;
  const id = embed.split("/embed/")[1]?.split(/[?#]/)[0];
  return id?.length ? id : null;
}

export function extractYoutubeVideoIds(raw: string | null | undefined): string[] {
  return parseBackgroundVideoUrls(raw)
    .map((line) => extractYoutubeVideoId(line))
    .filter((id): id is string => Boolean(id));
}

/**
 * Normalizes YouTube watch/share URLs to an embeddable iframe src.
 * Returns null when the URL is not a recognized YouTube link.
 */
export function toYoutubeEmbedUrl(raw: string | null | undefined): string | null {
  const input = raw?.trim() ?? "";
  if (!input) return null;

  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname.startsWith("/embed/")) {
        return `https://www.youtube.com/embed/${url.pathname.split("/")[2] ?? ""}`;
      }
      const v = url.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const shorts = url.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts?.[1]) return `https://www.youtube.com/embed/${shorts[1]}`;
    }
  } catch {
    return null;
  }

  return null;
}

/** True when URL is a direct video file suitable for `<video src>`. */
export function isDirectVideoFileUrl(raw: string | null | undefined): boolean {
  const t = raw?.trim() ?? "";
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(t);
}
