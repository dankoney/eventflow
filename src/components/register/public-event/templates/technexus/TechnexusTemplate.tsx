"use client";

/**
 * Template 3 — TechNexus (MD3 light/dark via attendee theme, glass cards, masonry gallery).
 */

import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";

import { PublicEventElectionSection } from "../../PublicEventElectionSection";
import { PublicEventNewsSection } from "../../sections/PublicEventNewsSection";
import { PublicEventPartnersSection } from "../../sections/PublicEventPartnersSection";
import { PublicEventPricingSection } from "../../sections/PublicEventPricingSection";
import { HostSpotlightSection } from "../../sections/HostSpotlightSection";
import { PublicEventHero } from "../../hero/PublicEventHero";
import type { PublicElectionView } from "@/lib/public-event/electionView";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { buildAgendaPdfHtml } from "@/lib/public-event/agendaPdfHtml";
import type { SummitColorMode } from "@/lib/public-event/templates/resolveColorMode";
import { buildPublicEventCssVars, getPublicEventThemeClasses, themeRootClass } from "@/lib/public-event/templates/theme";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import {
  buildTechnexusSectionBands,
  technexusFooterBandClassName,
  technexusSectionBandClassName
} from "@/lib/public-event/templates/sectionBands";
import { resolveHeroStyle, shouldShowHeroPageCountdown } from "@/lib/public-event/heroStyles";
import { isTechnexusDarkVariant, resolveTechnexusTemplateVariant } from "@/lib/public-event/templates/technexusVariant";
import { cn } from "@/lib/utils";

import { PublicPageScrollEffects } from "../../PublicPageScrollEffects";
import { usePublicEventPageModel } from "../usePublicEventPageModel";
import type { PublicEventSiteSummary } from "../../siteSummary";

import { TechnexusAboutSection } from "./sections/TechnexusAboutSection";
import { TechnexusContactSection } from "./sections/TechnexusContactSection";
import { TechnexusCountdownSection } from "./sections/TechnexusCountdownSection";
import { TechnexusFaqSection } from "./sections/TechnexusFaqSection";
import { TechnexusFooter } from "./sections/TechnexusFooter";
import { TechnexusGallerySection } from "./sections/TechnexusGallerySection";
import { TechnexusNav } from "./sections/TechnexusNav";
import { TechnexusProgramSection } from "./sections/TechnexusProgramSection";
import { TechnexusRegisterModal } from "./sections/TechnexusRegisterModal";
import { TechnexusResourcesSection } from "./sections/TechnexusResourcesSection";
import { TechnexusSpeakersSection } from "./sections/TechnexusSpeakersSection";
import { TechnexusVenueSection } from "./sections/TechnexusVenueSection";

export type TechnexusTemplateProps = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  colorMode: SummitColorMode;
  brandColor?: string;
  footerExtra?: string | null;
  registrationOpen?: boolean;
  eventOver?: boolean;
  election?: PublicElectionView | null;
  children: ReactNode;
};

