"use client";

import { EventType } from "@prisma/client";
import { ArrowRight, Building2, Calendar, Menu, X } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";

import { PublicEventElectionSection } from "./PublicEventElectionSection";
import { PublicEventCountdown } from "./PublicEventCountdown";
import type { PublicElectionView } from "@/lib/public-event/electionView";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { buildAgendaPdfHtml } from "@/lib/public-event/agendaPdfHtml";
import { buildPublicEventCalendarLinks } from "@/lib/public-event/calendarLinks";
import { publicEventTitleClasses } from "@/lib/ui/eventHeroTitle";
import { cn } from "@/lib/utils";

import { PublicEventCountdownBandSection } from "./sections/PublicEventCountdownBandSection";
import { PublicEventHero } from "./hero/PublicEventHero";
import { shouldShowHeroPageCountdown } from "@/lib/public-event/heroStyles";
import { PublicEventGallerySection } from "./sections/PublicEventGallerySection";
import { PublicEventNewsSection } from "./sections/PublicEventNewsSection";
import { PublicEventPartnersSection } from "./sections/PublicEventPartnersSection";
import { PublicEventPricingSection } from "./sections/PublicEventPricingSection";
import { PublicEventSpeakersSection } from "./sections/PublicEventSpeakersSection";
import { PublicEventSpotlightSection } from "./sections/PublicEventSpotlightSection";
import { usePublicEventPageModel } from "./templates/usePublicEventPageModel";
import {
  buildPublicEventCssVars,
  getPublicEventThemeClasses,
  themeRootClass
} from "@/lib/public-event/templates/theme";

import { PublicPageScrollEffects } from "./PublicPageScrollEffects";
import { SUMMIT_PUBLIC_HERO_TAGLINE } from "@/lib/public-event/summitPublicCopy";

import { SummitContactSection } from "./sections/summit/SummitContactSection";
import { SummitFaqSection } from "./sections/summit/SummitFaqSection";
import { SummitOverviewSection } from "./sections/summit/SummitOverviewSection";
import { SummitProgramSection } from "./sections/summit/SummitProgramSection";
import { SummitResourcesSection } from "./sections/summit/SummitResourcesSection";
import { SummitVenueOpsSection } from "./sections/summit/SummitVenueOpsSection";
import { SummitPublicFooter } from "./sections/shared/SummitPublicFooter";
import { descriptionParagraphs, hasAttendeeContact } from "./sections/summit/summitSectionUtils";

import type { PublicEventSiteSummary } from "./siteSummary";

type PublicEventSummitExperienceProps = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  brandColor?: string;
  footerExtra?: string | null;
  /** False when registration cannot be completed for any reason. Disables Register CTAs. */
  registrationOpen?: boolean;
  /** True when the event has ended or was cancelled. Disables Add to Calendar and other forward-looking CTAs. */
  eventOver?: boolean;
  /** When populated, renders the Election menu link and a dedicated candidates section in the page body. */
  election?: PublicElectionView | null;
  children: ReactNode;
};

const TYPE_LABEL: Record<EventType, string> = {
  IN_PERSON: "In person",
  VIRTUAL: "Virtual",
  HYBRID: "Hybrid"
};

