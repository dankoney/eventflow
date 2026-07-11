"use client";

import { Play, Calendar } from "lucide-react";
import type { ReactNode } from "react";

import { hasCustomHeroOverlay, resolveConferenceTagline } from "@/lib/public-event/heroCustomization";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import {
  HeroBackdrop,
  HeroBrandScrim,
  HeroCountdownBlock,
  HeroGlassShapes,
  HeroMetaPills,
  HeroOverlayScrim,
  HeroPartnerStrip,
  HeroPrimaryActions,
  HeroRegisterColumn,
  HeroScrollCue,
  HeroSplitMedia,
  HeroStyleRoot,
  HeroSubtitle,
  HeroTitleBlock,
  HeroVideoBackground,
  TechnexusLightHeroBackdrop,
  useHeroCopy,
  type HeroLayoutContext
} from "./heroShared";

function HeroShell({
  ctx,
  className,
  children
}: {
  ctx: HeroLayoutContext;
  className?: string;
  children: ReactNode;
}) {
  const { isTechnexus } = useHeroCopy(ctx);
  return (
    <HeroStyleRoot ctx={ctx}>
      <section
        id={PUBLIC_EVENT_SECTION_IDS.registerHero}
        className={cn(
          "relative flex min-h-[min(720px,92vh)] items-center justify-center overflow-hidden pt-24",
          isTechnexus && "tn-hero-section",
          className
        )}
      >
        {children}
      </section>
    </HeroStyleRoot>
  );
}

