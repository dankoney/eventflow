"use client";

import { Calendar, MapPin } from "lucide-react";

import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { buildPublicEventCalendarLinks } from "@/lib/public-event/calendarLinks";
import { cn } from "@/lib/utils";

import type { PublicEventSiteSummary } from "../siteSummary";
import { PublicEventCountdownWideGrid } from "./shared/PublicEventCountdownWideGrid";
import { SectionShell } from "./shared/SectionShell";

type PublicEventCountdownBandSectionProps = {
  summary: PublicEventSiteSummary;
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
  eventOver: boolean;
};

/**
 * Full-width countdown band — `#countdown`
 * Brand gradient card with Template 2–style large countdown grid.
 */
export function PublicEventCountdownBandSection({
  summary,
  theme,
  variant,
  eventOver
}: PublicEventCountdownBandSectionProps) {
  const isDarkSummit = variant === "summit-dark";
  const calendar = buildPublicEventCalendarLinks({
    name: summary.name,
    date: summary.date,
    endDate: summary.endDate,
    locationLine: summary.locationLine,
    description: summary.description
  });

  const mapsHref =
    summary.location.latitude != null && summary.location.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${summary.location.latitude},${summary.location.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(summary.location.address)}`;

  return (
    <SectionShell id={PUBLIC_EVENT_SECTION_IDS.countdown} theme={theme} variant="default" className="!py-16">
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] p-8 shadow-2xl md:p-16",
          isDarkSummit
            ? "border border-white/10 bg-[var(--pe-surface-container)] ring-1 ring-white/5"
            : "bg-[linear-gradient(135deg,var(--pe-gradient-from),var(--pe-gradient-to))]"
        )}
      >
        <div className="absolute left-0 top-1/2 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--pe-surface-container-lowest,#fff)] md:block" />
        <div className="absolute right-0 top-1/2 hidden h-12 w-12 translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--pe-surface-container-lowest,#fff)] md:block" />

        <div className="relative z-10 flex flex-col items-center justify-center gap-12 md:flex-row md:justify-between">
          <div className={cn("text-center md:text-left", isDarkSummit ? "text-zinc-100" : "text-white")}>
            <h3 className="text-2xl font-black uppercase tracking-tight md:text-4xl">{summary.name}</h3>
            <div
              className={cn(
                "mt-4 space-y-2 font-bold",
                isDarkSummit ? "text-zinc-300" : "text-white/90"
              )}
            >
              <p className="flex items-center justify-center gap-2 md:justify-start">
                <Calendar className="h-5 w-5 shrink-0" aria-hidden />
                {summary.periodLabel}
              </p>
              <p className="flex items-center justify-center gap-2 md:justify-start">
                <MapPin className="h-5 w-5 shrink-0" aria-hidden />
                {summary.locationLine}
              </p>
            </div>
            {!eventOver ? (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <a
                  href={calendar.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold shadow-lg transition hover:scale-105",
                    isDarkSummit
                      ? "bg-[color:var(--pe-accent)] text-[color:var(--pe-accent-fg)]"
                      : "bg-white text-[color:var(--accent)]"
                  )}
                >
                  <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                  Add to calendar
                </a>
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border-2 px-6 py-3.5 text-sm font-bold backdrop-blur-sm transition",
                    isDarkSummit
                      ? "border-white/20 bg-white/5 text-zinc-100 hover:bg-white/10"
                      : "border-white/80 bg-white/15 text-white hover:bg-white/25"
                  )}
                >
                  Get directions
                </a>
              </div>
            ) : null}
          </div>

          <PublicEventCountdownWideGrid
            startIso={summary.date}
            endIso={summary.endDate}
            tone={isDarkSummit ? "muted" : "bright"}
          />
        </div>
      </div>
    </SectionShell>
  );
}
