import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";

/** Plain-text “soft copy” of the published agenda for download. */
export function buildAgendaSoftCopyText(eventName: string, experience: PublicEventExperiencePayload): string {
  const lines: string[] = [`Agenda — ${eventName}`, "", `Generated ${new Date().toISOString().slice(0, 10)}`, ""];

  if (experience.programMode === "PER_DAY") {
    for (const d of experience.agendaByDay) {
      if (!d.items.length) continue;
      lines.push(`--- Day ${d.dayIndex} ---`, "");
      for (const i of d.items) {
        lines.push(`${i.time}  ${i.title}`);
        if (i.detail?.trim()) lines.push(`  ${i.detail.trim()}`);
        lines.push("");
      }
    }
  } else {
    for (const i of experience.agenda) {
      lines.push(`${i.time}  ${i.title}`);
      if (i.detail?.trim()) lines.push(`  ${i.detail.trim()}`);
      lines.push("");
    }
  }

  if (lines.length <= 4) {
    return `${lines[0]}\n\nNo agenda items have been published yet.`;
  }
  return lines.join("\n").trim();
}
