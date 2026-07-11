"use client";

import { Calendar, MapPin } from "lucide-react";

import { buildPublicEventCalendarLinks } from "@/lib/public-event/calendarLinks";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { publicEventTitleClasses } from "@/lib/ui/eventHeroTitle";
import { cn } from "@/lib/utils";

import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  eventOver: boolean;
  onOpenRegister: () => void;
  variant: PublicEventTemplateVariant;
};

/** Slate + blue overlay on hero photo (light theme reference). */
function lightHeroBackgroundImage(bannerUrl: string): string {
  const blueTint =
    "linear-gradient(135deg, rgba(46, 91, 255, 0.28) 0%, rgba(30, 64, 175, 0.42) 45%, rgba(15, 23, 42, 0.72) 100%)";
  const slateVeil = "linear-gradient(rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.78))";
  return `${slateVeil}, ${blueTint}, url(${bannerUrl})`;
}

function heroLocationLabel(summary: PublicEventSiteSummary): string {
  const name = summary.location.name?.trim();
  if (name) return name;
  const line = summary.locationLine?.trim();
  if (!line) return "";
  const dash = line.indexOf(" — ");
  return dash > 0 ? line.slice(0, dash).trim() : line;
}

export function TechnexusHero({ summary, eventOver, onOpenRegister, variant }: Props) {
  const isLight = variant === "technexus-light";
  const bannerUrl = summary.bannerImageUrl?.trim() || null;
  const titleScale = publicEventTitleClasses(summary.name);
  const locationLabel = heroLocationLabel(summary);
  const calendar = buildPublicEventCalendarLinks({
    name: summary.name,
    date: summary.date,
    endDate: summary.endDate,
    locationLine: summary.locationLine,
    description: summary.description
  });

  const words = summary.name.trim().split(/\s+/);
  const accentWord = words.length > 2 ? words[words.length - 1] : null;
  const titleLead = accentWord ? words.slice(0, -1).join(" ") : null;

  return (
    <section
      id={PUBLIC_EVENT_SECTION_IDS.registerHero}
      className={cn(
        "tn-hero-section relative flex items-center justify-center overflow-hidden",
        isLight
          ? "tn-hero-section--light min-h-[800px] flex-col pb-36 pt-24 lg:pb-44"
          : "min-h-[min(720px,88vh)] pt-24"
      )}
      style={
        isLight && bannerUrl
          ? {
              backgroundImage: lightHeroBackgroundImage(bannerUrl),
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed"
            }
          : undefined
      }
    >
      {!isLight ? (
        bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt=""
            className="tn-hero-media absolute inset-0 z-0 h-full w-full object-cover object-center"
            aria-hidden
          />
        ) : (
          <div className="tn-hero-media tn-hero-media--fallback absolute inset-0 z-0" aria-hidden />
        )
      ) : !bannerUrl ? (
        <div className="tn-hero-media tn-hero-media--fallback tn-hero-media--light-fallback absolute inset-0 z-0" aria-hidden />
      ) : null}
      <div className="tn-hero-scrim absolute inset-0 z-0" aria-hidden />

      {isLight ? (
        <div className="tn-hero-content relative z-10 flex w-full flex-1 flex-col items-center justify-center">
          <div className="tn-section-inner tn-hero-reveal w-full max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <HeroBody
              summary={summary}
              eventOver={eventOver}
              locationLabel={locationLabel}
              accentWord={accentWord}
              titleLead={titleLead}
              calendar={calendar}
              isLight
              onOpenRegister={onOpenRegister}
            />
          </div>
        </div>
      ) : (
        <div className="tn-section-inner tn-hero-reveal relative z-10 w-full py-12 text-center md:py-16">
          <HeroBody
            summary={summary}
            eventOver={eventOver}
            locationLabel={locationLabel}
            accentWord={accentWord}
            titleLead={titleLead}
            calendar={calendar}
            titleScale={titleScale}
            onOpenRegister={onOpenRegister}
          />
        </div>
      )}
    </section>
  );
}

type HeroBodyProps = {
  summary: PublicEventSiteSummary;
  eventOver: boolean;
  locationLabel: string;
  accentWord: string | null;
  titleLead: string | null;
  calendar: ReturnType<typeof buildPublicEventCalendarLinks>;
  onOpenRegister: () => void;
  isLight?: boolean;
  titleScale?: ReturnType<typeof publicEventTitleClasses>;
};

function HeroBody({
  summary,
  eventOver,
  locationLabel,
  accentWord,
  titleLead,
  calendar,
  onOpenRegister,
  isLight = false,
  titleScale
}: HeroBodyProps) {
  return (
    <>
        <div className={cn("tn-hero-meta", isLight && "mb-8")}>
          <div className="tn-hero-meta-pill">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden />
            <span>{summary.periodLabel}</span>
          </div>
          {locationLabel ? (
            <div className="tn-hero-meta-pill">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              <span>{locationLabel}</span>
            </div>
          ) : null}
        </div>

        <h1
          className={cn(
            "mx-auto max-w-4xl font-[family-name:var(--font-tn-display)] font-extrabold leading-tight",
            isLight
              ? "mb-10 text-5xl uppercase tracking-tight text-white md:text-6xl lg:text-7xl"
              : "mb-10 text-4xl text-[var(--pe-on-surface)] md:text-6xl lg:text-7xl",
            !isLight && titleScale?.title
          )}
        >
          {accentWord && titleLead ? (
            <>
              {titleLead}{" "}
              <span className="tn-hero-accent">{accentWord}</span>
            </>
          ) : (
            summary.name
          )}
        </h1>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            type="button"
            onClick={onOpenRegister}
            className={cn("tn-btn-cta w-full sm:w-auto", isLight && "tn-btn-cta--hero-light")}
          >
            Secure Your Spot
          </button>
          {!eventOver ? (
            <a
              href={calendar.google}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("tn-btn-outline w-full sm:w-auto", isLight && "tn-btn-outline--hero-light")}
            >
              <Calendar className="h-4 w-4 shrink-0" aria-hidden />
              Add to Calendar
            </a>
          ) : null}
        </div>
    </>
  );
}
