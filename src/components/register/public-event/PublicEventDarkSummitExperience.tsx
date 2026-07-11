"use client";

import { EventType } from "@prisma/client";
import {
  Accessibility,
  ArrowRight,
  Building2,
  Calendar,
  Car,
  Copy,
  Download,
  FileText,
  Globe,
  HelpCircle,
  Mail,
  MapPin,
  Menu,
  Phone,
  Presentation,
  Rocket,
  User,
  Wifi,
  X
} from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";

import { PublicEventElectionSection } from "./PublicEventElectionSection";
import { PublicEventEnquiryForm } from "./PublicEventEnquiryForm";
import { PublicEventCountdown } from "./PublicEventCountdown";
import type { PublicElectionView } from "@/lib/public-event/electionView";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { buildAgendaPdfHtml } from "@/lib/public-event/agendaPdfHtml";
import { buildPublicEventCalendarLinks } from "@/lib/public-event/calendarLinks";
import { SUMMIT_PUBLIC_HERO_TAGLINE } from "@/lib/public-event/summitPublicCopy";
import { readableAccentForDarkBg, readableTextOn } from "@/lib/ui/contrastColor";
import { publicEventTitleClasses } from "@/lib/ui/eventHeroTitle";
import { Modal } from "@/components/ui/Modal";
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
import { SummitOverviewSection } from "./sections/summit/SummitOverviewSection";
import { SummitProgramSection } from "./sections/summit/SummitProgramSection";
import { SummitResourcesContactSection } from "./sections/summit/SummitResourcesContactSection";
import { SummitPublicFooter } from "./sections/shared/SummitPublicFooter";
import { descriptionParagraphs, hasAttendeeContact } from "./sections/summit/summitSectionUtils";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import {
  buildPublicEventCssVars,
  getPublicEventThemeClasses,
  themeRootClass
} from "@/lib/public-event/templates/theme";

import { PublicPageScrollEffects } from "./PublicPageScrollEffects";
import type { PublicEventSiteSummary } from "./siteSummary";

type PublicEventDarkSummitExperienceProps = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  brandColor?: string;
  footerExtra?: string | null;
  registrationOpen?: boolean;
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

type SpeakerRow = PublicEventExperiencePayload["speakers"][number];

function speakerAvatar(s: { name: string; imageUrl?: string | null }) {
  const initials = s.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (s.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={s.imageUrl}
        alt=""
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-2xl font-bold text-white">
      {initials}
    </span>
  );
}

