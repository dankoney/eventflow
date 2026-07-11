import type { PublicEventTemplateVariant } from "./designTokens";
import type { SummitColorMode } from "./resolveColorMode";

export function resolveTechnexusTemplateVariant(
  colorMode: SummitColorMode
): "technexus-dark" | "technexus-light" {
  return colorMode === "light" ? "technexus-light" : "technexus-dark";
}

export function isTechnexusTemplateVariant(
  variant: PublicEventTemplateVariant
): variant is "technexus-dark" | "technexus-light" {
  return variant === "technexus-dark" || variant === "technexus-light";
}

export function isTechnexusDarkVariant(variant: PublicEventTemplateVariant): boolean {
  return variant === "technexus-dark";
}
