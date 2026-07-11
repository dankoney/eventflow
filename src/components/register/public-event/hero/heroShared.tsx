"use client";

import { Calendar, MapPin, Play } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

import { buildPublicEventCalendarLinks } from "@/lib/public-event/calendarLinks";
import {
  buildHeroCustomizationVars,
  hasCustomHeroOverlay,
  hasCustomHeroTitleSize,
  heroBackgroundStyle,
  heroOverlayStyle,
  heroTitleSizeClass,
  heroTitleFontClass,
  resolveHeroSubtitle,
  splitTitleAccent
} from "@/lib/public-event/heroCustomization";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import {
  extractYoutubeVideoIds,
  isDirectVideoFileUrl,
  parseBackgroundVideoUrls
} from "@/lib/public-event/youtubeEmbed";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import { publicEventTitleClasses } from "@/lib/ui/eventHeroTitle";
import { cn } from "@/lib/utils";

import { PublicEventCountdown } from "../PublicEventCountdown";
import { DirectVideoPlaylist } from "../DirectVideoPlaylist";
import { YoutubeSequentialPlayer } from "../YoutubeSequentialPlayer";
import type { PublicEventSiteSummary } from "../siteSummary";

export type HeroLayoutContext = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  variant: PublicEventTemplateVariant;
  eventOver: boolean;
  brandColor?: string;
  onOpenRegister: () => void;
  registerSlot?: ReactNode;
};

export function useHeroCopy(ctx: HeroLayoutContext) {
  const hero = ctx.experience.hero;
  const locationLabel =
    ctx.experience.spotlight?.locationLabel?.trim() ||
    ctx.summary.location.name?.trim() ||
    (() => {
      const line = ctx.summary.locationLine?.trim();
      if (!line) return "";
      const dash = line.indexOf(" — ");
      return dash > 0 ? line.slice(0, dash).trim() : line;
    })();
  const subtitleState = resolveHeroSubtitle(hero, ctx.summary.description);
  const calendar = buildPublicEventCalendarLinks({
    name: ctx.summary.name,
    date: ctx.summary.date,
    endDate: ctx.summary.endDate,
    locationLine: ctx.summary.locationLine,
    description: ctx.summary.description
  });
  const titleScale = publicEventTitleClasses(ctx.summary.name);
  const bannerUrl = ctx.summary.bannerImageUrl?.trim() || null;
  const splitImageUrl =
    hero?.splitImageUrl?.trim() || bannerUrl;
  const isTechnexus = ctx.variant === "technexus-dark" || ctx.variant === "technexus-light";
  const isLight =
    ctx.variant === "professional-light" ||
    ctx.variant === "technexus-light";
  const isDarkHero = !isLight;

  return {
    hero,
    locationLabel,
    subtitle: subtitleState.text,
    showSubtitle: subtitleState.show,
    calendar,
    titleScale,
    bannerUrl,
    splitImageUrl,
    isTechnexus,
    isLight,
    isDarkHero
  };
}

export function HeroStyleRoot({
  ctx,
  className,
  children
}: {
  ctx: HeroLayoutContext;
  className?: string;
  children: ReactNode;
}) {
  const customBg = heroBackgroundStyle(ctx.experience.hero);
  return (
    <div className={cn("pe-hero-root", className)} style={{ ...buildHeroCustomizationVars(ctx.experience.hero), ...customBg }}>
      {children}
    </div>
  );
}

