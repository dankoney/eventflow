"use client";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { EventGalleryMosaic } from "../../../sections/shared/EventGalleryMosaic";
import { SectionHeader } from "../../../sections/shared/SectionHeader";

type Props = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  eventName?: string;
};

/** Only render header when the organizer set a section title (heading) in CMS. */
function hasGalleryHeaderContent(experience: PublicEventExperiencePayload): boolean {
  return Boolean(experience.sectionHeaders?.gallery?.title?.trim());
}

/** `#gallery` — full-bleed 2×4 mosaic; click opens lightbox. */
export function NightEditionGallerySection({ experience, theme, eventName }: Props) {
  const items = experience.galleryItems
    .filter((g) => g.imageUrl?.trim())
    .map((g) => ({
      id: g.id,
      imageUrl: g.imageUrl!.trim(),
      caption: g.caption ?? null
    }));

  if (items.length === 0) return null;

  const section = resolvePublicEventSectionHeader("gallery", experience, { variant: "night-edition" });
  const showHeader = hasGalleryHeaderContent(experience);

  return (
    <section
      id={PUBLIC_EVENT_SECTION_IDS.gallery}
      className={cn("scroll-mt-24", theme.section, "!py-0")}
    >
      {showHeader ? (
        <div className="pe-container w-full py-16 md:py-20">
          <SectionHeader
            theme={theme}
            variant="night-edition"
            badge={section.badge}
            title={section.title}
            description={section.description}
            gradientTitle
          />
        </div>
      ) : null}
      <div className="w-full">
        <EventGalleryMosaic items={items} eventName={eventName} />
      </div>
    </section>
  );
}
