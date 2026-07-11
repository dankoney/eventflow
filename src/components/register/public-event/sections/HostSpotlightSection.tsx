"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import { parseSpotlightPlaylist } from "@/lib/public-event/spotlightPlaylist";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { SpotlightVideoPlaylist } from "../SpotlightVideoPlaylist";
import { SectionHeader } from "./shared/SectionHeader";
import { SectionShell } from "./shared/SectionShell";

type StatItem = { label: string; value: string };

type HostSpotlightSectionProps = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
  /** TechNexus alternating section band (`tn-section-band-base` / `alt`). */
  sectionClassName?: string;
  sectionShellVariant?: "default" | "alt" | "bordered";
};

function splitStatsSideColumns(stats: StatItem[]) {
  const left: { stat: StatItem; index: number }[] = [];
  const right: { stat: StatItem; index: number }[] = [];
  stats.forEach((stat, index) => {
    const entry = { stat, index };
    if (index % 2 === 0) left.push(entry);
    else right.push(entry);
  });
  return { left, right };
}

function SpotlightStatCard({
  label,
  value,
  side,
  delayMs
}: {
  label: string;
  value: string;
  side: "left" | "right";
  delayMs: number;
}) {
  return (
    <div
      className={cn(
        "pe-spotlight-stat",
        side === "left" ? "pe-spotlight-stat--left" : "pe-spotlight-stat--right"
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="pe-spotlight-stat-value tabular-nums">{value}</span>
      <span className="pe-spotlight-stat-label">{label}</span>
    </div>
  );
}

/**
 * Host spotlight — stats flanking hero media, play-to-reveal video, culture carousel.
 * Shared by Night Edition (template 2) and TechNexus (template 3).
 */
export function HostSpotlightSection({
  experience,
  theme,
  variant,
  sectionClassName,
  sectionShellVariant = "bordered"
}: HostSpotlightSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const s = experience.spotlight;
  const title = s?.title ?? "Experience the host destination";
  const description =
    s?.description ??
    "Discover the vibrant pulse where tradition meets innovation in the heart of the region.";
  const items = s?.carouselItems ?? [];
  const stats = s?.stats ?? [];
  const { left: leftStats, right: rightStats } = useMemo(() => splitStatsSideColumns(stats), [stats]);
  const bgImage = s?.backgroundImageUrl?.trim() || null;
  const bgVideo = s?.backgroundVideoUrl?.trim() || null;
  const playlist = useMemo(() => parseSpotlightPlaylist(bgVideo), [bgVideo]);
  const hasVideo = playlist.length > 0;
  const hasImage = Boolean(bgImage);
  const showMedia = hasImage || hasVideo;
  const autoplayVideo = s?.backgroundVideoAutoplay !== false;
  const [videoActive, setVideoActive] = useState(autoplayVideo && hasVideo);
  const videoRevealed = hasVideo && (!hasImage || autoplayVideo || videoActive);

  useEffect(() => {
    setVideoActive(autoplayVideo && hasVideo);
  }, [autoplayVideo, hasVideo, bgVideo]);

  const isNight =
    variant === "night-edition" || variant === "technexus-dark" || variant === "technexus-light";

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <SectionShell
      id={PUBLIC_EVENT_SECTION_IDS.spotlight}
      theme={theme}
      variant={sectionShellVariant}
      className={sectionClassName}
    >
      <SectionHeader
        theme={theme}
        variant={variant}
        badge={s?.badge ?? "Host Spotlight"}
        title={title}
        description={description}
        gradientTitle={isNight}
      />

      <div className="mx-auto flex w-full flex-col gap-10">
        {showMedia ? (
          <div className="pe-spotlight-hero relative mx-auto w-full max-w-7xl px-1 py-4 md:px-4 md:py-6">
            <div
              className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
              aria-hidden
            >
              <div className="absolute left-1/4 top-1/4 h-40 w-40 rounded-full bg-[color:var(--pe-primary)]/10 blur-[80px]" />
              <div className="absolute bottom-1/4 right-1/4 h-40 w-40 rounded-full bg-[color:var(--pe-secondary)]/10 blur-[80px]" />
            </div>

            <div className="pe-spotlight-media-row grid items-center gap-6 lg:grid-cols-[minmax(9rem,11rem)_minmax(0,1fr)_minmax(9rem,11rem)] lg:gap-10 xl:gap-14">
              {leftStats.length > 0 ? (
                <div className="relative z-10 hidden flex-col gap-5 lg:flex">
                  {leftStats.map(({ stat, index }) => (
                    <SpotlightStatCard
                      key={`${stat.label}-${stat.value}`}
                      label={stat.label}
                      value={stat.value}
                      side="left"
                      delayMs={index * 120}
                    />
                  ))}
                </div>
              ) : (
                <div className="hidden lg:block" aria-hidden />
              )}

              <div
                className={cn(
                  "pe-spotlight-media pe-spotlight-glass-card relative z-0 aspect-video min-h-[240px] w-full min-w-0 overflow-hidden rounded-2xl sm:min-h-[320px] md:min-h-[400px] lg:min-h-[min(48vh,520px)]",
                  videoRevealed && "pe-spotlight-media--playing"
                )}
              >
                <div
                  className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-[var(--pe-background)]/80 via-transparent to-[var(--pe-background)]/20"
                  aria-hidden
                />

                {hasImage ? (
                  <div className="pe-spotlight-media-poster absolute inset-0 z-0 bg-[var(--pe-surface-container-high)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bgImage!}
                      alt=""
                      className="h-full w-full object-cover object-center"
                    />
                  </div>
                ) : null}

                {hasVideo ? (
                  <div className="pe-spotlight-media-video absolute inset-0 z-[2] bg-black">
                    <SpotlightVideoPlaylist
                      playlist={playlist}
                      autoplay={autoplayVideo}
                      startActive={videoActive}
                      onActiveChange={setVideoActive}
                    />
                  </div>
                ) : null}

                {hasVideo && hasImage && !videoRevealed ? (
                  <div className="absolute inset-0 z-[30] flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setVideoActive(true)}
                      className="pe-spotlight-play-btn flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--pe-primary)] text-[color:var(--pe-on-primary)] transition-transform hover:scale-105 sm:h-20 sm:w-20"
                      aria-label="Play host nation video"
                    >
                      <Play className="h-8 w-8 fill-current sm:h-10 sm:w-10" aria-hidden />
                    </button>
                  </div>
                ) : null}

                {!hasImage && !hasVideo ? (
                  <div className="relative z-0 flex min-h-[280px] items-center justify-center bg-[var(--pe-surface-container-high)]" />
                ) : null}
              </div>

              {rightStats.length > 0 ? (
                <div className="relative z-10 hidden flex-col gap-5 lg:flex">
                  {rightStats.map(({ stat, index }) => (
                    <SpotlightStatCard
                      key={`${stat.label}-${stat.value}`}
                      label={stat.label}
                      value={stat.value}
                      side="right"
                      delayMs={index * 120 + 60}
                    />
                  ))}
                </div>
              ) : (
                <div className="hidden lg:block" aria-hidden />
              )}
            </div>

            {stats.length > 0 ? (
              <div className="relative z-10 mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:hidden">
                {stats.map((stat, i) => (
                  <SpotlightStatCard
                    key={`mobile-${stat.label}`}
                    label={stat.label}
                    value={stat.value}
                    side={i % 2 === 0 ? "left" : "right"}
                    delayMs={i * 100}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : stats.length > 0 ? (
          <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-10 gap-y-4 px-2">
            {stats.map((stat, i) => (
              <SpotlightStatCard
                key={`${stat.label}-${stat.value}`}
                label={stat.label}
                value={stat.value}
                side={i % 2 === 0 ? "left" : "right"}
                delayMs={i * 100}
              />
            ))}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="group relative w-full">
            <button
              type="button"
              onClick={() => scroll(-1)}
              className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full pe-glass-panel text-[var(--pe-on-surface)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[color:var(--pe-primary)] hover:text-[var(--pe-background)] md:-left-2"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full pe-glass-panel text-[var(--pe-on-surface)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[color:var(--pe-primary)] hover:text-[var(--pe-background)] md:-right-2"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="flex justify-center overflow-hidden px-8 md:px-12">
              <div
                ref={scrollRef}
                className="inline-flex max-w-full snap-x snap-mandatory gap-5 overflow-x-auto pb-3 pe-no-scrollbar"
              >
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="group/card relative aspect-[4/5] w-52 shrink-0 snap-center overflow-hidden rounded-lg border border-white/5 bg-[var(--pe-surface-container)] pe-premium-glow sm:w-60 md:w-64 lg:w-72"
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-110"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[var(--pe-surface-container-high)]" />
                    )}
                    <div className="absolute inset-0 pe-card-gradient" />
                    <div className="absolute bottom-0 left-0 w-full p-5 md:p-6">
                      <h3 className="text-base font-bold text-[var(--pe-on-surface)] md:text-lg">{item.title}</h3>
                      {item.href ? (
                        <a
                          href={item.href}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--pe-primary)] transition-all hover:gap-2 md:text-sm"
                        >
                          Learn more
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {s?.ctaLabel && s?.ctaHref ? (
          <div className="flex justify-center pt-2">
            <a href={s.ctaHref} className={theme.btnPrimary}>
              {s.ctaLabel}
            </a>
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}
