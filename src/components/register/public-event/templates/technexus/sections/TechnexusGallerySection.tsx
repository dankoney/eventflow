"use client";

import { ZoomIn } from "lucide-react";
import { useState } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import type { GalleryMosaicItem } from "../../../sections/shared/EventGalleryMosaic";
import { TechnexusGalleryLightbox } from "./TechnexusGalleryLightbox";
import { TechnexusSectionTitle } from "./TechnexusSectionTitle";

type Props = {
  experience: PublicEventExperiencePayload;
  eventName?: string;
  sectionBandClass: string;
};

/** Masonry gallery with carousel lightbox (prev/next) — `#gallery` */
export function TechnexusGallerySection({ experience, sectionBandClass }: Props) {
  const section = resolvePublicEventSectionHeader("gallery", experience, { variant: "technexus" });
  const items: GalleryMosaicItem[] = experience.galleryItems
    .filter((g) => g.imageUrl?.trim())
    .map((g) => ({ id: g.id, imageUrl: g.imageUrl!.trim(), caption: g.caption ?? null }));

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <section id={PUBLIC_EVENT_SECTION_IDS.gallery} className={cn("tn-section scroll-mt-24", sectionBandClass)}>
      <div className="tn-section-inner">
        <div className={section.title || section.description ? "mb-16 text-center" : "mb-0"}>
          <TechnexusSectionTitle title={section.title} centered />
          {section.description ? (
            <p className="mx-auto max-w-2xl text-lg text-[var(--pe-on-surface-variant)]">{section.description}</p>
          ) : null}
        </div>

        <div className="tn-gallery-masonry">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="tn-glass-card group relative w-full overflow-hidden rounded-xl text-left"
              onClick={() => setLightboxIndex(index)}
              aria-label={item.caption?.split("\n")[0]?.trim() || `View gallery image ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.caption ?? ""}
                className="h-auto w-full transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--pe-primary)]/30 opacity-0 transition-opacity group-hover:opacity-100">
                <ZoomIn className="h-10 w-10 text-white drop-shadow-md" aria-hidden />
              </div>
            </button>
          ))}
        </div>

        <TechnexusGalleryLightbox
          items={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      </div>
    </section>
  );
}
