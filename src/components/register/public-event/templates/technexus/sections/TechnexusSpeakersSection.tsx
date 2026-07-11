"use client";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { SpeakerGrid } from "../../../sections/shared/SpeakerGrid";

import { TechnexusSectionTitle } from "./TechnexusSectionTitle";

type Props = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
  sectionBandClass: string;
};

export function TechnexusSpeakersSection({ experience, theme, variant, sectionBandClass }: Props) {
  const section = resolvePublicEventSectionHeader("speakers", experience, { variant: "technexus" });
  const speakers = experience.speakers.filter((s) => s.name?.trim());

  if (speakers.length === 0) return null;

  return (
    <section id={PUBLIC_EVENT_SECTION_IDS.speakers} className={cn("tn-section scroll-mt-24", sectionBandClass)}>
      <div className="tn-section-inner">
        <div className={section.title || section.description ? "mb-16 text-center" : "mb-0"}>
          <TechnexusSectionTitle title={section.title} centered />
          {section.description ? (
            <p className="mx-auto max-w-2xl text-lg text-[var(--pe-on-surface-variant)]">{section.description}</p>
          ) : null}
        </div>

        <SpeakerGrid
          experience={experience}
          theme={theme}
          variant={variant}
          columns={experience.speakersDisplay?.columns ?? 3}
          hoverStyle={experience.speakersDisplay?.hoverStyle ?? "zoom"}
        />
      </div>
    </section>
  );
}
