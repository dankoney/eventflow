/**
 * Canonical public event page section IDs.
 * Professional Light and Night Edition templates MUST use these exact ids so
 * organizers can switch themes without breaking in-page navigation or CMS mapping.
 */
export const PUBLIC_EVENT_SECTION_IDS = {
  /** Hero registration card anchor (inside `<header>`). */
  registerHero: "register-hero",
  overview: "overview",
  /** Host nation / city spotlight with media background and stats. */
  spotlight: "spotlight",
  /** Full-width countdown band (optional; hero may also show a compact countdown). */
  countdown: "countdown",
  program: "program",
  /** On-site logistics: parking, accessibility, Wi‑Fi, maps. */
  venueOps: "venue-ops",
  speakers: "speakers",
  partners: "partners",
  news: "news",
  gallery: "gallery",
  resources: "resources",
  pricing: "pricing",
  election: "election",
  faq: "faq",
  contact: "contact"
} as const;

export type PublicEventSectionId =
  (typeof PUBLIC_EVENT_SECTION_IDS)[keyof typeof PUBLIC_EVENT_SECTION_IDS];

/** Main content order (excludes register-hero which lives in the header). */
export const PUBLIC_EVENT_MAIN_SECTION_ORDER: PublicEventSectionId[] = [
  PUBLIC_EVENT_SECTION_IDS.overview,
  PUBLIC_EVENT_SECTION_IDS.spotlight,
  PUBLIC_EVENT_SECTION_IDS.countdown,
  PUBLIC_EVENT_SECTION_IDS.program,
  PUBLIC_EVENT_SECTION_IDS.venueOps,
  PUBLIC_EVENT_SECTION_IDS.speakers,
  PUBLIC_EVENT_SECTION_IDS.partners,
  PUBLIC_EVENT_SECTION_IDS.news,
  PUBLIC_EVENT_SECTION_IDS.gallery,
  PUBLIC_EVENT_SECTION_IDS.resources,
  PUBLIC_EVENT_SECTION_IDS.pricing,
  PUBLIC_EVENT_SECTION_IDS.election,
  PUBLIC_EVENT_SECTION_IDS.faq,
  PUBLIC_EVENT_SECTION_IDS.contact
];

export type PublicEventNavLink = {
  id: PublicEventSectionId;
  label: string;
};