export function PublicEventDarkSummitExperience({
  summary,
  experience,
  brandColor,
  footerExtra,
  registrationOpen = true,
  eventOver = false,
  election = null,
  children
}: PublicEventDarkSummitExperienceProps) {
  const [programDay, setProgramDay] = useState<number>(summary.programDays[0]?.dayIndex ?? 1);
  const [speakerModal, setSpeakerModal] = useState<SpeakerRow | null>(null);
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
  /**
   * Per-section visibility flags (organizer-controlled in the Public experience
   * editor). When a flag is `false` we hide BOTH the corresponding nav link AND
   * the body section, without clearing the underlying content.
   */
  const pageModel = usePublicEventPageModel(summary, experience, election);
  const {
    showOverview,
    showSpotlight,
    showCountdown,
    hasProgram,
    hasSpeakers,
    showPartners,
    showNews,
    showGallery,
    showResourcesSection,
    showPricing,
    showElection,
    electionLive,
    showContactSection
  } = pageModel;
  const showPageCountdown = shouldShowHeroPageCountdown(experience, "summit-dark", showCountdown);
  const theme = getPublicEventThemeClasses("summit-dark");

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
    const w = window.open("", "_blank");
    if (!w) {
      alert("Please allow pop-ups to download the agenda PDF.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // Brand colors can be very dark (e.g. `#120575` — invisible on a dark page). We lift the
  // *display* accent to a guaranteed-readable lightness while keeping the original brand color
  // around for any place we might need it.
  const rawBrand = brandColor?.trim() || "#4cd7f6";
  const accent = readableAccentForDarkBg(rawBrand);
  // Bright accents (e.g. `#fffc41`) wash out white text on accent-filled buttons. Pick the
  // readable foreground (near-black or white) once and expose it as a CSS var.
  const accentFg = readableTextOn(accent);
  const cssVars = buildPublicEventCssVars("summit-dark", brandColor);

  const registerShell =
    "[&_button[type=submit]]:!bg-[color:var(--pe-accent)] [&_button[type=submit]]:!text-[color:var(--pe-accent-fg)] [&_button[type=submit]]:!py-3.5 [&_button[type=submit]]:!shadow-lg [&_button[type=submit]]:hover:!opacity-90 [&_label]:text-[var(--pe-on-surface-variant)] [&_input]:rounded-lg [&_input]:border [&_input]:border-[var(--pe-outline-variant)] [&_input]:bg-[var(--pe-surface-container-high)] [&_input]:text-[var(--pe-on-surface)] [&_input]:placeholder:text-[var(--pe-on-surface-variant)] [&_p]:text-[var(--pe-on-surface-variant)] [&_strong]:text-[var(--pe-on-surface)]";

  const parking = experience.venue?.parkingInfo?.trim() ?? null;
  const access = experience.venue?.accessInfo?.trim() ?? null;
  const aboutParas = descriptionParagraphs(summary.description);

  const pageBackdropStyle: CSSProperties = {
    ...cssVars,
    backgroundColor: "var(--pe-background)",
    backgroundImage: [
      `radial-gradient(ellipse 70% 55% at 85% -5%, color-mix(in srgb, ${accent} 18%, transparent), transparent 60%)`,
      `radial-gradient(ellipse 80% 60% at 0% 65%, color-mix(in srgb, ${accent} 10%, transparent), transparent 55%)`,
      `radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--pe-gradient-to) 12%, transparent), transparent 60%)`
    ].join(", "),
    backgroundAttachment: "fixed"
  };

  return (
    <div
      data-pe-scroll-root
      className={cn(
        themeRootClass("summit-dark"),
        "relative min-h-screen overflow-x-hidden antialiased selection:bg-[color:var(--pe-accent)]/30",
        theme.page
      )}
      style={pageBackdropStyle}
    >
      <PublicPageScrollEffects />
      <div className="relative z-[2]">
      {/* Sticky top nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-zinc-950/80 shadow-lg backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6 sm:px-8">
          <a
            href="#register-hero"
            className="flex min-w-0 max-w-[min(11rem,38vw)] shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-zinc-100 sm:max-w-[min(14rem,42vw)] sm:text-xl md:max-w-none"
            onClick={closeMobileMenu}
          >
            {summary.headerLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={summary.headerLogo} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />
            ) : (
              <Building2 className="h-6 w-6 shrink-0 text-[color:var(--accent)]" aria-hidden />
            )}
            <span className="truncate">{summary.orgName}</span>
          </a>
          <div
            role="navigation"
            aria-label="Page sections"
            className="hidden min-h-16 min-w-0 flex-1 items-center justify-center gap-6 md:flex md:gap-7"
          >
            <a
              className="shrink-0 whitespace-nowrap border-b-2 border-[color:var(--accent)] pb-1 text-xs font-bold uppercase tracking-widest text-[color:var(--accent)] transition"
              href="#overview"
            >
              Overview
            </a>
            {hasProgram ? (
              <a
                className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 transition hover:text-zinc-100"
                href="#program"
              >
                Program
              </a>
            ) : null}
            {hasSpeakers ? (
              <a
                className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 transition hover:text-zinc-100"
                href="#speakers"
              >
                Speakers
              </a>
            ) : null}
            {showResourcesSection ? (
              <a
                className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 transition hover:text-zinc-100"
                href="#resources"
              >
                Resources
              </a>
            ) : null}
            {showElection ? (
              <a
                className="relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 transition hover:text-zinc-100"
                href="#election"
                aria-label={electionLive ? "Election — voting is open now" : "Election"}
              >
                {electionLive ? (
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                ) : null}
                Election
                {electionLive ? (
                  <span className="ml-1 rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-accent">
                    Live
                  </span>
                ) : null}
              </a>
            ) : null}
            {showContactSection ? (
              <a
                className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 transition hover:text-zinc-100"
                href="#contact"
              >
                Contact
              </a>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              aria-controls="public-mobile-nav-dark"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-100 transition hover:border-white/30 hover:bg-white/10 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
            {registrationOpen ? (
              <a
                href="#register-hero"
                onClick={closeMobileMenu}
                className="shrink-0 rounded-full bg-[color:var(--accent)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--accent-fg)] shadow-md transition hover:opacity-90 active:scale-95"
              >
                Register
              </a>
            ) : (
              <span
                aria-disabled="true"
                title={eventOver ? "This event has ended" : "Registration is closed"}
                className="pointer-events-none shrink-0 cursor-not-allowed select-none rounded-full bg-zinc-800 px-5 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500"
              >
                {eventOver ? "Event ended" : "Closed"}
              </span>
            )}
          </div>
        </div>
        {mobileMenuOpen ? (
          <div
            id="public-mobile-nav-dark"
            className="border-t border-white/10 bg-zinc-950/95 backdrop-blur-md md:hidden"
            role="navigation"
            aria-label="Page sections (mobile)"
          >
            <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-3 sm:px-8">
              <li>
                <a
                  href="#overview"
                  onClick={closeMobileMenu}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-widest text-zinc-200 transition hover:bg-white/5 hover:text-white"
                >
                  Overview
                  <ArrowRight className="h-4 w-4 text-zinc-500" aria-hidden />
                </a>
              </li>
              {hasProgram ? (
                <li>
                  <a
                    href="#program"
                    onClick={closeMobileMenu}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-widest text-zinc-200 transition hover:bg-white/5 hover:text-white"
                  >
                    Program
                    <ArrowRight className="h-4 w-4 text-zinc-500" aria-hidden />
                  </a>
                </li>
              ) : null}
              {hasSpeakers ? (
                <li>
                  <a
                    href="#speakers"
                    onClick={closeMobileMenu}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-widest text-zinc-200 transition hover:bg-white/5 hover:text-white"
                  >
                    Speakers
                    <ArrowRight className="h-4 w-4 text-zinc-500" aria-hidden />
                  </a>
                </li>
              ) : null}
              {showResourcesSection ? (
                <li>
                  <a
                    href="#resources"
                    onClick={closeMobileMenu}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-widest text-zinc-200 transition hover:bg-white/5 hover:text-white"
                  >
                    Resources
                    <ArrowRight className="h-4 w-4 text-zinc-500" aria-hidden />
                  </a>
                </li>
              ) : null}
              {showElection ? (
                <li>
                  <a
                    href="#election"
                    onClick={closeMobileMenu}
                    aria-label={electionLive ? "Election — voting is open now" : "Election"}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-widest text-zinc-200 transition hover:bg-white/5 hover:text-white"
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
                        <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-accent">
                          Live
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight className="h-4 w-4 text-zinc-500" aria-hidden />
                  </a>
                </li>
              ) : null}
              {showContactSection ? (
                <li>
                  <a
                    href="#contact"
                    onClick={closeMobileMenu}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-widest text-zinc-200 transition hover:bg-white/5 hover:text-white"
                  >
                    Contact
                    <ArrowRight className="h-4 w-4 text-zinc-500" aria-hidden />
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
          className="fixed inset-x-0 bottom-0 top-16 z-40 cursor-default bg-black/50 md:hidden"
        />
      ) : null}

      <PublicEventHero
        summary={summary}
        experience={experience}
        variant="summit-dark"
        eventOver={eventOver}
        brandColor={brandColor}
        onOpenRegister={() => {
          document.getElementById("register-hero")?.scrollIntoView({ behavior: "smooth" });
        }}
        registerSlot={
          <>
            <h3 className="font-register-display text-2xl font-bold tracking-tight text-[var(--pe-on-surface)]">
              {summary.registerTabLabel}
            </h3>
            <p className="mt-2 font-register-body text-sm text-[var(--pe-on-surface-variant)]">
              {summary.statusMessage}
            </p>
            <div className={cn("mt-8", registerShell)}>{children}</div>
            <p className="mt-4 text-center text-[11px] font-medium uppercase tracking-tight text-[var(--pe-on-surface-variant)]">
              {TYPE_LABEL[summary.type]} · {summary.orgName}
            </p>
          </>
        }
      />

      {/* Body */}
      <main className="mx-auto max-w-7xl space-y-20 px-6 py-16 sm:px-8 sm:py-20 lg:space-y-28">
        {/* About + sidebar */}
                {showOverview ? (
          <SummitOverviewSection
            variant="summit-dark"
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
            variant="summit-dark"
          />
        ) : null}

        {showPageCountdown ? (
          <PublicEventCountdownBandSection
            summary={summary}
            theme={theme}
            variant="summit-dark"
            eventOver={eventOver}
          />
        ) : null}

        {/* Program / Agenda */}
                {hasProgram ? (
          <SummitProgramSection
            variant="summit-dark"
            summary={summary}
            experience={experience}
            agendaRows={agendaRows}
            programDay={programDay}
            onProgramDayChange={setProgramDay}
          />
        ) : null}

        {hasSpeakers ? (
          <PublicEventSpeakersSection experience={experience} theme={theme} variant="summit-dark" />
        ) : null}

        {showPartners ? (
          <PublicEventPartnersSection experience={experience} theme={theme} variant="summit-dark" />
        ) : null}

        {showNews ? (
          <PublicEventNewsSection experience={experience} theme={theme} variant="summit-dark" />
        ) : null}

        {showPricing ? (
          <PublicEventPricingSection experience={experience} theme={theme} variant="summit-dark" />
        ) : null}

        {showElection && election ? (
          <PublicEventElectionSection election={election} dark={true} />
        ) : null}

        {/* Resources + Contact (split row) */}
                {showResourcesSection || showContactSection ? (
          <SummitResourcesContactSection
            summary={summary}
            experience={experience}
            showResourcesSection={showResourcesSection}
            showContactSection={showContactSection}
            hasProgram={hasProgram}
            onDownloadAgendaPdf={downloadAgendaPdf}
            enquiryEmailConfigured={enquiryEmailConfigured}
          />
        ) : null}

        {showGallery ? (
          <PublicEventGallerySection
            experience={experience}
            theme={theme}
            variant="summit-dark"
            eventName={summary.name}
          />
        ) : null}

        </main>

      <SummitPublicFooter
        summary={summary}
        experience={experience}
        footerExtra={footerExtra}
        showContactSection={showContactSection}
        variant="summit-dark"
      />

      <Modal
        open={speakerModal != null}
        title="Expert profile"
        subtitle={speakerModal ? `${speakerModal.name} · ${speakerModal.title}` : undefined}
        onClose={() => setSpeakerModal(null)}
        size="lg"
      >
        {speakerModal ? (
          <div className="space-y-4">
            {speakerModal.company?.trim() ? (
              <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: accent }}>
                {speakerModal.company}
              </p>
            ) : null}
            <div className="max-w-none text-zinc-800">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{speakerModal.bio}</p>
            </div>
          </div>
        ) : null}
      </Modal>
      </div>
    </div>
  );
}
