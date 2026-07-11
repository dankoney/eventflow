"use client";

import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { parseSpotlightPlaylist } from "@/lib/public-event/spotlightPlaylist";
import { SpotlightVideoPlaylist } from "../SpotlightVideoPlaylist";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { HorizontalScrollCarousel } from "./shared/HorizontalScrollCarousel";
import { SectionHeader } from "./shared/SectionHeader";
import { SectionShell } from "./shared/SectionShell";

type PublicEventSpotlightSectionProps = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
  technexusSectionBandClass?: string;
};

/**
 * Host spotlight — `#spotlight`
 * CMS: badge, title, description, backgroundImageUrl, backgroundVideoUrl, stats[], carouselItems[].
 */
export function PublicEventSpotlightSection({
  experience,
  theme,
  variant,
  technexusSectionBandClass
}: PublicEventSpotlightSectionProps) {
  const s = experience.spotlight;
  const isTechnexus = variant === "technexus-dark" || variant === "technexus-light";
  const isNight = variant === "night-edition" || isTechnexus;
  const title = s.title ?? "Experience the host destination";
  const description =
    s.description ??
    "Discover the vibrant pulse where tradition meets innovation in the heart of the region.";
  const items = s.carouselItems ?? [];
  const stats = s.stats ?? [];
  const bgImage = s.backgroundImageUrl?.trim() || null;
  const bgVideo = s.backgroundVideoUrl?.trim() || null;
  const playlist = useMemo(() => parseSpotlightPlaylist(bgVideo), [bgVideo]);
  const hasVideo = playlist.length > 0;
  const hasMedia = Boolean(bgImage || hasVideo);
  const autoplayVideo = s.backgroundVideoAutoplay !== false;

  return (
    <SectionShell
      id={PUBLIC_EVENT_SECTION_IDS.spotlight}
      theme={theme}
      variant="default"
      className={cn(isTechnexus && (technexusSectionBandClass ?? "tn-section-band-alt"))}
    >
      <SectionHeader
        theme={theme}
        variant={variant}
        badge={s.badge ?? "Host Spotlight"}
        title={title}
        description={description}
        gradientTitle={isNight}
      />

      {hasMedia ? (
        <div className="relative mb-12 min-h-[280px] overflow-hidden rounded-2xl md:min-h-[360px]">
          {bgImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bgImage} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
          ) : null}
          {hasVideo ? (
            <div className="absolute inset-0 z-[2] bg-black">
              <SpotlightVideoPlaylist playlist={playlist} autoplay={autoplayVideo} />
            </div>
          ) : null}
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-[var(--pe-background)] via-black/50 to-black/30"
            aria-hidden
          />
          {stats.length > 0 ? (
            <div className="relative z-10 flex min-h-[280px] flex-col justify-end p-6 md:min-h-[360px] md:p-10">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={`${stat.label}-${stat.value}`}
                    className={cn(
                      "rounded-xl p-4",
                      isNight ? "pe-glass-panel pe-premium-glow" : "border border-outline-variant/30 bg-white/90 shadow-sm"
                    )}
                  >
                    <p className="text-2xl font-extrabold text-[color:var(--pe-accent)] md:text-3xl">{stat.value}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--pe-on-surface-variant)]">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!hasMedia && stats.length > 0 ? (
        <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={`${stat.label}-${stat.value}`}
              className={cn(
                "rounded-xl p-4",
                isNight ? "pe-glass-panel pe-premium-glow" : "border border-outline-variant/30 bg-surface-container-low shadow-sm"
              )}
            >
              <p className="text-2xl font-extrabold text-[color:var(--pe-accent)] md:text-3xl">{stat.value}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--pe-on-surface-variant)]">{stat.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {items.length > 0 ? (
        <HorizontalScrollCarousel className="mb-10">
          {items.map((item) => (
            <article
              key={item.id}
              className={cn(
                "group/card relative aspect-[4/5] w-[85%] shrink-0 snap-start overflow-hidden rounded-xl border border-white/5 sm:w-[45%] md:w-[30%]",
                isNight && "pe-premium-glow bg-[var(--pe-surface-container)]",
                !isNight && "bg-surface-container shadow-md"
              )}
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-110"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-900" />
              )}
              <div className="absolute inset-0 pe-card-gradient" />
              <div className="absolute bottom-0 left-0 w-full p-6 md:p-8">
                <h3 className="text-lg font-bold text-[var(--pe-on-surface)] md:text-xl">{item.title}</h3>
                {item.href ? (
                  <a
                    href={item.href}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--pe-accent)] transition hover:gap-2"
                  >
                    Learn more
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </HorizontalScrollCarousel>
      ) : null}

      {s.ctaLabel && s.ctaHref ? (
        <div className="flex justify-center">
          <a href={s.ctaHref} className={theme.btnPrimary}>
            {s.ctaLabel}
          </a>
        </div>
      ) : null}
    </SectionShell>
  );
}
