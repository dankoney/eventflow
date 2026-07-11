"use client";

import { ExternalLink, MapPin, Navigation } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";

import { OverviewHighlightWidget } from "../../../sections/OverviewHighlightWidget";
import { usePublicEventTranslation } from "../../../i18n/PublicEventTranslationProvider";
import { descriptionParagraphs } from "@/components/register/public-event/sections/shared/utils";
import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  mapsHref: string;
};

/** `#overview` — program copy, venue card, and highlight widget (countries, etc.) */
export function NightEditionOverviewSection({ summary, experience, mapsHref }: Props) {
  const { t } = usePublicEventTranslation();
  const aboutParas = descriptionParagraphs(summary.description);
  const section = resolvePublicEventSectionHeader("overview", experience, { variant: "night-edition" });
  const highlightsMode = experience.overviewHighlights?.mode ?? "default";
  const hasHighlights = highlightsMode !== "none";
  const isCountryList = highlightsMode === "country_flags";

  const overviewImage =
    experience.overviewImageUrl?.trim() || summary.bannerImageUrl?.trim() || null;
  const venueImage = summary.location.facilityImageUrl?.trim() || null;

  return (
    <section
      id={PUBLIC_EVENT_SECTION_IDS.overview}
      className="scroll-mt-24 bg-[var(--pe-background)] px-5 py-20 md:px-16 md:py-24"
    >
      <div className="mx-auto max-w-[var(--pe-container-max,1280px)]">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            {section.badge ? (
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--pe-primary)]">
                {section.badge}
              </p>
            ) : null}
          <h2 className="text-3xl font-extrabold text-[var(--pe-on-surface)] md:text-5xl">
            {section.title ?? t("overview.aboutTitle")}
          </h2>
          {section.description ? (
            <p className="mt-4 text-lg leading-relaxed text-[var(--pe-on-surface-variant)]">{section.description}</p>
          ) : null}
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-[var(--pe-on-surface-variant)]">
            {aboutParas.length > 0 ? (
              aboutParas.map((p, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {p}
                </p>
              ))
            ) : (
              <p>{t("overview.organizerPlaceholder")}</p>
            )}
            </div>
          </div>

          {overviewImage ? (
            <div className="pe-panel-surface overflow-hidden p-2 lg:sticky lg:top-28">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={overviewImage} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
            </div>
          ) : (
            <div className="hidden lg:block" aria-hidden />
          )}
        </div>

        {hasHighlights ? (
          <div
            className={
              isCountryList
                ? "mt-14 grid items-start gap-8 lg:grid-cols-12 lg:gap-10"
                : "mt-14"
            }
          >
            {isCountryList ? (
              <div className="pe-overview-venue-panel pe-panel-surface lg:col-span-4 lg:sticky lg:top-28">
                {venueImage ? (
                  <div className="overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={venueImage} alt="" className="aspect-[4/3] w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-[var(--pe-surface-container-high)]">
                    <MapPin className="h-10 w-10 text-[color:var(--pe-primary)]/50" aria-hidden />
                  </div>
                )}
                <div className="mt-5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--pe-on-surface-variant)]">
                    {t("overview.venue")}
                  </p>
                  <p className="mt-2 text-base font-semibold leading-snug text-[var(--pe-on-surface)]">
                    {summary.location.name?.trim() || summary.locationLine}
                  </p>
                  {summary.locationLine && summary.location.name?.trim() ? (
                    <p className="mt-1 text-sm text-[var(--pe-on-surface-variant)]">{summary.locationLine}</p>
                  ) : null}
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--pe-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--pe-primary)_12%,transparent)] px-5 py-3 text-sm font-bold text-[color:var(--pe-primary)] transition hover:bg-[color-mix(in_srgb,var(--pe-primary)_20%,transparent)]"
                  >
                    <Navigation className="h-4 w-4 shrink-0" aria-hidden />
                    {t("action.getDirections")}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                  </a>
                </div>
              </div>
            ) : null}

            <div className={isCountryList ? "pe-panel-surface lg:col-span-8" : "pe-panel-surface"}>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.14em] text-[var(--pe-on-surface-variant)]">
                {isCountryList ? t("overview.countriesAttending") : t("overview.programHighlights")}
              </h3>
              <OverviewHighlightWidget experience={experience} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