/** Original template default — dark brand overlay on banner image (TechNexus reference). */
export function BrandOverlayHeroLayout({ ctx }: { ctx: HeroLayoutContext }) {
  const { bannerUrl, calendar, isTechnexus, isLight } = useHeroCopy(ctx);

  return (
    <HeroStyleRoot ctx={ctx}>
      <section
        id={PUBLIC_EVENT_SECTION_IDS.registerHero}
        className={cn(
          "tn-hero-section relative flex items-center justify-center overflow-hidden",
          isLight
            ? "tn-hero-section--light min-h-[800px] flex-col pb-36 pt-24 lg:pb-44"
            : "min-h-[min(720px,88vh)] pt-24"
        )}
      >
        {!isLight ? (
          bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt=""
              className="tn-hero-media absolute inset-0 z-0 h-full w-full object-cover object-center"
              aria-hidden
            />
          ) : (
            <div className="tn-hero-media tn-hero-media--fallback absolute inset-0 z-0" aria-hidden />
          )
        ) : !bannerUrl ? (
          <div
            className="tn-hero-media tn-hero-media--fallback tn-hero-media--light-fallback absolute inset-0 z-0"
            aria-hidden
          />
        ) : isTechnexus ? (
          <TechnexusLightHeroBackdrop bannerUrl={bannerUrl} hero={ctx.experience.hero} />
        ) : (
          <HeroBackdrop bannerUrl={bannerUrl} fixedBg>
            {hasCustomHeroOverlay(ctx.experience.hero) ? (
              <HeroOverlayScrim hero={ctx.experience.hero} />
            ) : (
              <div className="pe-hero-brand-image-tint absolute inset-0" aria-hidden />
            )}
          </HeroBackdrop>
        )}
        {!isLight ? (
          <div className="tn-hero-scrim absolute inset-0 z-0" aria-hidden>
            {hasCustomHeroOverlay(ctx.experience.hero) ? (
              <HeroOverlayScrim hero={ctx.experience.hero} />
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "relative z-10 w-full text-center",
            isLight ? "tn-hero-content flex flex-1 flex-col items-center justify-center" : "tn-section-inner py-12 md:py-16"
          )}
        >
          <div className={cn(isLight && "tn-section-inner tn-hero-reveal w-full max-w-7xl px-4 sm:px-6 lg:px-8")}>
            <HeroMetaPills
              periodLabel={ctx.summary.periodLabel}
              locationLabel={useHeroCopy(ctx).locationLabel}
              technexus={isTechnexus}
              light={isLight}
            />
            <HeroTitleBlock
              ctx={ctx}
              className={cn(
                "mb-10 max-w-4xl",
                isLight && "text-white uppercase"
              )}
              uppercase={isLight}
            />
            <HeroSubtitle
              ctx={ctx}
              className={cn("mx-auto", isLight ? "text-white/85" : "text-[var(--pe-on-surface-variant)]")}
            />
            <HeroPrimaryActions ctx={ctx} calendarHref={calendar.google} className={isLight ? "mb-0" : "mt-4"} />
          </div>
        </div>
      </section>
    </HeroStyleRoot>
  );
}

/** Standard conference: copy left + registration panel right. */
export function ConferenceHeroLayout({ ctx }: { ctx: HeroLayoutContext }) {
  const copy = useHeroCopy(ctx);
  const { bannerUrl, isDarkHero, calendar, showSubtitle, hero } = copy;
  const isSummitLight = ctx.variant === "professional-light";
  const isTechnexusLight = ctx.variant === "technexus-light";
  const tagline = resolveConferenceTagline(hero, showSubtitle);
  const showOrg = hero?.showOrgBadge !== false;
  const mutedTextStyle = hero?.subtitleColor ? { color: hero.subtitleColor } : undefined;
  const mutedTextClass = hero?.subtitleColor ? undefined : "text-white/85";
  const metaTextClass = hero?.subtitleColor ? undefined : "text-white/75";

  const backdropOverlay = bannerUrl ? (
    hasCustomHeroOverlay(hero) ? (
      <HeroOverlayScrim hero={hero} />
    ) : isSummitLight ? (
      <div className="pe-hero-brand-image-tint absolute inset-0" aria-hidden />
    ) : isTechnexusLight ? (
      <div className="tn-hero-scrim absolute inset-0" aria-hidden />
    ) : (
      <>
        <HeroBrandScrim heavy hero={hero} />
        <div className="absolute inset-0 bg-black/40" aria-hidden />
      </>
    )
  ) : isSummitLight ? (
    hasCustomHeroOverlay(hero) ? <HeroOverlayScrim hero={hero} /> : null
  ) : (
    <>
      <HeroBrandScrim heavy hero={hero} />
      <div className="absolute inset-0 bg-black/40" aria-hidden />
    </>
  );

  return (
    <HeroStyleRoot ctx={ctx}>
      <header className="relative flex min-h-screen items-center overflow-hidden pt-24">
        <HeroBackdrop bannerUrl={bannerUrl}>{backdropOverlay}</HeroBackdrop>
        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-6 py-16 sm:px-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            {showOrg ? (
              <span className="pe-hero-org-badge mb-6 inline-block">{ctx.summary.orgName}</span>
            ) : null}
            <HeroTitleBlock ctx={ctx} className="!mx-0 !max-w-none !text-left text-white" />
            <HeroSubtitle
              ctx={ctx}
              className={cn("!mx-0 max-w-xl text-lg", mutedTextClass)}
              style={mutedTextStyle}
            />
            {tagline.show ? (
              <p
                className={cn("mt-6 max-w-xl text-lg font-medium leading-relaxed", mutedTextClass)}
                style={mutedTextStyle}
              >
                {tagline.text}
              </p>
            ) : null}
            <p
              className={cn("mt-6 flex flex-wrap items-center gap-2 text-sm font-medium", metaTextClass)}
              style={mutedTextStyle}
            >
              {ctx.summary.periodLabel} · {ctx.summary.locationLine}
            </p>
            {!ctx.eventOver ? (
              <div className="mt-8">
                <a
                  href={calendar.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold shadow-lg transition hover:scale-105",
                    isSummitLight
                      ? "bg-white text-[color:var(--accent)]"
                      : copy.isTechnexus
                        ? "tn-btn-outline tn-btn-outline--hero-light"
                        : "border border-white/30 text-white hover:bg-white/10"
                  )}
                >
                  <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                  Add to calendar
                </a>
              </div>
            ) : null}
          </div>
          <HeroRegisterColumn ctx={ctx} className={isDarkHero ? "bg-[var(--pe-surface)]/95 backdrop-blur-sm" : undefined} />
        </div>
      </header>
    </HeroStyleRoot>
  );
}

