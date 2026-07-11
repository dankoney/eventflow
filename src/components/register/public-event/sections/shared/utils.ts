import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";

export function resourceHref(row: { fileUrl?: string | null; url?: string | null }) {
  const raw = (row.fileUrl ?? row.url ?? "").trim();
  if (!raw) return "#";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  return `/${raw}`;
}

export function contactWebsiteHref(raw: string | null | undefined): string {
  const t = raw?.trim() ?? "";
  if (!t) return "#";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/")) return t;
  return `https://${t}`;
}

export function descriptionParagraphs(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  const parts = text.trim().split(/\n\n+/);
  return parts.length ? parts : [text.trim()];
}

export function bioExcerpt(bio: string, max = 140): string {
  const t = bio.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export function speakerInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export type SpeakerRow = PublicEventExperiencePayload["speakers"][number];
