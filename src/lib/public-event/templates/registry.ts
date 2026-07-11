import { PublicPageTemplate } from "@prisma/client";

import { PUBLIC_EVENT_SECTION_IDS, type PublicEventSectionId } from "./sectionIds";

export { PUBLIC_EVENT_SECTION_IDS, PUBLIC_EVENT_MAIN_SECTION_ORDER } from "./sectionIds";
export type { PublicEventNavLink, PublicEventSectionId } from "./sectionIds";

export type PublicTemplateDefinition = {
  id: PublicPageTemplate;
  /** Dashboard label */
  label: string;
  description: string;
  /** Whether attendeeTheme light/dark applies (Template 1 only). */
  supportsColorMode: boolean;
};

export const PUBLIC_PAGE_TEMPLATES: Record<PublicPageTemplate, PublicTemplateDefinition> = {
  [PublicPageTemplate.SUMMIT]: {
    id: PublicPageTemplate.SUMMIT,
    label: "Template 1 — Summit",
    description: "Professional split hero with registration card. Choose light or dark color mode.",
    supportsColorMode: true
  },
  [PublicPageTemplate.NIGHT_EDITION]: {
    id: PublicPageTemplate.NIGHT_EDITION,
    label: "Template 2 — Night Edition",
    description: "Full-bleed cinematic layout with glass navigation, gradient hero, and MD3 accents.",
    supportsColorMode: false
  },
  [PublicPageTemplate.TECH_NEXUS]: {
    id: PublicPageTemplate.TECH_NEXUS,
    label: "Template 3 — TechNexus",
    description:
      "Electric blue MD3 dark theme with glass cards, hero countdown, tabbed program, and masonry gallery.",
    supportsColorMode: false
  }
};

/** Preferred section order per template (canonical ids). */
export const TEMPLATE_SECTION_ORDER: Record<PublicPageTemplate, PublicEventSectionId[]> = {
  [PublicPageTemplate.SUMMIT]: [
    PUBLIC_EVENT_SECTION_IDS.overview,
    PUBLIC_EVENT_SECTION_IDS.spotlight,
    PUBLIC_EVENT_SECTION_IDS.countdown,
    PUBLIC_EVENT_SECTION_IDS.program,
    PUBLIC_EVENT_SECTION_IDS.speakers,
    PUBLIC_EVENT_SECTION_IDS.partners,
    PUBLIC_EVENT_SECTION_IDS.news,
    PUBLIC_EVENT_SECTION_IDS.resources,
    PUBLIC_EVENT_SECTION_IDS.pricing,
    PUBLIC_EVENT_SECTION_IDS.election,
    PUBLIC_EVENT_SECTION_IDS.contact
  ],
  [PublicPageTemplate.NIGHT_EDITION]: [
    PUBLIC_EVENT_SECTION_IDS.spotlight,
    PUBLIC_EVENT_SECTION_IDS.countdown,
    PUBLIC_EVENT_SECTION_IDS.partners,
    PUBLIC_EVENT_SECTION_IDS.news,
    PUBLIC_EVENT_SECTION_IDS.program,
    PUBLIC_EVENT_SECTION_IDS.speakers,
    PUBLIC_EVENT_SECTION_IDS.overview,
    PUBLIC_EVENT_SECTION_IDS.resources,
    PUBLIC_EVENT_SECTION_IDS.pricing,
    PUBLIC_EVENT_SECTION_IDS.election,
    PUBLIC_EVENT_SECTION_IDS.faq,
    PUBLIC_EVENT_SECTION_IDS.contact
  ],
  [PublicPageTemplate.TECH_NEXUS]: [
    PUBLIC_EVENT_SECTION_IDS.overview,
    PUBLIC_EVENT_SECTION_IDS.countdown,
    PUBLIC_EVENT_SECTION_IDS.spotlight,
    PUBLIC_EVENT_SECTION_IDS.speakers,
    PUBLIC_EVENT_SECTION_IDS.program,
    PUBLIC_EVENT_SECTION_IDS.partners,
    PUBLIC_EVENT_SECTION_IDS.news,
    PUBLIC_EVENT_SECTION_IDS.venueOps,
    PUBLIC_EVENT_SECTION_IDS.resources,
    PUBLIC_EVENT_SECTION_IDS.pricing,
    PUBLIC_EVENT_SECTION_IDS.election,
    PUBLIC_EVENT_SECTION_IDS.faq,
    PUBLIC_EVENT_SECTION_IDS.contact,
    PUBLIC_EVENT_SECTION_IDS.gallery
  ]
};

export function publicPageTemplateLabel(template: PublicPageTemplate): string {
  return PUBLIC_PAGE_TEMPLATES[template].label;
}