export function LongTitleHeroLayout({ ctx }: { ctx: HeroLayoutContext }) {
  const { bannerUrl, calendar } = useHeroCopy(ctx);
  return (
    <HeroShell ctx={ctx}>
      <HeroBackdrop bannerUrl={bannerUrl}>
        <HeroBrandScrim hero={ctx.experience.hero} />
      </HeroBackdrop>
      <div className="relative z-10 mx-auto max-w-5xl px-6 py-16 text-center">
        <HeroMetaPills periodLabel={ctx.summary.periodLabel} locationLabel={useHeroCopy(ctx).locationLabel} />
        <HeroTitleBlock ctx={ctx} longTitle gradient />
        <HeroSubtitle ctx={ctx} className="mx-auto" />
        <HeroPrimaryActions ctx={ctx} calendarHref={calendar.google} className="mt-10" />
      </div>
    </HeroShell>
  );
}

export function NoImageHeroLayout({ ctx }: { ctx: HeroLayoutContext }) {
  const { calendar } = useHeroCopy(ctx);
  return (
    <HeroShell ctx={ctx} className="pe-hero-no-image min-h-[min(640px,88vh)]">
      <HeroGlassShapes />
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-16 text-center">
        <HeroMetaPills periodLabel={ctx.summary.periodLabel} locationLabel={useHeroCopy(ctx).locationLabel} />
        <HeroTitleBlock ctx={ctx} gradient />
        <HeroSubtitle ctx={ctx} className="mx-auto" />
        <HeroPrimaryActions ctx={ctx} calendarHref={calendar.google} className="mt-10" />
      </div>
    </HeroShell>
  );
}

export function ImageHeroLayout({ ctx }: { ctx: HeroLayoutContext }) {
  const { bannerUrl, calendar } = useHeroCopy(ctx);
  return (
    <HeroShell ctx={ctx}>
      <HeroBackdrop bannerUrl={bannerUrl}>
        <div className="absolute inset-0 bg-black/35" />
        <HeroOverlayScrim hero={ctx.experience.hero} />
      </HeroBackdrop>
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-16 text-center">
        <HeroMetaPills periodLabel={ctx.summary.periodLabel} locationLabel={useHeroCopy(ctx).locationLabel} />
        <HeroTitleBlock ctx={ctx} className="text-white drop-shadow-lg" />
        <HeroSubtitle ctx={ctx} className="mx-auto text-white/85" />
        <HeroPrimaryActions ctx={ctx} calendarHref={calendar.google} className="mt-10" />
      </div>
      <HeroScrollCue />
    </HeroShell>
  );
}

export function GradientOverlayHeroLayout({ ctx }: { ctx: HeroLayoutContext }) {
  const { bannerUrl } = useHeroCopy(ctx);
  return (
    <HeroShell ctx={ctx} className="min-h-[800px] md:min-h-screen">
      <HeroBackdrop bannerUrl={bannerUrl}>
        <HeroBrandScrim heavy hero={ctx.experience.hero} />
      </HeroBackdrop>
      <div className="relative z-10 mx-auto flex max-w-[var(--pe-container-max,1280px)] flex-col items-center px-5 text-center md:px-16">
        <div className="pe-hero-location-badge mb-10 inline-flex items-center gap-3 px-5 py-2">
          <span className="text-xs uppercase tracking-[0.2em]">
            {useHeroCopy(ctx).locationLabel || ctx.summary.periodLabel}
          </span>
        </div>
        <HeroTitleBlock ctx={ctx} gradient />
        <HeroSubtitle ctx={ctx} className="mx-auto mb-14 mt-8" />
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <button type="button" onClick={ctx.onOpenRegister} className="pe-hero-cta-gradient px-10 py-4">
            Secure your pass
          </button>
          <a
            href={`#${PUBLIC_EVENT_SECTION_IDS.program}`}
            className="group flex items-center gap-3 rounded-full border border-[var(--pe-outline-variant)] px-8 py-4 text-sm font-medium transition hover:bg-[var(--pe-primary)]/10"
          >
            <Play className="h-6 w-6 text-[color:var(--pe-primary)]" aria-hidden />
            View program
          </a>
        </div>
      </div>
      <HeroScrollCue />
    </HeroShell>
  );
}

