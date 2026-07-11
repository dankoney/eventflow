"use client";

import { Bookmark, ChevronDown, UtensilsCrossed } from "lucide-react";
import { useMemo } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { SectionHeader } from "../../../sections/shared/SectionHeader";
import { SectionShell } from "../../../sections/shared/SectionShell";
import type { PublicEventSiteSummary } from "../../../siteSummary";

import { AgendaSpeakerStack } from "./AgendaSpeakerStack";
import {
  agendaDetailBody,
  isAgendaBreakRow,
  parseAgendaTime,
  resolveAgendaSpeakers,
  resolveAgendaTags,
  resolveVenueLabel
} from "./nightEditionAgendaUtils";

type Props = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  programDay: number;
  onProgramDayChange: (day: number) => void;
};

function tagClass(tone: "primary" | "secondary" | "tertiary" | "neutral"): string {
  switch (tone) {
    case "tertiary":
      return "border-[color:var(--pe-tertiary)]/20 bg-[color:var(--pe-tertiary)]/10 text-[color:var(--pe-tertiary)]";
    case "secondary":
      return "border-[color:var(--pe-secondary)]/20 bg-[color:var(--pe-secondary)]/10 text-[color:var(--pe-secondary)]";
    case "primary":
      return "border-[color:var(--pe-primary)]/20 bg-[color:var(--pe-primary)]/10 text-[color:var(--pe-primary)]";
    default:
      return "border-white/5 bg-[var(--pe-surface-container)] text-[var(--pe-on-surface-variant)]";
  }
}

function venueBadgeClass(tone: "primary" | "secondary"): string {
  return tone === "secondary"
    ? "border-[color:var(--pe-secondary)]/20 text-[color:var(--pe-secondary)]"
    : "border-[color:var(--pe-primary)]/20 text-[color:var(--pe-primary)]";
}

