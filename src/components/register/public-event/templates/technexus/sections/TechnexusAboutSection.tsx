"use client";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { SUMMIT_PUBLIC_REGISTRATION_NOTE } from "@/lib/public-event/summitPublicCopy";
import { cn } from "@/lib/utils";

import { OverviewHighlightWidget } from "../../../sections/OverviewHighlightWidget";
import { PublicRegistrationNote } from "../../../sections/shared/PublicRegistrationNote";
import { descriptionParagraphs } from "../../../sections/summit/summitSectionUtils";
import type { PublicEventSiteSummary } from "../../../siteSummary";

import { TechnexusSectionTitle } from "./TechnexusSectionTitle";

type Props = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  sectionBandClass: string;
};

export function TechnexusAboutSection({ summary, experience, sectionBandClass }: Props) {
  const section = resolvePublicEventSectionHeader("overview", experience, { variant: "technexus" });
  const paras = descriptionParagraphs(summary.description);
  const image = experience.overviewImageUrl?.trim() || summary.bannerImageUrl?.trim() || null;

  return (
    <section id={PUBLIC_EVENT_SECTION_IDS.overview} className={cn("tn-section scroll-mt-24", sectionBandClass)}>
      <div className="tn-section-inner">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div className="relative order-2 md:order-1">
            <div className="tn-glass-card relative z-10 overflow-hidden rounded-xl p-2">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-[var(--pe-surface-container-high)] text-sm text-[var(--pe-on-surface-variant)]">
                  Upload an overview image in the public experience editor
                </div>
              )}
            </div>
            <div
              className="absolute -bottom-6 -right-6 -z-10 h-48 w-48 rounded-full bg-[var(--pe-primary-container)] opacity-30 blur-[100px]"
              aria-hidden
            />
          </div>

          <div className="order-1 md:order-2">
            <TechnexusSectionTitle title={section.title} />
            {section.description ? (
              <p className="mb-6 text-lg leading-relaxed text-[var(--pe-on-surface-variant)]">
                {section.description}
              </p>
            ) : null}
            <div className="mb-8 space-y-4 text-[var(--pe-on-surface-variant)]">
              {paras.length > 0 ? (
                paras.map((p, i) => (
                  <p key={i} className="whitespace-pre-wrap leading-relaxed">
                    {p}
                  </p>
                ))
              ) : (
                <p>Your organizer can add a full description in Eventflow.</p>
              )}
            </div>
            <OverviewHighlightWidget experience={experience} className="mt-2" />
          </div>
        </div>

        <PublicRegistrationNote variant="night-edition" className="mt-10">
          {SUMMIT_PUBLIC_REGISTRATION_NOTE}
        </PublicRegistrationNote>
      </div>
    </section>
  );
}
