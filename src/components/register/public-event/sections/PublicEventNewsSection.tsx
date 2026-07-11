"use client";

import { ArrowRight, Play } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { toYoutubeEmbedUrl } from "@/lib/public-event/youtubeEmbed";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { HorizontalScrollCarousel } from "./shared/HorizontalScrollCarousel";
import { SectionHeader } from "./shared/SectionHeader";
import { SectionShell } from "./shared/SectionShell";

type PublicEventNewsSectionProps = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
  technexusSectionBandClass?: string;
};

function newsVideoEmbed(item: PublicEventExperiencePayload["newsItems"][number]): string | null {
  const fromField = item.videoEmbedUrl?.trim();
  if (!fromField) return null;
  return toYoutubeEmbedUrl(fromField) ?? (fromField.includes("/embed/") ? fromField : null);
}

/**
 * News & media — `#news` (horizontal carousel)
 */
export function PublicEventNewsSection({
  experience,
  theme,
  variant,
  technexusSectionBandClass
}: PublicEventNewsSectionProps) {
  const isTechnexus = variant === "technexus-dark" || variant === "technexus-light";
  const isNight = variant === "night-edition" || isTechnexus;
  const section = resolvePublicEventSectionHeader("news", experience, {
    variant:
      variant === "technexus-dark" || variant === "technexus-light"
        ? "technexus"
        : isNight
          ? "night-edition"
          : "summit"
  });
  const items = experience.newsItems;

  return (
    <SectionShell
      id={PUBLIC_EVENT_SECTION_IDS.news}
      theme={theme}
      variant="default"
      className={cn(isTechnexus && (technexusSectionBandClass ?? "tn-section-band-base"))}
    >
      <SectionHeader
        theme={theme}
        variant={variant}
        badge={section.badge}
        title={section.title}
        description={section.description}
        gradientTitle={isNight}
      />

      <HorizontalScrollCarousel>
        {items.map((item) => {
          const embed = item.mediaType === "video" ? newsVideoEmbed(item) : null;

          return (
            <article
              key={item.id}
              className={cn(
                "group flex h-full w-[88%] shrink-0 snap-start flex-col overflow-hidden sm:w-[70%] md:w-[45%] lg:w-[32%]",
                isNight ? "rounded-xl pe-glass-panel transition-all duration-300 hover:border-[color:var(--pe-accent)]/40" : cn(theme.card, theme.cardHover)
              )}
            >
              <div className="relative aspect-video w-full overflow-hidden">
                {embed ? (
                  <iframe
                    title={item.title}
                    src={embed}
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--pe-surface-container)]">
                    {item.mediaType === "video" ? <Play className="h-12 w-12 text-[color:var(--pe-accent)]" aria-hidden /> : null}
                  </div>
                )}
              </div>
              <div className="flex flex-grow flex-col p-6 md:p-8">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[color:var(--pe-accent)]">{item.dateLabel}</p>
                <h3 className="mb-4 text-lg font-bold text-[var(--pe-on-surface)] transition-colors group-hover:text-[color:var(--pe-accent)]">
                  {item.title}
                </h3>
                {item.excerpt ? <p className={cn(theme.muted, "mb-4 flex-grow")}>{item.excerpt}</p> : null}
                {item.href ? (
                  <a
                    href={item.href}
                    className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-[var(--pe-on-surface-variant)] transition hover:text-[color:var(--pe-accent)]"
                  >
                    Read more
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </HorizontalScrollCarousel>
    </SectionShell>
  );
}
