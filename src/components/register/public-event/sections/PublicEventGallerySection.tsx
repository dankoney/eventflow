"use client";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { EventGalleryMosaic } from "./shared/EventGalleryMosaic";
import { SectionHeader } from "./shared/SectionHeader";
import { SectionShell } from "./shared/SectionShell";

type Props = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
  eventName?: string;
};

/** Photo gallery — `#gallery` (mosaic grid + lightbox, shared with Template 2). */
export function PublicEventGallerySection({ experience, theme, variant, eventName }: Props) {
  const isNight = variant === "night-edition";
  const section = resolvePublicEventSectionHeader("gallery", experience, {
    variant: isNight ? "night-edition" : "summit"
  });
  const items = experience.galleryItems
    .filter((g) => g.imageUrl?.trim())
    .map((g) => ({
      id: g.id,
      imageUrl: g.imageUrl!.trim(),
      caption: g.caption ?? null
    }));

  if (items.length === 0) return null;

  const mosaic = <EventGalleryMosaic items={items} eventName={eventName} />;

  if (isNight) {
    return (
      <section
        id={PUBLIC_EVENT_SECTION_IDS.gallery}
        className={cn("scroll-mt-24", theme.section, "!py-0")}
      >
        {section.title?.trim() || section.description?.trim() ? (
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
        <div className="w-full">{mosaic}</div>
      </section>
    );
  }

  return (
    <SectionShell
      id={PUBLIC_EVENT_SECTION_IDS.gallery}
      theme={theme}
      variant="default"
      className="[&_.pe-container]:max-w-none [&_.pe-container]:px-0"
    >
      <SectionHeader
        theme={theme}
        variant={variant}
        badge={section.badge}
        title={section.title}
        description={section.description}
      />
      {mosaic}
    </SectionShell>
  );
}
