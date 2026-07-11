import {
  extractYoutubeVideoId,
  isDirectVideoFileUrl,
  parseBackgroundVideoUrls
} from "@/lib/public-event/youtubeEmbed";

export type SpotlightPlaylistItem =
  | { type: "youtube"; id: string; raw: string }
  | { type: "direct"; url: string };

/** Ordered spotlight playlist — one entry per line in `backgroundVideoUrl`. */
export function parseSpotlightPlaylist(raw: string | null | undefined): SpotlightPlaylistItem[] {
  const items: SpotlightPlaylistItem[] = [];
  for (const line of parseBackgroundVideoUrls(raw)) {
    const ytId = extractYoutubeVideoId(line);
    if (ytId) {
      items.push({ type: "youtube", id: ytId, raw: line });
      continue;
    }
    if (isDirectVideoFileUrl(line)) {
      items.push({ type: "direct", url: line });
    }
  }
  return items;
}

export function splitSpotlightVideoLines(raw: string | null | undefined): {
  youtubeLines: string[];
  directLines: string[];
} {
  const youtubeLines: string[] = [];
  const directLines: string[] = [];
  for (const line of parseBackgroundVideoUrls(raw)) {
    if (extractYoutubeVideoId(line)) youtubeLines.push(line);
    else if (isDirectVideoFileUrl(line)) directLines.push(line);
  }
  return { youtubeLines, directLines };
}

/** Merge YouTube + native lines preserving explicit play order from the ordered textarea. */
export function mergeSpotlightVideoLines(orderedLines: string[]): string {
  const clean = orderedLines.map((l) => l.trim()).filter(Boolean);
  return clean.length ? clean.join("\n") : "";
}

export function appendSpotlightVideoLine(raw: string | null | undefined, url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return raw?.trim() ?? "";
  const existing = parseBackgroundVideoUrls(raw);
  if (existing.includes(trimmed)) return existing.join("\n");
  return [...existing, trimmed].join("\n");
}

export function removeSpotlightVideoLine(raw: string | null | undefined, url: string): string {
  const trimmed = url.trim();
  return parseBackgroundVideoUrls(raw)
    .filter((line) => line !== trimmed)
    .join("\n");
}

export function moveSpotlightVideoLine(
  raw: string | null | undefined,
  index: number,
  direction: -1 | 1
): string {
  const lines = parseBackgroundVideoUrls(raw);
  const target = index + direction;
  if (index < 0 || index >= lines.length || target < 0 || target >= lines.length) {
    return lines.join("\n");
  }
  const next = [...lines];
  [next[index], next[target]] = [next[target], next[index]];
  return next.join("\n");
}

export function removeSpotlightVideoLineAt(raw: string | null | undefined, index: number): string {
  const lines = parseBackgroundVideoUrls(raw);
  if (index < 0 || index >= lines.length) return lines.join("\n");
  lines.splice(index, 1);
  return lines.join("\n");
}

/** YouTube lines from the playlist, in play order (for the YouTube textarea). */
export function youtubeLinesFromPlaylist(raw: string | null | undefined): string {
  return parseBackgroundVideoUrls(raw)
    .filter((line) => extractYoutubeVideoId(line))
    .join("\n");
}

/** Replace YouTube slots in playlist order; append extra YouTube lines at the end. */
export function syncYoutubeLinesInPlaylist(raw: string | null | undefined, youtubeText: string): string {
  const queue = parseBackgroundVideoUrls(youtubeText).filter((line) => extractYoutubeVideoId(line));
  const lines = parseBackgroundVideoUrls(raw);
  const result: string[] = [];
  for (const line of lines) {
    if (extractYoutubeVideoId(line)) {
      if (queue.length) result.push(queue.shift()!);
    } else {
      result.push(line);
    }
  }
  result.push(...queue);
  return result.join("\n");
}

export function lastDirectVideoFromPlaylist(raw: string | null | undefined): string {
  const direct = parseBackgroundVideoUrls(raw).filter((line) => isDirectVideoFileUrl(line));
  return direct[direct.length - 1] ?? "";
}

export function describeSpotlightLine(line: string): { kind: "youtube" | "direct" | "unknown"; label: string } {
  if (extractYoutubeVideoId(line)) return { kind: "youtube", label: "YouTube" };
  if (isDirectVideoFileUrl(line)) return { kind: "direct", label: "Self-hosted video" };
  return { kind: "unknown", label: "URL" };
}
