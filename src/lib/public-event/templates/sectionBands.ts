import { PUBLIC_EVENT_SECTION_IDS, type PublicEventSectionId } from "./sectionIds";
import type { PublicEventExperiencePayload } from "../experience";

export type PublicSectionBand = "base" | "alt";

export type SectionBandPattern = "zebra" | "all_base" | "all_alt" | "minimal";
export type SectionContrast = "subtle" | "medium" | "bold";

/** Visibility flags used to compute alternating section backgrounds. */
export type TechnexusBandPageFlags = {
  showCountdown: boolean;
  showOverview: boolean;
  showSpotlight: boolean;
  hasSpeakers: boolean;
  hasProgram: boolean;
  showPartners: boolean;
  showNews: boolean;
  showVenueOps: boolean;
  showResourcesSection: boolean;
  showPricing: boolean;
  showElection: boolean;
  showFaq: boolean;
  showContactSection: boolean;
  showGallery: boolean;
};

export function technexusBandClass(band: PublicSectionBand, contrast: SectionContrast = "subtle"): string {
  const base = band === "alt" ? "tn-section-band-alt" : "tn-section-band-base";
  if (contrast === "bold") return `${base} tn-section-band--bold`;
  if (contrast === "medium") return `${base} tn-section-band--medium`;
  return base;
}

type BuildTechnexusBandsInput = {
  flags: TechnexusBandPageFlags;
  hasProgramContent: boolean;
  hasElection: boolean;
};

/** Visible main sections in TechNexus render order (after hero). */
export function technexusVisibleMainSectionIds(input: BuildTechnexusBandsInput): PublicEventSectionId[] {
  const m = input.flags;
  const { hasProgramContent, hasElection } = input;
  const ids: PublicEventSectionId[] = [];

  if (m.showCountdown) ids.push(PUBLIC_EVENT_SECTION_IDS.countdown);
  if (m.showOverview) ids.push(PUBLIC_EVENT_SECTION_IDS.overview);
  if (m.showSpotlight) ids.push(PUBLIC_EVENT_SECTION_IDS.spotlight);
  if (m.hasSpeakers) ids.push(PUBLIC_EVENT_SECTION_IDS.speakers);
  if (m.hasProgram && hasProgramContent) ids.push(PUBLIC_EVENT_SECTION_IDS.program);
  if (m.showPartners) ids.push(PUBLIC_EVENT_SECTION_IDS.partners);
  if (m.showNews) ids.push(PUBLIC_EVENT_SECTION_IDS.news);
  if (m.showVenueOps) ids.push(PUBLIC_EVENT_SECTION_IDS.venueOps);
  if (m.showResourcesSection) ids.push(PUBLIC_EVENT_SECTION_IDS.resources);
  if (m.showPricing) ids.push(PUBLIC_EVENT_SECTION_IDS.pricing);
  if (m.showElection && hasElection) ids.push(PUBLIC_EVENT_SECTION_IDS.election);
  if (m.showFaq) ids.push(PUBLIC_EVENT_SECTION_IDS.faq);
  if (m.showContactSection) ids.push(PUBLIC_EVENT_SECTION_IDS.contact);
  if (m.showGallery) ids.push(PUBLIC_EVENT_SECTION_IDS.gallery);

  return ids;
}

/** Alternating base/alt bands for only the sections that render on the public page. */
export function buildTechnexusSectionBands(
  input: BuildTechnexusBandsInput,
  themeCustomization?: PublicEventExperiencePayload["themeCustomization"]
): Partial<Record<PublicEventSectionId, PublicSectionBand>> {
  const map: Partial<Record<PublicEventSectionId, PublicSectionBand>> = {};
  const visible = technexusVisibleMainSectionIds(input);
  const pattern = themeCustomization?.sectionBandPattern ?? "zebra";

  visible.forEach((id, index) => {
    if (pattern === "all_base") map[id] = "base";
    else if (pattern === "all_alt") map[id] = "alt";
    else if (pattern === "minimal") map[id] = "base";
    else map[id] = index % 2 === 0 ? "base" : "alt";
  });
  return map;
}

export function resolveTechnexusSectionBand(
  bands: Partial<Record<PublicEventSectionId, PublicSectionBand>>,
  sectionId: PublicEventSectionId,
  fallback: PublicSectionBand = "base"
): PublicSectionBand {
  return bands[sectionId] ?? fallback;
}

export function technexusSectionBandClassName(
  bands: Partial<Record<PublicEventSectionId, PublicSectionBand>>,
  sectionId: PublicEventSectionId,
  fallback: PublicSectionBand = "base",
  contrast: SectionContrast = "subtle"
): string {
  return technexusBandClass(resolveTechnexusSectionBand(bands, sectionId, fallback), contrast);
}

/** Footer band contrasts with the last visible main section. */
export function technexusFooterBandClassName(
  input: BuildTechnexusBandsInput,
  bands: Partial<Record<PublicEventSectionId, PublicSectionBand>>,
  contrast: SectionContrast = "subtle"
): string {
  const visible = technexusVisibleMainSectionIds(input);
  if (visible.length === 0) return technexusBandClass("alt", contrast);
  const lastId = visible[visible.length - 1]!;
  const lastBand = resolveTechnexusSectionBand(bands, lastId);
  return technexusBandClass(lastBand === "base" ? "alt" : "base", contrast);
}
