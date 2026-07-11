"use client";

import { Calendar, MapPin, Navigation } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { buildPublicEventCalendarLinks } from "@/lib/public-event/calendarLinks";

import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  eventOver: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Countdown band — `#countdown` */
export function NightEditionCountdownSection({ summary, eventOver }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => {
    const start = new Date(summary.date).getTime();
    const end = new Date(summary.endDate).getTime();
    if (Number.isNaN(start)) return null;
    const target = now >= end ? end : now >= start ? end : start;
    const ms = Math.max(0, target - now);
    const totalSec = Math.floor(ms / 1000);
    return {
      days: pad(Math.floor(totalSec / 86400)),
      hours: pad(Math.floor((totalSec % 86400) / 3600)),
      minutes: pad(Math.floor((totalSec % 3600) / 60)),
      seconds: pad(totalSec % 60)
    };
  }, [summary.date, summary.endDate, now]);

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
    <section
      id={PUBLIC_EVENT_SECTION_IDS.countdown}
      className="pe-section-countdown scroll-mt-24 overflow-hidden px-5 py-24 md:px-16"
    >
      <div className="mx-auto max-w-[var(--pe-container-max,1280px)]">
        <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,var(--pe-gradient-from),var(--pe-gradient-to))] p-8 shadow-2xl md:p-16">
          <div className="absolute left-0 top-1/2 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--pe-surface-container-low)] md:block" />
          <div className="absolute right-0 top-1/2 hidden h-12 w-12 translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--pe-surface-container-low)] md:block" />

          <div className="relative z-10 flex flex-col items-center justify-center gap-12 md:flex-row md:justify-between">
            <div className="text-center text-[var(--pe-background)] md:text-left">
              <h3 className="text-2xl font-black uppercase tracking-tight md:text-4xl">{summary.name}</h3>
              <div className="mt-4 space-y-2 font-bold opacity-80">
                <p className="flex items-center justify-center gap-2 md:justify-start">
                  <Calendar className="h-5 w-5" />
                  {summary.periodLabel}
                </p>
                <p className="flex items-center justify-center gap-2 md:justify-start">
                  <MapPin className="h-5 w-5" />
                  {summary.locationLine}
                </p>
              </div>
              {!eventOver ? (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                  <a
                    href={calendar.google}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--pe-background)] px-6 py-3.5 text-sm font-bold text-[var(--pe-on-surface)] shadow-lg transition hover:scale-105"
                  >
                    <Calendar className="h-4 w-4" aria-hidden />
                    Add to calendar
                  </a>
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--pe-background)]/80 bg-[var(--pe-background)]/15 px-6 py-3.5 text-sm font-bold text-[var(--pe-background)] backdrop-blur-sm transition hover:bg-[var(--pe-background)]/25"
                  >
                    <Navigation className="h-4 w-4" aria-hidden />
                    Get directions
                  </a>
                </div>
              ) : null}
            </div>

            {remaining ? (
              <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-2 text-[var(--pe-background)] sm:max-w-lg sm:gap-4 md:mx-0 md:max-w-xl md:gap-6">
                {(
                  [
                    ["days", remaining.days, "Days"],
                    ["hours", remaining.hours, "Hrs"],
                    ["min", remaining.minutes, "Min"],
                    ["sec", remaining.seconds, "Sec"]
                  ] as const
                ).map(([key, val, label], i) => (
                  <div
                    key={key}
                    className={`flex flex-col items-center ${i > 0 ? "border-l border-[var(--pe-background)]/20 pl-2 sm:pl-3 md:pl-5" : ""}`}
                  >
                    <div className="text-3xl font-black leading-none sm:text-4xl md:text-6xl">{val}</div>
                    <div className="mt-2 text-xs font-bold uppercase tracking-widest opacity-60">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
