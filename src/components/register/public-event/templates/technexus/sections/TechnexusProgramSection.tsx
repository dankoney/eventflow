"use client";

import { useMemo, useState } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import type { PublicEventSiteSummary } from "../../../siteSummary";

import { TechnexusSectionTitle } from "./TechnexusSectionTitle";

type Props = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  sectionBandClass: string;
};

export function TechnexusProgramSection({ summary, experience, sectionBandClass }: Props) {
  const section = resolvePublicEventSectionHeader("program", experience, { variant: "technexus" });
  const perDay = experience.programMode === "PER_DAY" && summary.programDays.length > 1;
  const [day, setDay] = useState(summary.programDays[0]?.dayIndex ?? 1);

  const rows = useMemo(() => {
    if (perDay) {
      return experience.agendaByDay.find((d) => d.dayIndex === day)?.items ?? [];
    }
    return experience.agenda;
  }, [experience, perDay, day]);

  if (rows.length === 0 && !perDay) return null;

  const dayTabs = perDay
    ? summary.programDays.map((d) => ({
        index: d.dayIndex,
        label: d.label.replace(/\s*·.*$/, "") || `Day ${d.dayIndex}`
      }))
    : [{ index: 1, label: section.title ?? "Program" }];

  return (
    <section id={PUBLIC_EVENT_SECTION_IDS.program} className={cn("tn-section scroll-mt-24", sectionBandClass)}>
      <div className="tn-section-inner">
        <div className={section.title || section.description ? "mb-10 text-center" : "mb-0"}>
          <TechnexusSectionTitle title={section.title} centered />
          {section.description ? (
            <p className="mx-auto max-w-2xl text-lg text-[var(--pe-on-surface-variant)]">{section.description}</p>
          ) : null}
        </div>

        {perDay ? (
          <div className="mx-auto mb-10 flex max-w-4xl flex-wrap justify-center gap-2 border-b border-[var(--pe-nav-border)] pb-4">
            {dayTabs.map((tab) => (
              <button
                key={tab.index}
                type="button"
                onClick={() => setDay(tab.index)}
                className={cn(
                  "rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-all",
                  day === tab.index
                    ? "bg-[var(--pe-primary)] text-[var(--pe-on-primary)]"
                    : "border border-transparent text-[var(--pe-on-surface)] hover:border-[var(--pe-primary)]/30 hover:bg-[var(--pe-primary)]/10"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="tn-glass-card mx-auto max-w-4xl rounded-xl p-6">
          {rows.length === 0 ? (
            <p className="text-center text-sm text-[var(--pe-on-surface-variant)]">No agenda items for this day yet.</p>
          ) : (
            <div className="space-y-6">
              {rows.map((row) => (
                <div key={row.id} className="flex flex-col gap-2 sm:flex-row sm:gap-8">
                  <div className="w-32 shrink-0 text-sm font-semibold uppercase tracking-wide text-[var(--pe-tertiary-container)]">
                    {row.time}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-[var(--pe-on-surface)]">{row.title}</h4>
                    {row.detail ? (
                      <p className="mt-1 text-sm text-[var(--pe-on-surface-variant)]">{row.detail}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
