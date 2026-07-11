import type { CSSProperties } from "react";

import type { PublicEventExperiencePayload } from "./experience";

import { SUMMIT_PUBLIC_HERO_TAGLINE } from "./summitPublicCopy";

export type HeroConfig = PublicEventExperiencePayload["hero"];

const SIZE_CLASS: Record<string, string> = {
  sm: "text-2xl sm:text-3xl md:text-4xl",
  md: "text-3xl sm:text-4xl md:text-5xl",
  lg: "text-4xl sm:text-5xl md:text-6xl",
  xl: "text-5xl sm:text-6xl md:text-7xl"
};

export function resolveHeroSubtitle(
  hero: HeroConfig | undefined,
  eventDescription: string | null | undefined
): { show: boolean; text: string } {
  const show = hero?.showSubtitle === true;
  if (!show) return { show: false, text: "" };
  const custom = hero?.subtitle?.trim();
  if (custom) return { show: true, text: custom };
  const fromEvent = eventDescription?.trim().split(/\n/)[0]?.slice(0, 280);
  return {
    show: true,
    text: fromEvent ?? "Join industry peers for keynotes, workshops, and networking at this program."
  };
}

/** Conference layout tagline — hidden when custom subtitle is shown. */
export function resolveConferenceTagline(
  hero: HeroConfig | undefined,
  showSubtitle: boolean
): { show: boolean; text: string } {
  if (showSubtitle) return { show: false, text: "" };
  if (hero?.showConferenceTagline === false) return { show: false, text: "" };
  if (hero?.conferenceTagline === "") return { show: false, text: "" };
  const custom = hero?.conferenceTagline?.trim();
  if (custom) return { show: true, text: custom };
  const fallback = SUMMIT_PUBLIC_HERO_TAGLINE.trim();
  if (!fallback) return { show: false, text: "" };
  return { show: true, text: fallback };
}

export function heroTitleSizeClass(hero: HeroConfig | undefined): string | undefined {
  const size = hero?.titleFontSize;
  if (!size || size === "auto") return undefined;
  return SIZE_CLASS[size];
}

export function hasCustomHeroTitleSize(hero: HeroConfig | undefined): boolean {
  const size = hero?.titleFontSize;
  return Boolean(size && size !== "auto");
}

const FONT_CLASS: Record<string, string> = {
  display: "font-[family-name:var(--font-register-display)]",
  body: "font-[family-name:var(--font-register-body)]",
  headline: "font-[family-name:var(--font-tn-display)]",
  mono: "font-[family-name:var(--font-register-mono)]"
};

export function heroTitleFontClass(hero: HeroConfig | undefined): string | undefined {
  const family = hero?.titleFontFamily;
  if (!family || family === "auto") return undefined;
  return FONT_CLASS[family];
}

export function hasCustomHeroOverlay(hero: HeroConfig | undefined): boolean {
  return Boolean(
    hero?.overlayColor?.trim() ||
      (hero?.overlayGradientFrom?.trim() && hero?.overlayGradientTo?.trim())
  );
}

export function splitTitleAccent(name: string, useAccent: boolean) {
  const words = name.trim().split(/\s+/);
  if (!useAccent || words.length <= 2) return { lead: null as string | null, accent: null as string | null, full: name };
  const accent = words[words.length - 1]!;
  const lead = words.slice(0, -1).join(" ");
  return { lead, accent, full: name };
}

/** Inline CSS variables for hero customization (colors, gradients). */
export function buildHeroCustomizationVars(hero: HeroConfig | undefined): CSSProperties {
  const vars: Record<string, string> = {};
  if (hero?.titleColor) vars["--pe-hero-title-color"] = hero.titleColor;
  if (hero?.titleAccentColor) vars["--pe-hero-title-accent"] = hero.titleAccentColor;
  if (hero?.backgroundColor) vars["--pe-hero-bg-solid"] = hero.backgroundColor;
  if (hero?.backgroundGradientFrom) vars["--pe-hero-bg-from"] = hero.backgroundGradientFrom;
  if (hero?.backgroundGradientTo) vars["--pe-hero-bg-to"] = hero.backgroundGradientTo;
  if (hero?.overlayGradientFrom) vars["--pe-hero-overlay-from"] = hero.overlayGradientFrom;
  if (hero?.overlayGradientTo) vars["--pe-hero-overlay-to"] = hero.overlayGradientTo;
  if (hero?.overlayColor) vars["--pe-hero-overlay-solid"] = hero.overlayColor;
  if (hero?.subtitleColor) vars["--pe-hero-subtitle-color"] = hero.subtitleColor;
  return vars as CSSProperties;
}

export function heroBackgroundStyle(hero: HeroConfig | undefined): CSSProperties | undefined {
  if (hero?.backgroundGradientFrom && hero?.backgroundGradientTo) {
    return {
      background: `linear-gradient(160deg, ${hero.backgroundGradientFrom}, ${hero.backgroundGradientTo})`
    };
  }
  if (hero?.backgroundColor) {
    return { background: hero.backgroundColor };
  }
  return undefined;
}

export function heroOverlayStyle(hero: HeroConfig | undefined): CSSProperties | undefined {
  if (hero?.overlayGradientFrom && hero?.overlayGradientTo) {
    return {
      background: `linear-gradient(135deg, ${hero.overlayGradientFrom}, ${hero.overlayGradientTo})`
    };
  }
  if (hero?.overlayColor) {
    return { background: hero.overlayColor };
  }
  return undefined;
}
