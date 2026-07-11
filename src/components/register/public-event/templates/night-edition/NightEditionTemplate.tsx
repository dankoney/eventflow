"use client";

/**
 * Template 2 — Night Edition (UNCITRAL-style MD3 layout).
 * Section ids match Template 1 so organizers can switch templates without breaking CMS data.
 */

import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";

import { PublicEventElectionSection } from "../../PublicEventElectionSection";
import type { PublicElectionView } from "@/lib/public-event/electionView";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { buildPublicEventCssVars, getPublicEventThemeClasses, themeRootClass } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { PublicPageScrollEffects } from "../../PublicPageScrollEffects";
import { NightEditionGallerySection } from "./sections/NightEditionGallerySection";
import { PublicEventNewsSection } from "../../sections/PublicEventNewsSection";
import { PublicEventPartnersSection } from "../../sections/PublicEventPartnersSection";
import { NightEditionSpotlightSection } from "./sections/NightEditionSpotlightSection";
import { usePublicEventPageModel } from "../../templates/usePublicEventPageModel";
import type { PublicEventSiteSummary } from "../../siteSummary";

import { NightEditionContactSection } from "./sections/NightEditionContactSection";
import { NightEditionFaqSection } from "./sections/NightEditionFaqSection";
import { NightEditionPricingSection } from "./sections/NightEditionPricingSection";
import { NightEditionCountdownSection } from "./sections/NightEditionCountdownSection";
import { NightEditionFooter } from "./sections/NightEditionFooter";
import { PublicEventHero } from "../../hero/PublicEventHero";
import { resolveHeroStyle, shouldShowHeroPageCountdown } from "@/lib/public-event/heroStyles";
import { NightEditionNav } from "./sections/NightEditionNav";
import { NightEditionProgramSection } from "./sections/NightEditionProgramSection";
import { NightEditionRegisterModal } from "./sections/NightEditionRegisterModal";
import { NightEditionSpeakersSection } from "./sections/NightEditionSpeakersSection";
import { NightEditionSummitSections } from "./sections/NightEditionSummitSections";
import { NightEditionOverviewSection } from "./sections/NightEditionOverviewSection";
import { SummitVenueOpsSection } from "../../sections/summit/SummitVenueOpsSection";

export type NightEditionTemplateProps = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  brandColor?: string;
  footerExtra?: string | null;
  registrationOpen?: boolean;
  eventOver?: boolean;
  election?: PublicElectionView | null;
  children: ReactNode;
};

export function NightEditionTemplate({
  summary,
  experience,
  brandColor,
  footerExtra,
  registrationOpen = true,
  eventOver = false,
  election = null,
  children
}: NightEditionTemplateProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [programDay, setProgramDay] = useState(summary.programDays[0]?.dayIndex ?? 1);

  const openRegister = () => {
    setRegisterOpen(true);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileMenuOpen]);

  const pageModel = usePublicEventPageModel(summary, experience, election);
  const heroStyle = resolveHeroStyle(experience.hero?.style ?? null, "night-edition");
  const showPageCountdown = shouldShowHeroPageCountdown(experience, "night-edition", pageModel.showCountdown);
  const theme = getPublicEventThemeClasses("night-edition");
  const cssVars = buildPublicEventCssVars("night-edition", brandColor);
  const mapsHref =
    summary.location.latitude != null && summary.location.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${summary.location.latitude},${summary.location.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(summary.location.address)}`;

  const pageStyle: CSSProperties = {
    ...cssVars,
    backgroundColor: "var(--pe-background)",
    color: "var(--pe-on-background)"
  };

  const hasProgramContent = useMemo(
    () =>
      experience.programMode === "PER_DAY"
        ? experience.agendaByDay.some((d) => d.items.length > 0)
        : experience.agenda.length > 0,
    [experience]
  );

  return (
    <div
      id="top"
      data-pe-scroll-root
      className={cn(
        themeRootClass("night-edition"),
        "pe-template-night-edition relative min-h-screen overflow-x-hidden antialiased selection:bg-[color:var(--pe-accent)]/30"
      )}
      style={pageStyle}
    >
      <PublicPageScrollEffects />
      <div className="relative z-[2]">
      <NightEditionNav
        summary={summary}
        model={pageModel}
        registrationOpen={registrationOpen}
        eventOver={eventOver}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onOpenRegister={openRegister}
      />

      <PublicEventHero
        summary={summary}
        experience={experience}
        variant="night-edition"
        eventOver={eventOver}
        brandColor={brandColor}
        onOpenRegister={openRegister}
        registerSlot={
          heroStyle === "conference" ? (
            <>
              <h3 className="text-2xl font-bold tracking-tight text-[var(--pe-on-surface)]">Register</h3>
              <p className="mt-2 text-sm text-[var(--pe-on-surface-variant)]">{summary.statusMessage}</p>
              <div className="mt-8">{children}</div>
            </>
          ) : undefined
        }
      />

      {pageModel.showSpotlight ? (
        <NightEditionSpotlightSection experience={experience} theme={theme} />
      ) : null}

      {pageModel.showOverview ? (
        <NightEditionOverviewSection summary={summary} experience={experience} mapsHref={mapsHref} />
      ) : null}

      {showPageCountdown ? (
        <NightEditionCountdownSection summary={summary} eventOver={eventOver} />
      ) : null}

      {pageModel.showPartners ? (
        <PublicEventPartnersSection experience={experience} theme={theme} variant="night-edition" />
      ) : null}

      {pageModel.showNews ? (
        <PublicEventNewsSection experience={experience} theme={theme} variant="night-edition" />
      ) : null}

      {pageModel.hasProgram && hasProgramContent ? (
        <NightEditionProgramSection
          summary={summary}
          experience={experience}
          theme={theme}
          programDay={programDay}
          onProgramDayChange={setProgramDay}
        />
      ) : null}

      {pageModel.showVenueOps ? (
        <SummitVenueOpsSection
          variant="summit-dark"
          summary={summary}
          experience={experience}
          mapsHref={mapsHref}
          theme={theme}
        />
      ) : null}

      {pageModel.hasSpeakers ? (
        <NightEditionSpeakersSection experience={experience} theme={theme} />
      ) : null}

      <NightEditionSummitSections
        summary={summary}
        experience={experience}
        pageModel={pageModel}
        hasProgramContent={hasProgramContent}
      />

      {pageModel.showPricing ? (
        <NightEditionPricingSection experience={experience} theme={theme} onOpenRegister={openRegister} />
      ) : null}

      {pageModel.showElection && election ? (
        <PublicEventElectionSection election={election} dark />
      ) : null}

      {pageModel.showFaq ? <NightEditionFaqSection experience={experience} theme={theme} /> : null}

      {pageModel.showContactSection ? (
        <NightEditionContactSection
          summary={summary}
          experience={experience}
          theme={theme}
          eventId={summary.eventId}
        />
      ) : null}

      {pageModel.showGallery ? (
        <NightEditionGallerySection
          experience={experience}
          theme={theme}
          eventName={summary.name}
        />
      ) : null}

      <NightEditionFooter summary={summary} footerExtra={footerExtra} />

      <NightEditionRegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        summary={summary}
        registrationOpen={registrationOpen}
        brandColor={brandColor}
      >
        {children}
      </NightEditionRegisterModal>
      </div>
    </div>
  );
}