export function TechnexusTemplate({
  summary,
  experience,
  colorMode,
  brandColor,
  footerExtra,
  registrationOpen = true,
  eventOver = false,
  election = null,
  children
}: TechnexusTemplateProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const pageModel = usePublicEventPageModel(summary, experience, election);
  const templateVariant = resolveTechnexusTemplateVariant(colorMode);
  const theme = getPublicEventThemeClasses(templateVariant);
  const cssVars = buildPublicEventCssVars(templateVariant, brandColor);
  const electionDark = isTechnexusDarkVariant(templateVariant);

  const mapsHref =
    summary.location.latitude != null && summary.location.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${summary.location.latitude},${summary.location.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(summary.location.address)}`;

  const hasProgramContent = useMemo(
    () =>
      experience.programMode === "PER_DAY"
        ? experience.agendaByDay.some((d) => d.items.length > 0)
        : experience.agenda.length > 0,
    [experience]
  );

  const heroStyle = resolveHeroStyle(experience.hero?.style ?? null, templateVariant);
  const showPageCountdown = shouldShowHeroPageCountdown(experience, templateVariant, pageModel.showCountdown);

  const bandInput = useMemo(
    () => ({
      flags: {
        showCountdown: showPageCountdown,
        showOverview: pageModel.showOverview,
        showSpotlight: pageModel.showSpotlight,
        hasSpeakers: pageModel.hasSpeakers,
        hasProgram: pageModel.hasProgram,
        showPartners: pageModel.showPartners,
        showNews: pageModel.showNews,
        showVenueOps: pageModel.showVenueOps,
        showResourcesSection: pageModel.showResourcesSection,
        showPricing: pageModel.showPricing,
        showElection: pageModel.showElection,
        showFaq: pageModel.showFaq,
        showContactSection: pageModel.showContactSection,
        showGallery: pageModel.showGallery
      },
      hasProgramContent,
      hasElection: Boolean(election)
    }),
    [pageModel, hasProgramContent, election, showPageCountdown]
  );

  const sectionBands = useMemo(
    () => buildTechnexusSectionBands(bandInput, experience.themeCustomization),
    [bandInput, experience.themeCustomization]
  );
  const sectionContrast = experience.themeCustomization?.sectionContrast ?? "subtle";
  const tnBand = (sectionId: (typeof PUBLIC_EVENT_SECTION_IDS)[keyof typeof PUBLIC_EVENT_SECTION_IDS]) =>
    technexusSectionBandClassName(sectionBands, sectionId, "base", sectionContrast);
  const footerBandClass = useMemo(
    () => technexusFooterBandClassName(bandInput, sectionBands, sectionContrast),
    [bandInput, sectionBands, sectionContrast]
  );

  const enquiryEmailConfigured = Boolean(experience.contact?.email?.trim());

  function openRegister() {
    setRegisterOpen(true);
    setMobileMenuOpen(false);
  }

  function downloadAgendaPdf() {
    const html = buildAgendaPdfHtml({
      eventName: summary.name,
      orgName: summary.orgName,
      periodLabel: summary.periodLabel,
      locationLine: summary.locationLine,
      description: summary.description,
      experience
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileMenuOpen]);

  const pageStyle: CSSProperties = {
    ...cssVars,
    backgroundColor: "var(--pe-background)",
    color: "var(--pe-on-surface)"
  };

  return (
    <div
      id="top"
      data-pe-scroll-root
      className={cn(
        themeRootClass(templateVariant),
        "pe-template-technexus relative min-h-screen overflow-x-hidden scroll-smooth"
      )}
      style={pageStyle}
    >
      <PublicPageScrollEffects />
      <div className="relative z-[2]">
        <TechnexusNav
          summary={summary}
          model={pageModel}
          registrationOpen={registrationOpen}
          eventOver={eventOver}
          mobileMenuOpen={mobileMenuOpen}
          onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
          onCloseMobileMenu={() => setMobileMenuOpen(false)}
          onOpenRegister={openRegister}
        />

        <main>
          <PublicEventHero
            summary={summary}
            experience={experience}
            variant={templateVariant}
            eventOver={eventOver}
            brandColor={brandColor}
            onOpenRegister={openRegister}
            registerSlot={
              heroStyle === "conference" ? (
                <>
                  <h3 className="text-2xl font-bold tracking-tight text-[var(--pe-on-surface)]">Register</h3>
                  <p className="mt-2 text-sm text-[var(--pe-on-surface-variant)]">{summary.statusMessage}</p>
                  <div className={cn("mt-8", theme.registerShell)}>{children}</div>
                </>
              ) : undefined
            }
          />

          {showPageCountdown ? (
            <TechnexusCountdownSection
              summary={summary}
              eventOver={eventOver}
              variant={templateVariant}
              sectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.countdown)}
            />
          ) : null}

          {pageModel.showOverview ? (
            <TechnexusAboutSection
              summary={summary}
              experience={experience}
              sectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.overview)}
            />
          ) : null}

          {pageModel.showSpotlight ? (
            <HostSpotlightSection
              experience={experience}
              theme={theme}
              variant={templateVariant}
              sectionShellVariant="default"
              sectionClassName={tnBand(PUBLIC_EVENT_SECTION_IDS.spotlight)}
            />
          ) : null}

          {pageModel.hasSpeakers ? (
            <TechnexusSpeakersSection
              experience={experience}
              theme={theme}
              variant={templateVariant}
              sectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.speakers)}
            />
          ) : null}

          {pageModel.hasProgram && hasProgramContent ? (
            <TechnexusProgramSection
              summary={summary}
              experience={experience}
              sectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.program)}
            />
          ) : null}

          {pageModel.showPartners ? (
            <PublicEventPartnersSection
              experience={experience}
              theme={theme}
              variant={templateVariant}
              technexusSectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.partners)}
            />
          ) : null}

          {pageModel.showNews ? (
            <PublicEventNewsSection
              experience={experience}
              theme={theme}
              variant={templateVariant}
              technexusSectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.news)}
            />
          ) : null}

          {pageModel.showVenueOps ? (
            <TechnexusVenueSection
              summary={summary}
              experience={experience}
              mapsHref={mapsHref}
              sectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.venueOps)}
            />
          ) : null}

          {pageModel.showResourcesSection ? (
            <TechnexusResourcesSection
              experience={experience}
              hasProgram={pageModel.hasProgram && hasProgramContent}
              onDownloadAgendaPdf={downloadAgendaPdf}
              sectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.resources)}
            />
          ) : null}

          {pageModel.showPricing ? (
            <PublicEventPricingSection
              experience={experience}
              theme={theme}
              variant={templateVariant}
              technexusSectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.pricing)}
            />
          ) : null}

          {pageModel.showElection && election ? (
            <section
              id={PUBLIC_EVENT_SECTION_IDS.election}
              className={cn("tn-section scroll-mt-24", tnBand(PUBLIC_EVENT_SECTION_IDS.election))}
            >
              <div className="tn-section-inner">
                <PublicEventElectionSection election={election} dark={electionDark} />
              </div>
            </section>
          ) : null}

          {pageModel.showFaq ? (
            <TechnexusFaqSection
              experience={experience}
              sectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.faq)}
            />
          ) : null}

          {pageModel.showContactSection ? (
            <TechnexusContactSection
              summary={summary}
              experience={experience}
              eventId={summary.eventId}
              enquiryEmailConfigured={enquiryEmailConfigured}
              sectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.contact)}
            />
          ) : null}

          {pageModel.showGallery ? (
            <TechnexusGallerySection
              experience={experience}
              eventName={summary.name}
              sectionBandClass={tnBand(PUBLIC_EVENT_SECTION_IDS.gallery)}
            />
          ) : null}
        </main>

        <TechnexusFooter
          summary={summary}
          footerExtra={footerExtra}
          footerBandClass={footerBandClass}
          themeCustomization={experience.themeCustomization}
        />

        <TechnexusRegisterModal
          open={registerOpen}
          onClose={() => setRegisterOpen(false)}
          summary={summary}
          registrationOpen={registrationOpen}
          brandColor={brandColor}
          templateVariant={templateVariant}
        >
          {children}
        </TechnexusRegisterModal>
      </div>
    </div>
  );
}