/** Slate + brand-blue tint over hero photo (TechNexus light reference). */
export function technexusLightHeroBackgroundStyle(bannerUrl: string): CSSProperties {
  const blueTint =
    "linear-gradient(135deg, rgba(46, 91, 255, 0.28) 0%, rgba(30, 64, 175, 0.42) 45%, rgba(15, 23, 42, 0.72) 100%)";
  const slateVeil = "linear-gradient(rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.78))";
  return {
    backgroundImage: `${slateVeil}, ${blueTint}, url(${bannerUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed"
  };
}

export function TechnexusLightHeroBackdrop({
  bannerUrl,
  hero
}: {
  bannerUrl: string;
  hero?: PublicEventExperiencePayload["hero"];
}) {
  if (hasCustomHeroOverlay(hero)) {
    return (
      <HeroBackdrop bannerUrl={bannerUrl} fixedBg>
        <div className="tn-hero-scrim absolute inset-0" aria-hidden />
        <HeroOverlayScrim hero={hero} />
      </HeroBackdrop>
    );
  }
  return (
    <div
      className="absolute inset-0 z-0"
      style={technexusLightHeroBackgroundStyle(bannerUrl)}
      aria-hidden
    />
  );
}

export function HeroBackdrop({
  bannerUrl,
  children,
  className,
  fixedBg = false
}: {
  bannerUrl: string | null;
  children?: ReactNode;
  className?: string;
  fixedBg?: boolean;
}) {
  return (
    <div className={cn("absolute inset-0 z-0", className)}>
      {bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bannerUrl}
          alt=""
          className={cn("h-full w-full object-cover", fixedBg && "object-center")}
          style={fixedBg ? { objectPosition: "center" } : undefined}
        />
      ) : (
        <div className="pe-hero-fallback h-full w-full" />
      )}
      {children}
    </div>
  );
}

export function HeroOverlayScrim({ hero, className, defaultClass }: { hero?: PublicEventExperiencePayload["hero"]; className?: string; defaultClass?: string }) {
  const custom = heroOverlayStyle(hero);
  if (custom) {
    return <div className={cn("absolute inset-0", className)} style={custom} />;
  }
  return <div className={cn("absolute inset-0", defaultClass ?? "pe-hero-brand-veil")} />;
}

export function HeroBrandScrim({ heavy = false, hero }: { heavy?: boolean; hero?: PublicEventExperiencePayload["hero"] }) {
  const custom = heroOverlayStyle(hero);
  if (custom) {
    return <div className="absolute inset-0" style={custom} />;
  }
  return (
    <>
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-[var(--pe-background)] via-[var(--pe-background)]/60 to-[var(--pe-background)]/30",
          heavy && "via-[var(--pe-background)]/75"
        )}
      />
      <div className="pe-hero-brand-veil absolute inset-0" />
    </>
  );
}

export function HeroMetaPills({
  periodLabel,
  locationLabel,
  technexus = false,
  light = false
}: {
  periodLabel: string;
  locationLabel: string;
  technexus?: boolean;
  light?: boolean;
}) {
  const pillClass = technexus
    ? light
      ? "tn-hero-meta-pill"
      : "tn-hero-meta-pill"
    : "pe-hero-meta-pill inline-flex items-center gap-2";

  return (
    <div className={cn(technexus ? "tn-hero-meta mb-8" : "mb-8 flex flex-wrap items-center justify-center gap-3")}>
      <div className={pillClass}>
        <Calendar className="h-4 w-4 shrink-0" aria-hidden />
        <span>{periodLabel}</span>
      </div>
      {locationLabel ? (
        <div className={pillClass}>
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          <span>{locationLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

export function HeroTitleBlock({
  ctx,
  longTitle = false,
  gradient = false,
  className,
  uppercase = false
}: {
  ctx: HeroLayoutContext;
  longTitle?: boolean;
  gradient?: boolean;
  className?: string;
  uppercase?: boolean;
}) {
  const { hero, titleScale, isTechnexus } = useHeroCopy(ctx);
  const useAccent = hero?.titleUseAccentWord !== false;
  const { lead, accent, full } = splitTitleAccent(ctx.summary.name, useAccent);
  const customTitleSize = hasCustomHeroTitleSize(hero);
  const sizeClass = heroTitleSizeClass(hero);
  const fontClass = heroTitleFontClass(hero);
  const hasTitleGradient = Boolean(hero?.titleGradientFrom && hero?.titleGradientTo);
  const titleGradientStyle: CSSProperties | undefined = hasTitleGradient
    ? {
        backgroundImage: `linear-gradient(135deg, ${hero!.titleGradientFrom}, ${hero!.titleGradientTo})`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent"
      }
    : undefined;
  const titleColorClass = hasTitleGradient
    ? undefined
    : hero?.titleColor
      ? "text-[color:var(--pe-hero-title-color)]"
      : gradient
        ? "pe-text-gradient"
        : "text-[var(--pe-hero-title-color,var(--pe-on-surface))]";
  const accentStyle: CSSProperties | undefined = hero?.titleAccentColor
    ? { color: hero.titleAccentColor, WebkitTextFillColor: hero.titleAccentColor }
    : undefined;

  return (
    <h1
      className={cn(
        "mx-auto max-w-5xl font-bold leading-tight tracking-tight",
        isTechnexus && !fontClass && "font-[family-name:var(--font-tn-display)] font-extrabold",
        fontClass,
        !customTitleSize &&
          (longTitle ? "text-2xl sm:text-3xl md:text-4xl lg:text-5xl" : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl"),
        sizeClass,
        uppercase && "uppercase tracking-tight",
        titleColorClass,
        !customTitleSize && titleScale.title,
        className
      )}
      style={titleGradientStyle}
    >
      {lead && accent ? (
        <>
          {lead}{" "}
          <span className={isTechnexus ? "tn-hero-accent" : undefined} style={accentStyle}>
            {accent}
          </span>
        </>
      ) : (
        full
      )}
    </h1>
  );
}

export function HeroSubtitle({
  ctx,
  className,
  style
}: {
  ctx: HeroLayoutContext;
  className?: string;
  style?: CSSProperties;
}) {
  const { showSubtitle, subtitle } = useHeroCopy(ctx);
  if (!showSubtitle || !subtitle) return null;
  return (
    <p
      className={cn("mt-6 max-w-2xl text-lg leading-relaxed text-[var(--pe-hero-subtitle-color,var(--pe-on-surface-variant))]", className)}
      style={style}
    >
      {subtitle}
    </p>
  );
}

export function HeroPrimaryActions({
  ctx,
  calendarHref,
  className
}: {
  ctx: HeroLayoutContext;
  calendarHref: string;
  className?: string;
}) {
  const { isTechnexus, isLight } = useHeroCopy(ctx);
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 sm:flex-row", className)}>
      <button
        type="button"
        onClick={ctx.onOpenRegister}
        className={cn(
          isTechnexus ? "tn-btn-cta w-full sm:w-auto" : "pe-hero-cta-primary",
          isTechnexus && isLight && "tn-btn-cta--hero-light"
        )}
      >
        Secure your spot
      </button>
      {!ctx.eventOver ? (
        <a
          href={calendarHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            isTechnexus ? "tn-btn-outline w-full sm:w-auto" : "pe-hero-cta-secondary",
            isTechnexus && isLight && "tn-btn-outline--hero-light"
          )}
        >
          <Calendar className="h-4 w-4 shrink-0" aria-hidden />
          Add to calendar
        </a>
      ) : null}
    </div>
  );
}

export function HeroRegisterColumn({ ctx, className }: { ctx: HeroLayoutContext; className?: string }) {
  const isNight = ctx.variant === "night-edition";
  const nightPanelClass = isNight
    ? "border-white/15 bg-[color-mix(in_srgb,var(--pe-background)_88%,black)] shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
    : undefined;

  if (ctx.registerSlot) {
    return (
      <div
        id="register-hero"
        className={cn(
          "scroll-mt-28 rounded-2xl border border-[var(--pe-glass-border)] bg-[var(--pe-surface)] p-8 text-[var(--pe-on-surface)] shadow-2xl md:p-10 lg:col-span-7",
          className,
          nightPanelClass
        )}
      >
        {ctx.registerSlot}
      </div>
    );
  }
  return (
    <div
      id="register-hero"
      className={cn(
        "scroll-mt-28 rounded-2xl border border-[var(--pe-glass-border)] bg-[var(--pe-surface)]/95 p-8 shadow-2xl backdrop-blur-sm md:p-10 lg:col-span-7",
        className,
        nightPanelClass
      )}
    >
      <h3 className="text-2xl font-bold tracking-tight text-[var(--pe-on-surface)]">Register</h3>
      <p className="mt-2 text-sm text-[var(--pe-on-surface-variant)]">{ctx.summary.statusMessage}</p>
      <button type="button" onClick={ctx.onOpenRegister} className="pe-hero-cta-primary mt-8 w-full sm:w-auto">
        Continue to registration
      </button>
    </div>
  );
}

export function HeroCountdownBlock({ ctx }: { ctx: HeroLayoutContext }) {
  const { isDarkHero } = useHeroCopy(ctx);
  return (
    <div className="mt-8">
      <PublicEventCountdown
        startIso={ctx.summary.date}
        endIso={ctx.summary.endDate}
        dark={isDarkHero}
        heroSleek
      />
    </div>
  );
}

export function HeroPartnerStrip({ experience }: { experience: PublicEventExperiencePayload }) {
  const partners = experience.partners.filter((p) => p.logoUrl || p.name?.trim());
  if (partners.length === 0) return null;
  return (
    <div className="mt-10 w-full max-w-4xl">
      <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--pe-on-surface-variant)]">
        Hosted with
      </p>
      <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
        {partners.slice(0, 8).map((p) =>
          p.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.logoUrl}
              alt={p.name}
              className="h-8 max-w-[120px] object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0 md:h-10"
            />
          ) : (
            <span key={p.id} className="text-sm font-semibold text-[var(--pe-on-surface-variant)]">
              {p.name}
            </span>
          )
        )}
      </div>
    </div>
  );
}

export function HeroScrollCue() {
  return (
    <a
      href={`#${PUBLIC_EVENT_SECTION_IDS.spotlight}`}
      className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-xs font-semibold uppercase tracking-widest text-[var(--pe-on-surface-variant)] opacity-70 transition hover:opacity-100"
    >
      Explore
    </a>
  );
}

