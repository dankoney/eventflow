/**
 * Public event modular template system — design tokens, section registry, and theme helpers.
 *
 * - Professional Light: `AttendeeTheme.LIGHT` → `professional-light` variant
 * - Night Edition: dedicated `night-edition` variant
 * - TechNexus: Template 3 — `technexus-dark` variant
 *
 * Both templates share canonical section ids from `sectionIds.ts`.
 */
export {
  PUBLIC_EVENT_MAIN_SECTION_ORDER,
  PUBLIC_EVENT_SECTION_IDS,
  type PublicEventNavLink,
  type PublicEventSectionId
} from "./sectionIds";
export {
  designTokensForVariant,
  NIGHT_EDITION_TOKENS,
  PROFESSIONAL_LIGHT_TOKENS,
  TECH_NEXUS_TOKENS,
  TECH_NEXUS_LIGHT_TOKENS,
  themeRootClass,
  type PublicEventDesignTokens,
  type PublicEventTemplateVariant
} from "./designTokens";
export {
  buildPublicEventCssVars,
  getPublicEventThemeClasses,
  type PublicEventThemeClasses
} from "./theme";
