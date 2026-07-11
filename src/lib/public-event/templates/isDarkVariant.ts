import type { PublicEventTemplateVariant } from "./designTokens";

export function isDarkPublicVariant(variant: PublicEventTemplateVariant): boolean {
  return variant === "night-edition" || variant === "technexus-dark" || variant === "summit-dark";
}

export function isTechnexusPublicVariant(variant: PublicEventTemplateVariant): boolean {
  return variant === "technexus-dark" || variant === "technexus-light";
}