export function PublicEventSummitExperience({
  summary,
  experience,
  brandColor,
  footerExtra,
  registrationOpen = true,
  eventOver = false,
  election = null,
  children
}: PublicEventSummitExperienceProps) {
  /**
   * Per-section visibility flags (organizer-controlled in the Public experience
   * editor). When a flag is `false` we hide BOTH the corresponding nav link AND
   * the body section, without clearing the underlying content — admins can flip
   * the toggle back on at any time.
   */
  const pageModel = usePublicEventPageModel(summary, experience, election);
  const {
    showOverview,
    showSpotlight,
    showCountdown,
    hasProgram,
    showVenueOps,
    hasSpeakers,
    showPartners,
    showNews,
    showGallery,
    showResourcesSection,
    showPricing,
    showElection,
    electionLive,
    showContactSection,
    showFaq
  } = pageModel;
  const showPageCountdown = shouldShowHeroPageCountdown(experience, "professional-light", showCountdown);
  const theme = getPublicEventThemeClasses("professional-light");
  const [programDay, setProgramDay] = useState<number>(summary.programDays[0]?.dayIndex ?? 1);
  /**
   * Mobile hamburger drawer state. The drawer hosts the same section links as
   * the desktop nav strip; we hide the strip on `< md` and render the drawer
   * trigger instead. Auto-closes on anchor click and on Escape.
   */
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileMenuOpen]);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const titleScale = publicEventTitleClasses(summary.name);

  const hasResources = experience.resources.length > 0;
  const hasContact = hasAttendeeContact(experience.contact);
  const enquiryEmailConfigured = Boolean(experience.contact?.email?.trim());

  const mapsHref =
    summary.location.latitude != null && summary.location.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${summary.location.latitude},${summary.location.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(summary.location.address)}`;

  const calendar = useMemo(
    () =>
      buildPublicEventCalendarLinks({
        name: summary.name,
        date: summary.date,
        endDate: summary.endDate,
        locationLine: summary.locationLine,
        description: summary.description
      }),
    [summary.name, summary.date, summary.endDate, summary.locationLine, summary.description]
  );

  const agendaRows = useMemo(() => {
    if (experience.programMode === "PER_DAY") {
      const day = experience.agendaByDay.find((d) => d.dayIndex === programDay);
      return day?.items ?? [];
    }
    return experience.agenda;
  }, [experience, programDay]);

  function downloadAgendaPdf() {
    const html = buildAgendaPdfHtml({
      eventName: summary.name,
      orgName: summary.orgName,
      periodLabel: summary.periodLabel,
      locationLine: summary.locationLine,
      description: summary.description,
      experience
    });
    // NOTE: do NOT pass "noopener,noreferrer" here — it forces the new context to be
    // detached from the opener, returning null in modern browsers and preventing
    // document.write from reaching it. We need the handle to inject the agenda HTML.
    const w = window.open("", "_blank");
    if (!w) {
      alert("Please allow pop-ups to download the agenda PDF.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  const registerShell =
    "font-register-body space-y-4 text-zinc-900 [&_button[type=submit]]:mt-2 [&_button[type=submit]]:flex [&_button[type=submit]]:w-full [&_button[type=submit]]:items-center [&_button[type=submit]]:justify-center [&_button[type=submit]]:gap-2 [&_button[type=submit]]:rounded-lg [&_button[type=submit]]:bg-zinc-950 [&_button[type=submit]]:py-4 [&_button[type=submit]]:font-register-display [&_button[type=submit]]:text-base [&_button[type=submit]]:font-semibold [&_button[type=submit]]:text-white [&_button[type=submit]]:shadow-none [&_button[type=submit]]:hover:opacity-90 " +
    "[&_button[type=button]]:rounded-lg [&_label]:mb-1 [&_label]:block [&_label]:text-xs [&_label]:font-bold [&_label]:uppercase [&_label]:tracking-wider [&_label]:text-on-surface-variant " +
    "[&_input]:rounded-lg [&_input]:border [&_input]:border-transparent [&_input]:bg-surface-container [&_input]:px-4 [&_input]:py-3 [&_input]:text-base [&_input]:shadow-none [&_input]:ring-0 [&_input:focus]:border-[color:var(--accent)] " +
    "[&_select]:rounded-lg [&_select]:border [&_select]:border-transparent [&_select]:bg-surface-container [&_select]:px-4 [&_select]:py-3 [&_select]:text-base [&_select]:shadow-none [&_select]:ring-0 [&_select:focus]:border-[color:var(--accent)] " +
    "[&_.rounded-md.border]:border-outline-variant/50 [&_.rounded-md.border]:bg-surface-container-low";

  const cssVars = buildPublicEventCssVars("professional-light", brandColor);

  const aboutParas = descriptionParagraphs(summary.description);

  return (
    <div
      data-pe-scroll-root
      className={cn(themeRootClass("professional-light"), "relative min-h-screen", theme.page)}
      style={cssVars}
    >
      <PublicPageScrollEffects />
      <div className="relative z-[2]">
      <nav className="fixed top-0 z-50 w-full border-b border-outline-variant/30 bg-surface/90 font-register-display shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6 sm:px-8">
          <a
            href="#register-hero"
            className="flex min-w-0 max-w-[min(11rem,38vw)] shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 sm:max-w-[min(14rem,42vw)] sm:text-xl md:max-w-none"
            onClick={closeMobileMenu}
          >
            {summary.headerLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={summary.headerLogo} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />
            ) : (
              <Building2 className="h-6 w-6 shrink-0 text-accent" aria-hidden />
            )}
            <span className="truncate">{summary.orgName}</span>
          </a>
          <div
            role="navigation"
            aria-label="Page sections"
            className="hidden min-h-16 min-w-0 flex-1 items-center justify-center gap-6 md:flex md:gap-8"
          >
            {pageModel.navLinks.map((link) => (
              <a
                key={link.id}
                className={cn(
                  "shrink-0 whitespace-nowrap text-sm font-semibold text-zinc-600 transition hover:text-zinc-950",
                  link.id === "election" && "inline-flex items-center gap-2"
                )}
                href={`#${link.id}`}
                aria-label={link.id === "election" && electionLive ? "Election — voting is open now" : link.label}
              >
                {link.id === "election" && electionLive ? (
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                ) : null}
                {link.label}
                {link.id === "election" && electionLive ? (
                  <span className="ml-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-accent">
                    Live
                  </span>
                ) : null}
              </a>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              aria-controls="public-mobile-nav-summit"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 transition hover:border-zinc-300 hover:bg-zinc-50 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
            {registrationOpen ? (
              <a
                href="#register-hero"
                onClick={closeMobileMenu}
                className="shrink-0 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 sm:px-5"
              >
                Register
              </a>
            ) : (
              <span
                aria-disabled="true"
                title={eventOver ? "This event has ended" : "Registration is closed"}
                className="pointer-events-none shrink-0 cursor-not-allowed select-none rounded-lg bg-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-500 sm:px-5"
              >
                {eventOver ? "Event ended" : "Closed"}
              </span>
            )}
          </div>
        </div>
        {mobileMenuOpen ? (
          <div
            id="public-mobile-nav-summit"
            className="border-t border-outline-variant/30 bg-surface/95 backdrop-blur-md md:hidden"
            role="navigation"
            aria-label="Page sections (mobile)"
          >
            <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-3 sm:px-8">
              <li>
                <a
                  href="#overview"
                  onClick={closeMobileMenu}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-semibold text-zinc-800 transition hover:bg-surface-container-low hover:text-zinc-950"
                >
                  Overview
                  <ArrowRight className="h-4 w-4 text-zinc-400" aria-hidden />
                </a>
              </li>
              {hasProgram ? (
                <li>
                  <a
                    href="#program"
                    onClick={closeMobileMenu}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-semibold text-zinc-800 transition hover:bg-surface-container-low hover:text-zinc-950"
                  >
                    Program
                    <ArrowRight className="h-4 w-4 text-zinc-400" aria-hidden />
                  </a>
                </li>
              ) : null}
              {showVenueOps ? (
                <li>
                  <a
                    href="#venue-ops"
                    onClick={closeMobileMenu}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-semibold text-zinc-800 transition hover:bg-surface-container-low hover:text-zinc-950"
                  >
                    Venue
                    <ArrowRight className="h-4 w-4 text-zinc-400" aria-hidden />
                  </a>
                </li>
              ) : null}
              {hasSpeakers ? (
                <li>
                  <a
                    href="#speakers"
                    onClick={closeMobileMenu}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-semibold text-zinc-800 transition hover:bg-surface-container-low hover:text-zinc-950"
                  >
                    Speakers
                    <ArrowRight className="h-4 w-4 text-zinc-400" aria-hidden />
                  </a>
                </li>
              ) : null}
              {showResourcesSection ? (
                <li>
                  <a
                    href="#resources"
                    onClick={closeMobileMenu}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-semibold text-zinc-800 transition hover:bg-surface-container-low hover:text-zinc-950"
                  >
                    Resources
                    <ArrowRight className="h-4 w-4 text-zinc-400" aria-hidden />
                  </a>
                </li>
              ) : null}
              {showElection ? (
                <li>
                  <a
                    href="#election"
                    onClick={closeMobileMenu}
                    aria-label={electionLive ? "Election — voting is open now" : "Election"}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-semibold text-zinc-800 transition hover:bg-surface-container-low hover:text-zinc-950"
                  >
                    <span className="inline-flex items-center gap-2">
                      {electionLive ? (
                        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                        </span>
                      ) : null}
                      Election
                      {electionLive ? (
                        <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-accent">
                          Live
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight className="h-4 w-4 text-zinc-400" aria-hidden />
                  </a>
                </li>
              ) : null}
              {showContactSection ? (
                <li>
                  <a
                    href="#contact"
                    onClick={closeMobileMenu}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-semibold text-zinc-800 transition hover:bg-surface-container-low hover:text-zinc-950"
                  >
                    Contact
                    <ArrowRight className="h-4 w-4 text-zinc-400" aria-hidden />
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </nav>
      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={closeMobileMenu}
          className="fixed inset-x-0 bottom-0 top-16 z-40 cursor-default bg-black/30 md:hidden"
        />
      ) : null}

      <PublicEventHero
        summary={summary}
        experience={experience}
        variant="professional-light"
        eventOver={eventOver}
        brandColor={brandColor}
        onOpenRegister={() => {
          document.getElementById("register-hero")?.scrollIntoView({ behavior: "smooth" });
        }}
        registerSlot={
          <>
            <h3 className="font-register-display text-2xl font-bold tracking-tight">Register</h3>
            <p className="mt-2 font-register-body text-sm text-on-surface-variant">{summary.statusMessage}</p>
            <div className={cn("mt-8", registerShell)}>{children}</div>
            <p className="mt-4 text-center text-[11px] font-medium uppercase tracking-tight text-on-surface-variant">
              {TYPE_LABEL[summary.type]} · {summary.orgName}
            </p>
          </>
        }
      />

      <main className="mx-auto max-w-7xl space-y-24 px-6 py-16 sm:px-8 sm:py-20 lg:space-y-32">
                {showOverview ? (
          <SummitOverviewSection
            variant="summit-light"
            theme={theme}
            summary={summary}
            experience={experience}
            aboutParas={aboutParas}
            calendar={calendar}
            eventOver={eventOver}
          />
        ) : null}

        {showSpotlight ? (
          <PublicEventSpotlightSection
            experience={experience}
            theme={theme}
            variant="professional-light"
          />
        ) : null}

        {showPageCountdown ? (
          <PublicEventCountdownBandSection
            summary={summary}
            theme={theme}
            variant="professional-light"
            eventOver={eventOver}
          />
        ) : null}

                {hasProgram ? (
          <SummitProgramSection
            variant="summit-light"
            theme={theme}
            summary={summary}
            experience={experience}
            agendaRows={agendaRows}
            programDay={programDay}
            onProgramDayChange={setProgramDay}
          />
        ) : null}

        {showVenueOps ? (
          <SummitVenueOpsSection
            variant="summit-light"
            summary={summary}
            experience={experience}
            mapsHref={mapsHref}
            theme={theme}
          />
        ) : null}

        {hasSpeakers ? (
          <PublicEventSpeakersSection
            experience={experience}
            theme={theme}
            variant="professional-light"
          />
        ) : null}

        {showPartners ? (
          <PublicEventPartnersSection experience={experience} theme={theme} variant="professional-light" />
        ) : null}

        {showNews ? (
          <PublicEventNewsSection experience={experience} theme={theme} variant="professional-light" />
        ) : null}

        {showResourcesSection ? (
          <SummitResourcesSection
            experience={experience}
            theme={theme}
            hasProgram={hasProgram}
            onDownloadAgendaPdf={downloadAgendaPdf}
          />
        ) : null}

        {showPricing ? (
          <PublicEventPricingSection experience={experience} theme={theme} variant="professional-light" />
        ) : null}

        {showFaq ? (
          <SummitFaqSection variant="summit-light" experience={experience} theme={theme} />
        ) : null}

        {showElection && election ? (
          <PublicEventElectionSection election={election} dark={false} />
        ) : null}

                {showContactSection ? (
          <SummitContactSection
            summary={summary}
            experience={experience}
            theme={theme}
            enquiryEmailConfigured={enquiryEmailConfigured}
          />
        ) : null}

        {showGallery ? (
          <PublicEventGallerySection
            experience={experience}
            theme={theme}
            variant="professional-light"
            eventName={summary.name}
          />
        ) : null}

        </main>

      <SummitPublicFooter
        summary={summary}
        experience={experience}
        footerExtra={footerExtra}
        showContactSection={showContactSection}
        variant="professional-light"
      />
      </div>
    </div>
  );
}
