import type { PublicEventTemplateVariant } from "./templates/designTokens";

/** Configurable full-section hero layout styles. */
export const PUBLIC_EVENT_HERO_STYLES = [
  "brand_overlay",
  "conference",
  "long_title",
  "no_image",
  "image",
  "gradient_overlay",
  "video_countdown",
  "split_multimedia",
  "sponsor_first",
  "glass_geometric"
] as const;

export type PublicEventHeroStyle = (typeof PUBLIC_EVENT_HERO_STYLES)[number];

export const PUBLIC_EVENT_HERO_STYLE_LABELS: Record<PublicEventHeroStyle, string> = {
  brand_overlay: "Brand image overlay (template default)",
  conference: "Standard conference (split with registration)",
  long_title: "Long event titles",
  no_image: "No image (typography focus)",
  image: "Standard featured image",
  gradient_overlay: "Gradient overlay on image",
  video_countdown: "Video background + countdown",
  split_multimedia: "Split-screen multimedia",
  sponsor_first: "Sponsor & partner first",
  glass_geometric: "Glassmorphism / geometric"
};

export function defaultHeroStyleForVariant(variant: PublicEventTemplateVariant): PublicEventHeroStyle {
  if (variant === "professional-light" || variant === "summit-dark") return "conference";
  if (variant === "technexus-dark" || variant === "technexus-light") return "brand_overlay";
  return "gradient_overlay";
}

export function resolveHeroStyle(
  configured: PublicEventHeroStyle | null | undefined,
  variant: PublicEventTemplateVariant
): PublicEventHeroStyle {
  return configured ?? defaultHeroStyleForVariant(variant);
}

/** Page countdown visibility — independent of hero layout style. */
export function shouldShowHeroPageCountdown(
  _experience: { hero?: { style?: PublicEventHeroStyle | null } | null },
  _variant: PublicEventTemplateVariant,
  visibilityCountdown: boolean
): boolean {
  return visibilityCountdown;
}
