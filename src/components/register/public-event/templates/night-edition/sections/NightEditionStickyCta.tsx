"use client";

import { ArrowRight } from "lucide-react";

import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";

import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  registrationOpen: boolean;
  eventOver: boolean;
};

export function NightEditionStickyCta({ summary, registrationOpen, eventOver }: Props) {
  return (
    <div className="fixed bottom-0 left-0 z-50 w-full border-t border-white/10 bg-[var(--pe-surface-container)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[var(--pe-container-max,1280px)] flex-col items-center justify-between gap-3 px-5 py-3 sm:flex-row md:px-16">
        <div className="hidden sm:block">
          <p className="font-bold text-[var(--pe-on-surface)]">{summary.name}</p>
          <p className="text-xs text-[var(--pe-on-surface-variant)]">{summary.periodLabel}</p>
        </div>
        {registrationOpen ? (
          <a
            href={`#${PUBLIC_EVENT_SECTION_IDS.registerHero}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--pe-gradient-from),var(--pe-gradient-to))] px-8 py-3 text-sm font-bold text-[var(--pe-background)] sm:w-auto"
          >
            Register
            <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <span className="text-sm font-bold text-zinc-500">{eventOver ? "Event ended" : "Registration closed"}</span>
        )}
      </div>
    </div>
  );
}
