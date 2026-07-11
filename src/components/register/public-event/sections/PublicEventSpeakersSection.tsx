"use client";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { SectionHeader } from "./shared/SectionHeader";
import { SectionShell } from "./shared/SectionShell";
import { SpeakerGrid } from "./shared/SpeakerGrid";

type PublicEventSpeakersSectionProps = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
};

/**
 * Speaker / dignitary gallery — `#speakers`
 * CMS: `experience.speakers[]` — name, title, company, bio, imageUrl, social.{linkedin,twitter,website}
 */
export function PublicEventSpeakersSection({ experience, theme, variant }: PublicEventSpeakersSectionProps) {
  const isNight = variant === "night-edition";
  const section = resolvePublicEventSectionHeader("speakers", experience, {
    variant: isNight ? "night-edition" : "summit"
  });
  if (experience.speakers.length === 0) return null;

  return (
    <SectionShell id={PUBLIC_EVENT_SECTION_IDS.speakers} theme={theme}>
      <SectionHeader
        theme={theme}
        variant={variant}
        badge={section.badge}
        title={section.title}
        description={section.description}
        gradientTitle={false}
      />
      <SpeakerGrid experience={experience} theme={theme} variant={variant} />
    </SectionShell>
  );
}
