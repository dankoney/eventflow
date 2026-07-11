"use client";

import { Calendar } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { SUMMIT_PUBLIC_REGISTRATION_NOTE } from "@/lib/public-event/summitPublicCopy";
import { cn } from "@/lib/utils";

import type { PublicEventSiteSummary } from "../../siteSummary";
import { PublicRegistrationNote } from "../shared/PublicRegistrationNote";
import { SectionShell } from "../shared/SectionShell";
import type { SummitSectionVariant } from "./summitSectionUtils";

type CalendarLinks = {
  google: string;
  outlook: string;
  icsHref: string;
  icsFilename: string;
  yahoo: string;
  outlook365: string;
};

type Props = {
  variant: SummitSectionVariant;
  theme: PublicEventThemeClasses;
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  aboutParas: string[];
  calendar: CalendarLinks;
  eventOver: boolean;
};

function CalendarBlock({
  summary,
  calendar,
  eventOver,
  dark,
  compact
}: {
  summary: PublicEventSiteSummary;
  calendar: CalendarLinks;
  eventOver: boolean;
  dark: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn(compact ? "p-5" : "p-6")}>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            dark
              ? "bg-[color:var(--accent)]/20 text-[color:var(--accent)]"
              : "bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
          )}
        >
          <Calendar className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className={cn("text-[10px] font-bold uppercase tracking-wider", dark ? "text-zinc-500" : "text-on-surface-variant")}>
            Save the date
          </p>
          <p className={cn("text-sm font-semibold leading-snug", dark ? "text-zinc-100" : "text-zinc-900")}>
            {summary.periodLabel}
          </p>
        </div>
      </div>
      <div className="mt-4">
        {eventOver ? (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-medium",
              dark ? "bg-zinc-950/60 text-zinc-400" : "bg-zinc-50 text-zinc-600"
            )}
          >
            This event has ended — calendar links are no longer available.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["Google", calendar.google],
                  ["Outlook", calendar.outlook],
                  ["Apple", calendar.icsHref]
                ] as const
              ).map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target={label !== "Apple" ? "_blank" : undefined}
                  rel={label !== "Apple" ? "noopener noreferrer" : undefined}
                  download={label === "Apple" ? calendar.icsFilename : undefined}
                  className={cn(
                    "rounded-lg py-2.5 text-center text-[10px] font-bold transition",
                    dark
                      ? "bg-[color:var(--accent)]/15 text-white hover:bg-[color:var(--accent)]/25"
                      : "bg-[color:var(--accent)]/10 text-[color:var(--accent)] hover:bg-[color:var(--accent)]/18"
                  )}
                >
                  {label}
                </a>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <a
                href={calendar.yahoo}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "rounded-lg px-2.5 py-2 text-[10px] font-bold transition",
                  dark
                    ? "bg-white/5 text-purple-200 hover:bg-white/10"
                    : "bg-[color:var(--accent)]/8 text-[color:var(--accent)] hover:bg-[color:var(--accent)]/14"
                )}
              >
                Yahoo
              </a>
              <a
                href={calendar.outlook365}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "rounded-lg px-2.5 py-2 text-[10px] font-bold transition",
                  dark
                    ? "bg-white/5 text-sky-200 hover:bg-white/10"
                    : "bg-[color:var(--accent)]/8 text-[color:var(--accent)] hover:bg-[color:var(--accent)]/14"
                )}
              >
                Microsoft 365
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SummitOverviewSection({
  variant,
  theme,
  summary,
  experience,
  aboutParas,
  calendar,
  eventOver
}: Props) {
  const dark = variant === "summit-dark";
  const overviewImage = experience.overviewImageUrl?.trim() || null;
  const noteVariant = dark ? "summit-dark" : "professional-light";
  const section = resolvePublicEventSectionHeader("overview", experience, {
    variant: dark ? "night-edition" : "summit"
  });

  const body = (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-3xl",
          dark ? "bg-zinc-900/50 ring-1 ring-white/10" : "bg-white shadow-sm ring-1 ring-zinc-200/70"
        )}
      >
        <div className="lg:grid lg:grid-cols-12">
          <div className="space-y-5 p-8 sm:p-10 lg:col-span-7 lg:p-12">
            <header>
              <h2
                className={cn(
                  "text-3xl font-bold tracking-tight sm:text-4xl",
                  dark ? "text-zinc-50" : theme.heading
                )}
              >
                {section.title}
              </h2>
              {section.description ? (
                <p className={cn("mt-3 text-base leading-relaxed", dark ? "text-zinc-400" : theme.muted)}>
                  {section.description}
                </p>
              ) : null}
            </header>

            <div
              className={cn(
                "space-y-4 text-base leading-relaxed",
                dark ? "text-zinc-300" : "text-on-surface-variant"
              )}
            >
              {aboutParas.length > 0 ? (
                aboutParas.map((p, i) => (
                  <p key={i} className="whitespace-pre-wrap">
                    {p}
                  </p>
                ))
              ) : (
                <p>
                  Add your event description in Eventflow settings. This overview introduces the program for
                  prospective attendees.
                </p>
              )}
            </div>
          </div>

          <div
            className={cn(
              "border-t lg:col-span-5 lg:border-l lg:border-t-0",
              dark ? "border-white/10 bg-zinc-950/30" : "border-zinc-100 bg-zinc-50/50"
            )}
          >
            {overviewImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={overviewImage} alt="" className="aspect-[5/4] w-full object-cover sm:aspect-[4/3]" />
                <div className={cn("border-t", dark ? "border-white/10" : "border-zinc-100")}>
                  <CalendarBlock summary={summary} calendar={calendar} eventOver={eventOver} dark={dark} compact />
                </div>
              </>
            ) : (
              <CalendarBlock summary={summary} calendar={calendar} eventOver={eventOver} dark={dark} />
            )}
          </div>
        </div>
      </div>

      <PublicRegistrationNote variant={noteVariant} className="mt-6">
        {SUMMIT_PUBLIC_REGISTRATION_NOTE}
      </PublicRegistrationNote>
    </>
  );

  if (dark) {
    return (
      <section id={PUBLIC_EVENT_SECTION_IDS.overview} className="scroll-mt-24">
        {body}
      </section>
    );
  }

  return (
    <SectionShell id={PUBLIC_EVENT_SECTION_IDS.overview} theme={theme} variant="default" className="!py-0">
      {body}
    </SectionShell>
  );
}
