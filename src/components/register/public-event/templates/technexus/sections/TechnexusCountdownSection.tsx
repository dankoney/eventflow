"use client";

import { useEffect, useMemo, useState } from "react";

import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  eventOver: boolean;
  variant: PublicEventTemplateVariant;
  sectionBandClass: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Colon-separated countdown band — `#countdown` */
export function TechnexusCountdownSection({ summary, eventOver, variant, sectionBandClass }: Props) {
  const isLight = variant === "technexus-light";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = useMemo(() => {
    if (eventOver) return null;
    const start = new Date(summary.date).getTime();
    const end = new Date(summary.endDate).getTime();
    if (Number.isNaN(start)) return null;
    const target = now >= end ? end : now >= start ? end : start;
    const ms = Math.max(0, target - now);
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    return {
      days: String(days),
      hours: pad(Math.floor((totalSec % 86400) / 3600)),
      minutes: pad(Math.floor((totalSec % 3600) / 60)),
      seconds: pad(totalSec % 60)
    };
  }, [summary.date, summary.endDate, now, eventOver]);

  if (eventOver || !parts) return null;

  const units = [
    { value: parts.days, label: "Days", accent: true },
    { value: parts.hours, label: "Hours", accent: false },
    { value: parts.minutes, label: "Mins", accent: false },
    { value: parts.seconds, label: "Secs", accent: false }
  ] as const;

  return (
    <section
      id={PUBLIC_EVENT_SECTION_IDS.countdown}
      className={cn(
        "tn-countdown-band scroll-mt-24",
        isLight
          ? "tn-countdown-band--overlap relative z-20 -mt-24 pb-16 pt-0"
          : cn(sectionBandClass, "py-12")
      )}
    >
      <div
        className={cn(
          "tn-section-inner text-center",
          isLight && "max-w-6xl px-4 sm:px-6 lg:px-8"
        )}
      >
        <div className={cn(isLight && "tn-countdown-card rounded-2xl p-8 text-center shadow-2xl lg:p-12")}>
          <p
            className={cn(
              "tn-countdown-eyebrow mb-6 text-xs font-semibold uppercase tracking-widest",
              isLight && "tn-countdown-eyebrow--light mb-8 font-bold"
            )}
          >
            Event commences in
          </p>
          <div
            className={cn(
              "flex flex-wrap items-center justify-center gap-4",
              isLight ? "gap-4 md:gap-8 lg:gap-12" : "sm:gap-8"
            )}
          >
            {units.map((u, i) => (
              <span key={u.label} className="contents">
                {i > 0 ? (
                  <span
                    className={cn(
                      "tn-countdown-separator hidden font-black sm:inline",
                      isLight
                        ? "tn-countdown-separator--light pb-6 text-4xl md:text-6xl"
                        : "text-4xl font-bold sm:text-6xl"
                    )}
                  >
                    :
                  </span>
                ) : null}
                <div className={cn("flex flex-col items-center", isLight && "min-w-[80px]")}>
                  <div
                    className={cn(
                      "tn-countdown-value font-[family-name:var(--font-tn-display)] font-bold leading-none",
                      isLight
                        ? "tn-countdown-value--light mb-2 text-5xl font-black sm:text-7xl lg:text-8xl"
                        : "text-4xl sm:text-6xl",
                      !isLight && u.accent && "tn-countdown-value--accent"
                    )}
                  >
                    {u.value}
                  </div>
                  <div
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider text-[var(--pe-on-surface-variant)]",
                      isLight && "tn-countdown-label--light font-bold tracking-widest"
                    )}
                  >
                    {u.label}
                  </div>
                </div>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