export function HeroVideoBackground({
  videoUrl,
  autoplay = true,
  onClickPlay
}: {
  videoUrl: string;
  autoplay?: boolean;
  onClickPlay?: boolean;
}) {
  const [playing, setPlaying] = useState(autoplay && !onClickPlay);
  const videoUrls = parseBackgroundVideoUrls(videoUrl);
  const youtubeIds = extractYoutubeVideoIds(videoUrl);
  const directUrls = videoUrls.filter((url) => isDirectVideoFileUrl(url));

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {playing ? (
        <>
          {youtubeIds.length > 0 ? (
            <YoutubeSequentialPlayer videoIds={youtubeIds} active className="h-full w-full" />
          ) : directUrls.length > 0 ? (
            <DirectVideoPlaylist urls={directUrls} active controls={false} className="h-full w-full object-cover" />
          ) : (
            <video src={videoUrl} className="h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" />
          )}
        </>
      ) : null}
      <div className="absolute inset-0 bg-[var(--pe-background)]/55" />
      <HeroOverlayScrim hero={undefined} defaultClass="pe-hero-brand-veil" />
      {onClickPlay && !playing ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="pe-hero-cta-primary flex h-16 w-16 items-center justify-center rounded-full sm:h-20 sm:w-20"
            aria-label="Play video"
          >
            <Play className="h-8 w-8 fill-current sm:h-10 sm:w-10" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function HeroSplitMedia({ ctx }: { ctx: HeroLayoutContext }) {
  const { hero, bannerUrl, splitImageUrl } = useHeroCopy(ctx);
  const mediaType = hero?.splitMediaType ?? "image";
  const videoUrl = hero?.videoUrl?.trim();
  const clickPlay = hero?.videoPlayback === "click";
  const autoplay = hero?.videoPlayback === "autoplay";

  if (mediaType === "video" && videoUrl) {
    return (
      <div className="relative min-h-[320px] lg:min-h-[560px]">
        <HeroVideoBackground videoUrl={videoUrl} autoplay={autoplay} onClickPlay={clickPlay} />
      </div>
    );
  }

  const imageUrl = splitImageUrl || bannerUrl;
  return (
    <div className="relative min-h-[320px] lg:min-h-[560px]">
      <HeroBackdrop bannerUrl={imageUrl}>
        <HeroBrandScrim hero={hero} />
      </HeroBackdrop>
    </div>
  );
}

export function HeroGlassShapes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="pe-hero-glass-orb pe-hero-glass-orb--primary absolute -left-16 top-20 h-56 w-56 rounded-full blur-3xl" />
      <div className="pe-hero-glass-orb pe-hero-glass-orb--secondary absolute -right-10 bottom-16 h-72 w-72 rounded-full blur-3xl" />
      <div className="pe-hero-glass-panel absolute right-[12%] top-[18%] h-28 w-28 rotate-12 rounded-3xl" />
      <div className="pe-hero-glass-panel absolute bottom-[22%] left-[10%] h-20 w-36 -rotate-6 rounded-2xl" />
    </div>
  );
}