export function VideoCountdownHeroLayout({ ctx }: { ctx: HeroLayoutContext }) {
  const videoUrl = ctx.experience.hero?.videoUrl?.trim();
  const clickPlay = ctx.experience.hero?.videoPlayback === "click";
  const autoplay = ctx.experience.hero?.videoPlayback === "autoplay";
  return (
    <HeroShell ctx={ctx}>
      {videoUrl ? (
        <HeroVideoBackground videoUrl={videoUrl} autoplay={autoplay} onClickPlay={clickPlay} />
      ) : (
        <HeroBackdrop bannerUrl={null}>
          <HeroBrandScrim hero={ctx.experience.hero} />
        </HeroBackdrop>
      )}
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-16 text-center">
        <HeroMetaPills periodLabel={ctx.summary.periodLabel} locationLabel={useHeroCopy(ctx).locationLabel} />
        <HeroTitleBlock ctx={ctx} gradient className="text-white" />
        <HeroSubtitle ctx={ctx} className="mx-auto text-white/80" />
        <HeroCountdownBlock ctx={ctx} />
        <button type="button" onClick={ctx.onOpenRegister} className="pe-hero-cta-primary mt-8">
          Register now
        </button>
      </div>
    </HeroShell>
  );
}

export function SplitMultimediaHeroLayout({ ctx }: { ctx: HeroLayoutContext }) {
  const { calendar } = useHeroCopy(ctx);
  return (
    <HeroShell ctx={ctx} className="!min-h-0 !items-stretch">
      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-0 lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 lg:px-12 lg:py-24">
          <HeroMetaPills periodLabel={ctx.summary.periodLabel} locationLabel={useHeroCopy(ctx).locationLabel} />
          <HeroTitleBlock ctx={ctx} className="!mx-0 !max-w-none !text-left" />
          <HeroSubtitle ctx={ctx} className="!mx-0 mt-4" />
          <HeroPrimaryActions ctx={ctx} calendarHref={calendar.google} className="!mt-8 !justify-start" />
        </div>
        <HeroSplitMedia ctx={ctx} />
      </div>
    </HeroShell>
  );
}

export function SponsorFirstHeroLayout({ ctx }: { ctx: HeroLayoutContext }) {
  const { bannerUrl, calendar } = useHeroCopy(ctx);
  return (
    <HeroShell ctx={ctx}>
      <HeroBackdrop bannerUrl={bannerUrl}>
        <HeroBrandScrim hero={ctx.experience.hero} />
      </HeroBackdrop>
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-16 text-center">
        <HeroPartnerStrip experience={ctx.experience} />
        <HeroMetaPills periodLabel={ctx.summary.periodLabel} locationLabel={useHeroCopy(ctx).locationLabel} />
        <HeroTitleBlock ctx={ctx} gradient />
        <HeroSubtitle ctx={ctx} className="mx-auto" />
        <HeroPrimaryActions ctx={ctx} calendarHref={calendar.google} className="mt-10" />
      </div>
    </HeroShell>
  );
}

export function GlassGeometricHeroLayout({ ctx }: { ctx: HeroLayoutContext }) {
  const { bannerUrl, calendar } = useHeroCopy(ctx);
  return (
    <HeroShell ctx={ctx} className="pe-hero-glass-scene">
      <HeroBackdrop bannerUrl={bannerUrl}>
        <div className="absolute inset-0 bg-[var(--pe-background)]/70" />
      </HeroBackdrop>
      <HeroGlassShapes />
      <div className="pe-hero-glass-card relative z-10 mx-4 max-w-3xl rounded-3xl border p-8 text-center backdrop-blur-xl md:p-12">
        <HeroMetaPills periodLabel={ctx.summary.periodLabel} locationLabel={useHeroCopy(ctx).locationLabel} />
        <HeroTitleBlock ctx={ctx} gradient />
        <HeroSubtitle ctx={ctx} className="mx-auto" />
        <HeroPrimaryActions ctx={ctx} calendarHref={calendar.google} className="mt-8" />
      </div>
    </HeroShell>
  );
}