/** `#program` — glass-card agenda (UNCITRAL-style) */
export function NightEditionProgramSection({
  summary,
  experience,
  theme,
  programDay,
  onProgramDayChange
}: Props) {
  const section = resolvePublicEventSectionHeader("program", experience, { variant: "night-edition" });

  const rows = useMemo(() => {
    if (experience.programMode === "PER_DAY") {
      return experience.agendaByDay.find((d) => d.dayIndex === programDay)?.items ?? [];
    }
    return experience.agenda;
  }, [experience, programDay]);

  const multiDay = experience.programMode === "PER_DAY" && summary.programDays.length > 1;
  const intro =
    section.description ??
    summary.description?.trim().split(/\n/)[0]?.slice(0, 280) ??
    undefined;

  return (
    <SectionShell id={PUBLIC_EVENT_SECTION_IDS.program} theme={theme} variant="alt" className="relative">
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          aria-hidden
        >
          <div className="absolute left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-[color:var(--pe-primary)]/5 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] h-[50%] w-[50%] rounded-full bg-[color:var(--pe-secondary)]/5 blur-[120px]" />
        </div>

      <SectionHeader
        theme={theme}
        variant="night-edition"
        badge={section.badge}
        title={section.title}
        description={intro}
      />

      <div className="-mt-6 mb-12 flex flex-wrap justify-center gap-3 md:mb-16">
        {multiDay ? (
          summary.programDays.map((d) => {
            const active = d.dayIndex === programDay;
            return (
              <button
                key={d.dayIndex}
                type="button"
                onClick={() => onProgramDayChange(d.dayIndex)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "border-[color:var(--pe-primary)]/30 bg-[color:var(--pe-primary)]/20 text-[color:var(--pe-primary)]"
                    : "border-white/5 bg-[var(--pe-surface-container)] text-[var(--pe-on-surface-variant)] hover:bg-[var(--pe-surface-container-high)] hover:text-[var(--pe-on-surface)]"
                )}
              >
                <span>{d.label.replace(/\s*·.*$/, "").trim() || `Day ${d.dayIndex}`}</span>
                {active ? <ChevronDown className="h-[18px] w-[18px] opacity-80" aria-hidden /> : null}
              </button>
            );
          })
        ) : (
          <span className="flex items-center gap-2 rounded-full border border-[color:var(--pe-primary)]/30 bg-[color:var(--pe-primary)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--pe-primary)]">
            All sessions
            <ChevronDown className="h-[18px] w-[18px] opacity-80" aria-hidden />
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-[var(--pe-surface-container)]/40 px-6 py-12 text-center text-[var(--pe-on-surface-variant)]">
          No agenda items for this day yet. Add sessions in the public experience editor.
        </p>
      ) : (
          <div className="space-y-6 md:space-y-8">
            {rows.map((row, index) => {
              if (isAgendaBreakRow(row)) {
                const { clock, meridiem } = parseAgendaTime(row.time);
                const venue = resolveVenueLabel(row);
                return (
                  <div
                    key={row.id}
                    className="pe-agenda-break-row flex flex-col items-start justify-between gap-4 rounded-2xl p-6 sm:flex-row sm:items-center"
                  >
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
                      <span className="w-24 text-2xl font-bold text-[var(--pe-on-surface-variant)]">{clock}</span>
                      <div className="hidden h-12 w-px bg-white/10 sm:block" aria-hidden />
                      <div className="flex items-center gap-3 text-[var(--pe-on-surface-variant)]">
                        <UtensilsCrossed className="h-6 w-6 shrink-0" aria-hidden />
                        <span className="text-lg font-medium text-[var(--pe-on-surface-variant)]">{row.title}</span>
                      </div>
                    </div>
                    {venue ? (
                      <span className="hidden rounded-full bg-[var(--pe-surface-container)] px-3 py-1 text-xs text-[var(--pe-on-surface-variant)] md:inline-block">
                        {venue}
                      </span>
                    ) : null}
                    {meridiem ? <span className="sr-only">{meridiem}</span> : null}
                  </div>
                );
              }

              const { clock, meridiem } = parseAgendaTime(row.time);
              const venue = resolveVenueLabel(row);
              const body = agendaDetailBody(row.detail, venue);
              const tags = resolveAgendaTags(row);
              const sessionSpeakers = resolveAgendaSpeakers(row, experience.speakers);
              const accentSecondary = index % 2 === 1;
              const hoverAccent = accentSecondary ? "secondary" : "primary";

              return (
                <article
                  key={row.id}
                  className={cn(
                    "pe-agenda-glass-card group relative flex flex-col gap-6 overflow-hidden rounded-2xl p-6 transition-colors duration-300 md:flex-row md:gap-12 md:p-8",
                    accentSecondary ? "hover:border-[color:var(--pe-secondary)]/30" : "hover:border-[color:var(--pe-primary)]/30"
                  )}
                >
                  <div
                    className={cn(
                      "absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                      hoverAccent === "secondary"
                        ? "from-[color:var(--pe-secondary)] to-[color:var(--pe-primary)]"
                        : "from-[color:var(--pe-primary)] to-[color:var(--pe-secondary)]"
                    )}
                    aria-hidden
                  />

                  <div className="flex shrink-0 flex-row items-baseline gap-4 border-b border-white/5 pb-4 md:w-48 md:flex-col md:items-start md:gap-1 md:border-b-0 md:pb-0">
                    <span className="text-2xl font-bold text-[var(--pe-on-surface)] md:text-3xl">{clock}</span>
                    {meridiem ? (
                      <span className="text-sm font-semibold uppercase tracking-wider text-[var(--pe-on-surface-variant)]">
                        {meridiem}
                      </span>
                    ) : null}
                    {venue ? (
                      <span
                        className={cn(
                          "mt-0 hidden rounded-full border bg-[var(--pe-surface-container-high)] px-3 py-1 text-xs font-medium md:mt-4 md:inline-block",
                          venueBadgeClass(accentSecondary ? "secondary" : "primary")
                        )}
                      >
                        {venue}
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-grow pr-12 md:pr-14">
                    <div className="mb-4 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span
                          key={`${row.id}-${tag.label}`}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium",
                            tagClass(tag.tone)
                          )}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                    <h3
                      className={cn(
                        "mb-4 text-2xl font-bold leading-tight text-[var(--pe-on-surface)] transition-colors md:text-3xl",
                        accentSecondary
                          ? "group-hover:text-[color:var(--pe-secondary)]"
                          : "group-hover:text-[color:var(--pe-primary)]"
                      )}
                    >
                      {row.title}
                    </h3>
                    {body ? (
                      <p className="mb-2 max-w-3xl text-lg leading-relaxed text-[var(--pe-on-surface-variant)]">
                        {body}
                      </p>
                    ) : null}
                    {sessionSpeakers.length > 0 ? (
                      <AgendaSpeakerStack
                        speakers={sessionSpeakers}
                        accent={hoverAccent}
                        className="mt-6 md:hidden"
                      />
                    ) : null}
                  </div>

                  <div className="absolute right-6 top-6 flex flex-col items-end gap-4 md:right-8 md:top-8">
                    <button
                      type="button"
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border border-white/5 bg-[var(--pe-surface-container)] text-[var(--pe-on-surface-variant)] transition-all",
                        accentSecondary
                          ? "hover:border-[color:var(--pe-secondary)]/30 hover:text-[color:var(--pe-secondary)]"
                          : "hover:border-[color:var(--pe-primary)]/30 hover:text-[color:var(--pe-primary)]"
                      )}
                      aria-label={`Save session: ${row.title}`}
                    >
                      <Bookmark className="h-5 w-5" aria-hidden />
                    </button>
                    {sessionSpeakers.length > 0 ? (
                      <AgendaSpeakerStack
                        speakers={sessionSpeakers}
                        accent={hoverAccent}
                        className="hidden md:flex"
                      />
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
    </SectionShell>
  );
}
