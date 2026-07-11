import type { PublicEventAgendaItem, PublicEventExperiencePayload } from "@/lib/public-event/experience";

/** Parse agenda time strings from the CMS (e.g. "09:00", "9:00 AM", "14:30"). */
export function parseAgendaTime(raw: string): { clock: string; meridiem: string } {
  const t = raw.trim();
  const match = t.match(/^(\d{1,2}:\d{2})\s*(AM|PM|am|pm)?/);
  if (!match) return { clock: t.slice(0, 8), meridiem: "" };

  const clock = match[1];
  if (match[2]) {
    return { clock, meridiem: match[2].toUpperCase() };
  }

  const [h] = clock.split(":").map(Number);
  if (Number.isNaN(h)) return { clock, meridiem: "" };
  return { clock, meridiem: h >= 12 ? "PM" : "AM" };
}

export function isAgendaBreakItem(title: string): boolean {
  return /\b(lunch|breakfast|coffee break|networking|expo floor|reception|dinner|break)\b/i.test(title);
}

/** CMS `rowKind` takes precedence; legacy rows fall back to title heuristics. */
export function isAgendaBreakRow(row: PublicEventAgendaItem): boolean {
  if (row.rowKind === "break") return true;
  if (row.rowKind === "session") return false;
  return isAgendaBreakItem(row.title);
}

export type AgendaSessionTag = {
  label: string;
  tone: "primary" | "secondary" | "tertiary" | "neutral";
};

export function resolveAgendaTags(row: PublicEventAgendaItem): AgendaSessionTag[] {
  if (row.tags.length > 0) {
    return row.tags.map((t) => ({ label: t.label, tone: t.tone }));
  }
  return inferAgendaTags(row.title, row.detail);
}

export function resolveVenueLabel(row: PublicEventAgendaItem): string | null {
  if (row.venueLabel?.trim()) return row.venueLabel.trim();
  return inferVenueLabel(row.detail);
}

export function resolveAgendaSpeakers(
  row: PublicEventAgendaItem,
  speakers: PublicEventExperiencePayload["speakers"]
) {
  if (!row.speakerIds.length) return [];
  const byId = new Map(speakers.map((s) => [s.id, s]));
  return row.speakerIds.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
}

/** Lightweight tags inferred from title/detail when CMS has no track fields. */
export function inferAgendaTags(title: string, detail: string | null | undefined): AgendaSessionTag[] {
  const tags: AgendaSessionTag[] = [];
  const blob = `${title} ${detail ?? ""}`.toLowerCase();

  if (/keynote/i.test(blob)) tags.push({ label: "Keynote", tone: "tertiary" });
  else if (/panel/i.test(blob)) tags.push({ label: "Panel Discussion", tone: "secondary" });
  else if (/masterclass|workshop/i.test(blob)) tags.push({ label: "Masterclass", tone: "primary" });
  else tags.push({ label: "Session", tone: "neutral" });

  if (/digital|e-?commerce|trade law|dispute|smart contract|blockchain/i.test(blob)) {
    const topic = blob.includes("smart contract")
      ? "Smart Contracts"
      : blob.includes("dispute")
        ? "Dispute Resolution"
        : blob.includes("digital") || blob.includes("e-commerce")
          ? "Digital Trade"
          : "Trade Law";
    tags.push({ label: topic, tone: "neutral" });
  }

  return tags.slice(0, 3);
}

/** Optional room/venue hint from detail (e.g. "Main Stage" on its own line). */
export function inferVenueLabel(detail: string | null | undefined): string | null {
  if (!detail?.trim()) return null;
  const line = detail
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^main stage|lab |room |atrium|hall /i.test(l) || /^[A-Z][a-z]+ [0-9][A-Z]?$/i.test(l));
  return line ?? null;
}

/** Body copy without a leading venue line. */
export function agendaDetailBody(detail: string | null | undefined, venue: string | null): string | null {
  if (!detail?.trim()) return null;
  const lines = detail.split("\n").map((l) => l.trim()).filter(Boolean);
  if (venue && lines[0] === venue) {
    const rest = lines.slice(1).join(" ").trim();
    return rest || null;
  }
  return detail.trim();
}
