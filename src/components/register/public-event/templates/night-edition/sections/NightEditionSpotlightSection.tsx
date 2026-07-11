"use client";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";

import { HostSpotlightSection } from "../../../sections/HostSpotlightSection";

type Props = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
};

/** Host spotlight — `#spotlight` — stats flanking hero video, culture carousel */
export function NightEditionSpotlightSection({ experience, theme }: Props) {
  return (
    <HostSpotlightSection
      experience={experience}
      theme={theme}
      variant="night-edition"
      sectionShellVariant="bordered"
    />
  );
}
