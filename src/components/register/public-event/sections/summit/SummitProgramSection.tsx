"use client";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";

import { SectionShell } from "../shared/SectionShell";
import type { PublicEventSiteSummary } from "../../siteSummary";
import type { SummitSectionVariant } from "./summitSectionUtils";

type Props = {
  variant: SummitSectionVariant;
  theme?: PublicEventThemeClasses;
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  agendaRows: PublicEventExperiencePayload["agenda"];
  programDay: number;
  onProgramDayChange: (day: number) => void;
};

export function SummitProgramSection({
  variant,
  theme,
  summary,
  experience,
  agendaRows,
  programDay,
  onProgramDayChange
}: Props) {
  const dark = variant === "summit-dark";
  const section = resolvePublicEventSectionHeader("program", experience, { variant: "summit" });
  const perDay = experience.programMode === "PER_DAY" && summary.programDays.length > 1;

  if (dark) {
    return (
      <section
        id={PUBLIC_EVENT_SECTION_IDS.program}
        className="mb-20 rounded-xl border border-white/10 bg-zinc-900/40 p-8 md:p-12 lg:mb-24"
      >
        <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">{section.title}</h2>
            {section.description ? (
              <p className="mt-3 text-sm text-zinc-400">{section.description}</p>
            ) : null}
          </div>
          {perDay ? (
            <div className="flex flex-wrap gap-1 rounded-full border border-white/10 bg-zinc-950/60 p-1">
              {summary.programDays.map((d) => (
                <button
                  key={d.dayIndex}
                  type="button"
                  onClick={() => onProgramDayChange(d.dayIndex)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition",
                    d.dayIndex === programDay
                      ? "bg-[color:var(--accent)] text-[color:var(--accent-fg)] shadow"
                      : "text-zinc-300 hover:text-zinc-100"
                  )}
                >
                  {d.label.replace(/\s*·.*$/, "")}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {agendaRows.length === 0 ? (
          <p className="text-center text-sm text-zinc-400">No agenda items for this day yet.</p>
        ) : (
          <div className="space-y-6">
            {agendaRows.map((row) => (
              <div
                key={row.id}
                className="group grid grid-cols-1 gap-6 rounded-xl border border-white/10 bg-zinc-900/60 p-6 transition-colors hover:border-[color:var(--accent)]/40 md:grid-cols-12"
              >
                <div className="flex flex-col justify-center md:col-span-2">
                  <span className="font-mono text-xl font-bold text-[color:var(--accent)]">{row.time}</span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Session</span>
                </div>
                <div className="space-y-2 md:col-span-9">
                  <h3 className="text-lg font-semibold text-zinc-50 transition-colors group-hover:text-[color:var(--accent)] md:text-xl">
                    {row.title}
                  </h3>
                  {row.detail ? <p className="text-sm leading-relaxed text-zinc-400">{row.detail}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  const programBody = (
    <>
      <div className="mb-12 text-center">
        <h2 className="font-register-display text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
          {section.title}
        </h2>
        {section.description ? (
          <p className="mx-auto mt-4 max-w-2xl text-sm text-on-surface-variant">{section.description}</p>
        ) : null}
      </div>
      {perDay ? (
        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {summary.programDays.map((d) => (
            <button
              key={d.dayIndex}
              type="button"
              onClick={() => onProgramDayChange(d.dayIndex)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold transition",
                d.dayIndex === programDay ? "bg-zinc-900 text-white shadow-md" : "bg-white text-zinc-700 ring-1 ring-zinc-200"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      ) : null}

      {agendaRows.length === 0 ? (
        <p className="text-center text-sm text-on-surface-variant">No agenda items for this day yet.</p>
      ) : (
        <div className="relative mx-auto max-w-5xl">
          <div className="space-y-12 md:space-y-16">
            {agendaRows.map((row, i) => {
              const leftAlign = i % 2 === 0;
              return (
                <div key={row.id} className="relative grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-8">
                  {leftAlign ? (
                    <div className="hidden justify-end pr-10 md:flex">
                      <span className="rounded-full bg-zinc-200 px-4 py-1.5 font-register-mono text-sm font-semibold text-zinc-800">
                        {row.time}
                      </span>
                    </div>
                  ) : (
                    <div className="order-2 md:order-1 md:pr-10">
                      <div className="rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-8 md:text-right">
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          Session
                        </span>
                        <h4 className="font-register-display text-xl font-semibold text-zinc-950">{row.title}</h4>
                        {row.detail ? (
                          <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{row.detail}</p>
                        ) : null}
                        <div className="mt-4 md:hidden">
                          <span className="font-register-mono text-sm font-bold text-accent">{row.time}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div
                    className="absolute left-1/2 top-1/2 z-10 hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-surface bg-accent md:block"
                    aria-hidden
                  />

                  {leftAlign ? (
                    <div className="md:pl-10">
                      <div className="rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-8">
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          Session
                        </span>
                        <h4 className="font-register-display text-xl font-semibold text-zinc-950">{row.title}</h4>
                        {row.detail ? (
                          <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{row.detail}</p>
                        ) : null}
                        <div className="mt-4 md:hidden">
                          <span className="font-register-mono text-sm font-bold text-accent">{row.time}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="order-1 flex justify-start pl-10 md:order-2 md:flex">
                      <span className="rounded-full bg-zinc-200 px-4 py-1.5 font-register-mono text-sm font-semibold text-zinc-800">
                        {row.time}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  if (!theme) {
    return (
      <section id={PUBLIC_EVENT_SECTION_IDS.program} className="scroll-mt-24">
        {programBody}
      </section>
    );
  }

  return (
    <SectionShell id={PUBLIC_EVENT_SECTION_IDS.program} theme={theme} variant="default">
      {programBody}
    </SectionShell>
  );
}
