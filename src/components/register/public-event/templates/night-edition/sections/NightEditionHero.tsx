"use client";

import { ChevronDown, MapPin, Play } from "lucide-react";

import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { publicEventTitleClasses } from "@/lib/ui/eventHeroTitle";
import { cn } from "@/lib/utils";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  onOpenRegister: () => void;
};

/** CMS: hero uses event name, description, bannerImageUrl, locationLine, spotlight.locationLabel */
export function NightEditionHero({ summary, experience, onOpenRegister }: Props) {
  const titleScale = publicEventTitleClasses(summary.name);
  const locationLabel = experience.spotlight?.locationLabel ?? summary.locationLine;
  const subtitle =
    summary.description?.trim().split(/\n/)[0]?.slice(0, 200) ??
    "Join industry peers for keynotes, workshops, and networking at this program.";

  return (
    <header className="relative flex min-h-[800px] w-full items-center justify-center overflow-hidden pt-24 md:min-h-screen">
      <div className="absolute inset-0 z-0">
        {summary.bannerImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={summary.bannerImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[var(--pe-surface-container)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--pe-background)] via-[var(--pe-background)]/60 to-[var(--pe-background)]/40" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(76,215,246,0.1)_0%,transparent_60%)]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-[var(--pe-container-max,1280px)] flex-col items-center px-5 text-center md:px-16">
        <div className="mb-10 inline-flex items-center gap-3 rounded-full border border-[color:var(--pe-primary)]/20 bg-[color:var(--pe-primary)]/5 px-5 py-2 backdrop-blur-md">
          <MapPin className="h-5 w-5 text-[color:var(--pe-primary)]" aria-hidden />
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--pe-on-surface)]">
            {locationLabel}
          </span>
        </div>

        <h1
          className={cn(
            "mb-8 max-w-5xl pe-text-gradient text-4xl font-extrabold leading-tight drop-shadow-2xl md:text-6xl lg:text-7xl",
            titleScale.title
          )}
        >
          {summary.name}
        </h1>

        <p className="mb-14 max-w-2xl text-lg leading-relaxed text-[var(--pe-on-surface-variant)]/90">
          {subtitle}
        </p>

        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <button
            type="button"
            onClick={onOpenRegister}
            className="rounded-full bg-[linear-gradient(135deg,var(--pe-gradient-from),var(--pe-gradient-to))] px-10 py-4 text-sm font-bold text-[var(--pe-background)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(255,170,249,0.4)]"
          >
            Secure your pass
          </button>
          <a
            href={`#${PUBLIC_EVENT_SECTION_IDS.program}`}
            className="group flex items-center gap-3 rounded-full border border-white/10 px-8 py-4 text-sm font-medium text-[var(--pe-on-surface)] transition-all hover:bg-white/5"
          >
            <Play className="h-6 w-6 text-[color:var(--pe-secondary)] transition-transform group-hover:scale-110" />
            View program
          </a>
        </div>
      </div>

      <a
        href={`#${PUBLIC_EVENT_SECTION_IDS.spotlight}`}
        className="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 opacity-60 transition-opacity hover:opacity-100"
      >
        <span className="text-xs font-semibold uppercase tracking-widest">Explore</span>
        <ChevronDown className="h-6 w-6 animate-bounce text-[color:var(--pe-primary)]" />
      </a>
    </header>
  );
}
