"use client";

import { useMemo } from "react";

import type { PublicElectionView } from "@/lib/public-event/electionView";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import {
  PUBLIC_EVENT_SECTION_IDS,
  type PublicEventNavLink,
  type PublicEventSectionId
} from "@/lib/public-event/templates/sectionIds";

import { usePublicEventTranslationOptional } from "../i18n/PublicEventTranslationProvider";
import type { PublicEventSiteSummary } from "../siteSummary";

export type PublicEventPageModel = {
  visibility: PublicEventExperiencePayload["sectionVisibility"];
  showOverview: boolean;
  showSpotlight: boolean;
  showCountdown: boolean;
  hasProgram: boolean;
  showVenueOps: boolean;
  hasSpeakers: boolean;
  showPartners: boolean;
  showNews: boolean;
  showGallery: boolean;
  showResourcesSection: boolean;
  showPricing: boolean;
  showElection: boolean;
  electionLive: boolean;
  showContactSection: boolean;
  showFaq: boolean;
  navLinks: PublicEventNavLink[];
};

function hasSpotlightContent(experience: PublicEventExperiencePayload): boolean {
  const s = experience.spotlight;
  return Boolean(
    s?.title?.trim() ||
      s?.description?.trim() ||
      s?.backgroundImageUrl?.trim() ||
      s?.backgroundVideoUrl?.trim() ||
      s?.carouselItems?.length ||
      s?.stats?.length
  );
}

function hasAttendeeContact(c: PublicEventExperiencePayload["contact"] | null | undefined): boolean {
  if (!c) return false;
  return Boolean(
    c.heading?.trim() ||
      c.contactName?.trim() ||
      c.email?.trim() ||
      c.phone?.trim() ||
      c.website?.trim() ||
      c.note?.trim()
  );
}

export function usePublicEventPageModel(
  summary: PublicEventSiteSummary,
  experience: PublicEventExperiencePayload,
  election: PublicElectionView | null | undefined
): PublicEventPageModel {
  const translation = usePublicEventTranslationOptional();
  const t = translation?.t;

  return useMemo(() => {
    const visibility = experience.sectionVisibility;
    const hasProgramContent =
      experience.programMode === "PER_DAY"
        ? experience.agendaByDay.some((d) => d.items.length > 0)
        : experience.agenda.length > 0;

    const showOverview = visibility.overview;
    const showSpotlight = visibility.spotlight && hasSpotlightContent(experience);
    const showCountdown = visibility.countdown;
    const hasProgram = visibility.program && hasProgramContent;
    const hasVenueOpsContent = Boolean(
      experience.venue?.wifiSsid?.trim() ||
        experience.venue?.wifiPassword?.trim() ||
        experience.venue?.wifiNote?.trim() ||
        experience.venue?.parkingInfo?.trim() ||
        experience.venue?.accessInfo?.trim()
    );
    const showVenueOps = visibility.venueOps !== false && hasVenueOpsContent;
    const hasSpeakers = visibility.speakers && experience.speakers.length > 0;
    const showPartners = visibility.partners && experience.partners.length > 0;
    const showNews = visibility.news && experience.newsItems.length > 0;
    const showGallery =
      visibility.gallery && experience.galleryItems.some((g) => Boolean(g.imageUrl?.trim()));
    const hasResources = experience.resources.length > 0;
    const showResourcesSection = visibility.resources && (hasResources || hasProgram);
    const showPricing = visibility.pricing && experience.pricingTiers.length > 0;
    const showElection = visibility.election && Boolean(election && election.positions.length > 0);
    const electionLive = Boolean(showElection && election?.isOpen);
    const enquiryEmailConfigured = Boolean(experience.contact?.email?.trim());
    const showContactSection =
      visibility.contact && (hasAttendeeContact(experience.contact) || enquiryEmailConfigured);
    const showFaq = visibility.faq && experience.faqItems.length > 0;

    const navLinks: PublicEventNavLink[] = [];
    const push = (id: PublicEventSectionId, label: string, visible: boolean) => {
      if (visible) navLinks.push({ id, label });
    };

    /* Overview, spotlight, countdown, partners, and gallery render on-page but stay out of nav (like countdown). */
    push(PUBLIC_EVENT_SECTION_IDS.program, t?.("nav.program") ?? "Program", hasProgram);
    push(PUBLIC_EVENT_SECTION_IDS.venueOps, t?.("nav.venue") ?? "Venue", showVenueOps);
    push(PUBLIC_EVENT_SECTION_IDS.speakers, t?.("nav.speakers") ?? "Speakers", hasSpeakers);
    push(PUBLIC_EVENT_SECTION_IDS.news, t?.("nav.news") ?? "News", showNews);
    push(PUBLIC_EVENT_SECTION_IDS.resources, t?.("nav.resources") ?? "Resources", showResourcesSection);
    push(PUBLIC_EVENT_SECTION_IDS.pricing, t?.("nav.pricing") ?? "Pricing", showPricing);
    push(PUBLIC_EVENT_SECTION_IDS.election, t?.("nav.election") ?? "Election", showElection);
    push(PUBLIC_EVENT_SECTION_IDS.faq, t?.("nav.faq") ?? "FAQ", showFaq);
    push(PUBLIC_EVENT_SECTION_IDS.contact, t?.("nav.contact") ?? "Contact", showContactSection);

    return {
      visibility,
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
      showFaq,
      navLinks
    };
  }, [summary, experience, election, t]);
}
