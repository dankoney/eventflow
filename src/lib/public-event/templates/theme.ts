import type { CSSProperties } from "react";

import {
  readableAccentForDarkBg,
  readableAccentForLightBg,
  readableTextOn
} from "@/lib/ui/contrastColor";

import {
  designTokensForVariant,
  themeRootClass,
  type PublicEventTemplateVariant
} from "./designTokens";

export type PublicEventThemeClasses = {
  /** Page shell */
  page: string;
  /** Fixed top navigation */
  nav: string;
  navLink: string;
  navLinkActive: string;
  navCta: string;
  /** Section chrome */
  section: string;
  sectionAlt: string;
  sectionBorderTop: string;
  /** Typography */
  heading: string;
  headingGradient: string;
  body: string;
  muted: string;
  badge: string;
  /** Cards & panels */
  card: string;
  cardHover: string;
  glass: string;
  /** Buttons */
  btnPrimary: string;
  btnSecondary: string;
  /** Form shell for registration embed */
  registerCard: string;
  registerShell: string;
  /** Footer & sticky CTA */
  footer: string;
  stickyCta: string;
};

function isDarkTemplateVariant(variant: PublicEventTemplateVariant): boolean {
  return variant === "night-edition" || variant === "technexus-dark" || variant === "summit-dark";
}

const TECHNEXUS_THEME_CLASSES: PublicEventThemeClasses = {
  page: "tn-page bg-[var(--pe-background)] text-[var(--pe-on-surface)] font-[family-name:var(--font-register-body)] antialiased selection:bg-[color:var(--pe-primary-container)]/40 selection:text-[var(--pe-on-primary-container)]",
  nav: "border-[var(--pe-nav-border)] bg-[var(--pe-nav-bg)] backdrop-blur-xl shadow-md",
  navLink:
    "text-[var(--pe-on-surface)] transition-colors hover:text-[var(--pe-primary)] hover:bg-[var(--pe-primary)]/10 px-3 py-2 rounded-md text-base",
  navLinkActive: "text-[var(--pe-primary)]",
  navCta:
    "tn-btn-cta rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-all",
  section: "tn-section scroll-mt-24",
  sectionAlt: "",
  sectionBorderTop: "",
  heading:
    "tn-heading font-[family-name:var(--font-tn-display)] font-bold tracking-tight text-[var(--pe-on-surface)]",
  headingGradient: "tn-text-gradient font-[family-name:var(--font-tn-display)] font-extrabold tracking-tight",
  body: "text-base leading-relaxed text-[var(--pe-on-surface-variant)]",
  muted: "text-sm text-[var(--pe-on-surface-variant)]",
  badge:
    "inline-flex items-center gap-2 rounded-full border border-[var(--pe-primary)]/20 bg-[var(--pe-primary)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--pe-primary)] backdrop-blur-sm",
  card: "tn-glass-card rounded-xl overflow-hidden",
  cardHover: "tn-glow-hover transition-all duration-300",
  glass: "tn-glass-card rounded-xl",
  btnPrimary:
    "tn-btn-cta rounded-full px-8 py-4 text-sm font-semibold uppercase tracking-wider transition-all",
  btnSecondary:
    "tn-btn-outline rounded-full px-8 py-4 text-sm font-semibold uppercase tracking-wider transition-all",
  registerCard: "tn-glass-card scroll-mt-24 rounded-2xl p-8 md:p-10",
  registerShell:
    "[&_button[type=submit]]:!bg-[var(--pe-cta-bg)] [&_button[type=submit]]:!text-[var(--pe-cta-fg)] [&_button[type=submit]]:!rounded-lg [&_input]:!bg-[var(--pe-surface-container-high)] [&_input]:!border-[var(--pe-outline-variant)] [&_input]:!text-[var(--pe-on-surface)]",
  footer: "border-t border-[var(--pe-footer-border)] bg-[var(--pe-surface-container-lowest)] py-12",
  stickyCta: "border-t border-[var(--pe-nav-border)] bg-[var(--pe-surface-container)]/95 backdrop-blur-md"
};

export function getPublicEventThemeClasses(variant: PublicEventTemplateVariant): PublicEventThemeClasses {
  if (variant === "technexus-dark" || variant === "technexus-light") {
    return TECHNEXUS_THEME_CLASSES;
  }

  if (variant === "summit-dark") {
    return {
      page: "bg-[var(--pe-background)] text-zinc-100 antialiased selection:bg-[color:var(--pe-accent)]/30",
      nav: "border-white/10 bg-zinc-950/80 backdrop-blur-md",
      navLink:
        "text-xs font-bold uppercase tracking-widest text-zinc-400 transition hover:text-zinc-100",
      navLinkActive:
        "border-b-2 border-[color:var(--pe-accent)] pb-1 text-[color:var(--pe-accent)]",
      navCta:
        "rounded-lg bg-[color:var(--pe-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--pe-accent-fg)] transition hover:opacity-90",
      section: "scroll-mt-24 py-2",
      sectionAlt: "",
      sectionBorderTop: "",
      heading: "font-register-display font-bold tracking-tight text-zinc-50",
      headingGradient: "font-register-display font-bold tracking-tight text-zinc-50",
      body: "font-register-body text-lg leading-relaxed text-zinc-300",
      muted: "text-sm text-zinc-400",
      badge:
        "inline-block rounded-full border border-[color:var(--pe-accent)]/35 bg-[color:var(--pe-accent)]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[color:var(--pe-accent)]",
      card: "rounded-xl border border-white/10 bg-zinc-900/60",
      cardHover: "transition-all hover:border-[color:var(--pe-accent)]/40",
      glass: "rounded-xl border border-white/10 bg-zinc-900/70 backdrop-blur-sm",
      btnPrimary:
        "rounded-lg bg-[color:var(--pe-accent)] px-8 py-3 text-sm font-bold text-[color:var(--pe-accent-fg)] transition hover:opacity-90",
      btnSecondary:
        "rounded-lg border border-zinc-600 px-8 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/5",
      registerCard:
        "scroll-mt-28 rounded-2xl border border-white/10 bg-[var(--pe-surface)]/95 p-8 text-[var(--pe-on-surface)] shadow-2xl backdrop-blur-sm md:p-10",
      registerShell:
        "[&_button[type=submit]]:!bg-[color:var(--pe-accent)] [&_button[type=submit]]:!text-[color:var(--pe-accent-fg)] [&_button[type=submit]]:!py-3.5 [&_label]:text-[var(--pe-on-surface-variant)] [&_input]:rounded-lg [&_input]:border [&_input]:border-[var(--pe-outline-variant)] [&_input]:bg-[var(--pe-surface-container-high)] [&_input]:text-[var(--pe-on-surface)] [&_input]:placeholder:text-[var(--pe-on-surface-variant)] [&_p]:text-[var(--pe-on-surface-variant)] [&_strong]:text-[var(--pe-on-surface)]",
      footer: "border-t border-white/10 bg-zinc-950 py-12",
      stickyCta: "border-t border-white/10 bg-zinc-900/95 backdrop-blur-md"
    };
  }

  if (variant === "night-edition") {
    return {
      page: "bg-[var(--pe-background)] text-[var(--pe-on-background)] antialiased selection:bg-[color:var(--pe-accent)]/30",
      nav: "border-white/10 bg-[var(--pe-nav-bg)] backdrop-blur-md",
      navLink:
        "text-xs font-bold uppercase tracking-widest text-zinc-400 transition hover:text-zinc-100",
      navLinkActive:
        "border-b-2 border-[color:var(--pe-accent)] pb-1 text-[color:var(--pe-accent)]",
      navCta:
        "rounded-full bg-[color:var(--pe-accent)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--pe-accent-fg)] shadow-md transition hover:opacity-90 active:scale-95",
      section: "py-24 pe-section-pad",
      sectionAlt: "rounded-t-[2rem] bg-[var(--pe-surface-container-lowest)]",
      sectionBorderTop: "",
      heading: "font-bold tracking-tight text-[var(--pe-on-surface)]",
      headingGradient: "pe-text-gradient font-extrabold tracking-tight",
      body: "text-base leading-relaxed text-[var(--pe-on-surface-variant)]",
      muted: "text-sm text-zinc-400",
      badge:
        "inline-flex items-center rounded-full border border-[color:var(--pe-accent)]/30 bg-[color:var(--pe-accent)]/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[color:var(--pe-accent)]",
      card: "rounded-xl border border-white/10 bg-zinc-900/60",
      cardHover: "transition-all hover:border-[color:var(--pe-accent)]/40",
      glass: "pe-glass-panel rounded-xl border border-white/10",
      btnPrimary:
        "pe-bg-gradient-primary rounded-full px-8 py-4 font-bold text-[var(--pe-background)] shadow-lg transition hover:opacity-90 hover:shadow-[0_0_30px_rgba(255,170,249,0.4)] active:scale-95",
      btnSecondary:
        "rounded-full border border-white/10 px-8 py-4 font-medium text-[var(--pe-on-surface)] transition hover:bg-white/5",
      registerCard:
        "scroll-mt-24 rounded-2xl border border-white/10 bg-zinc-900/85 p-8 shadow-2xl backdrop-blur-sm md:p-10",
      registerShell:
        "[&_button[type=submit]]:!bg-[color:var(--pe-accent)] [&_button[type=submit]]:!text-[color:var(--pe-accent-fg)] [&_button[type=submit]]:!py-3.5",
      footer: "border-t border-white/10 bg-zinc-950 py-12",
      stickyCta: "border-t border-white/10 bg-zinc-900/95 backdrop-blur-md"
    };
  }

  return {
    page: "bg-surface font-register-body text-zinc-900 antialiased",
    nav: "border-outline-variant/30 bg-surface/90 shadow-sm backdrop-blur-md",
    navLink: "text-sm font-semibold text-zinc-600 transition hover:text-zinc-950",
    navLinkActive: "text-zinc-950",
    navCta: "rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 sm:px-5",
    section: "scroll-mt-24 py-2",
    sectionAlt: "",
    sectionBorderTop: "",
    heading: "font-register-display font-bold tracking-tight text-zinc-950",
    headingGradient: "font-register-display font-bold tracking-tight text-zinc-950",
    body: "font-register-body text-lg leading-relaxed text-on-surface-variant",
    muted: "text-sm text-on-surface-variant",
    badge:
      "inline-block rounded-full border border-accent/35 bg-accent/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-zinc-900",
    card: "rounded-xl border border-outline-variant/20 bg-white shadow-sm",
    cardHover: "transition hover:shadow-md",
    glass: "rounded-xl border border-outline-variant/30 bg-white",
    btnPrimary:
      "rounded-lg bg-zinc-950 px-8 py-3 text-sm font-bold text-white transition hover:opacity-90",
    btnSecondary:
      "rounded-lg border border-outline-variant px-8 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-surface-container-low",
    registerCard:
      "scroll-mt-28 rounded-2xl border border-white/10 bg-white p-8 text-zinc-900 shadow-2xl md:p-10",
    registerShell:
      "font-register-body [&_button[type=submit]]:rounded-lg [&_button[type=submit]]:bg-zinc-950 [&_button[type=submit]]:text-white [&_label]:text-xs [&_label]:font-bold [&_label]:uppercase [&_input]:rounded-lg [&_input]:bg-surface-container [&_select]:rounded-lg [&_select]:bg-surface-container",
    footer: "border-t border-outline-variant/30 bg-zinc-200/40 py-12",
    stickyCta: "border-t border-outline-variant bg-white/95 backdrop-blur-md"
  };
}

/** CSS variables for brand accent on the public page root. */
export function buildPublicEventCssVars(
  variant: PublicEventTemplateVariant,
  brandColor?: string
): CSSProperties {
  const tokens = designTokensForVariant(variant);
  const rawBrand = brandColor?.trim();
  const technexusDefaultBrand = "#ce2e34";
  const accent = isDarkTemplateVariant(variant)
    ? readableAccentForDarkBg(
        rawBrand || (variant === "technexus-dark" ? technexusDefaultBrand : "#4cd7f6")
      )
    : rawBrand || "#00677e";
  const accentFg = isDarkTemplateVariant(variant) ? readableTextOn(accent) : "#ffffff";

  const vars: Record<string, string> = {
    ["--pe-margin-mobile"]: tokens.spacing.marginMobile,
    ["--pe-margin-desktop"]: tokens.spacing.marginDesktop,
    ["--pe-container-max"]: tokens.spacing.containerMax,
    ["--accent"]: accent,
    ["--accent-fg"]: accentFg,
    ["--brand"]: accent,
    ["--brand-primary"]: accent,
    ["--pe-hero-gradient-mid"]: `color-mix(in srgb, ${accent} 42%, transparent)`
  };

  if (variant === "technexus-dark") {
    vars["--pe-tertiary-container"] = accent;
    vars["--pe-on-tertiary-container"] = accentFg;
    vars["--pe-primary-container"] = accent;
    vars["--pe-cta-bg"] = accent;
    vars["--pe-cta-fg"] = accentFg;
  }

  if (variant === "technexus-light") {
    const vivid = rawBrand || "#0040e0";
    const primary = readableAccentForLightBg(vivid, 0.38);
    const ctaFg = readableTextOn(vivid);
    vars["--pe-primary"] = primary;
    vars["--pe-on-primary"] = readableTextOn(primary);
    vars["--pe-primary-container"] = primary;
    vars["--pe-brand-vivid"] = vivid;
    vars["--pe-tertiary-container"] = readableAccentForLightBg(vivid, 0.32);
    vars["--pe-on-tertiary-container"] = "#ffffff";
    vars["--pe-cta-bg"] = vivid;
    vars["--pe-cta-fg"] = ctaFg;
  }

  if (variant === "professional-light") {
    vars["--pe-gradient-from"] = accent;
    vars["--pe-gradient-to"] = `color-mix(in srgb, ${accent} 42%, #0891b2)`;
    vars["--pe-primary"] = accent;
  }

  if (variant === "summit-dark") {
    vars["--pe-gradient-from"] = `color-mix(in srgb, ${accent} 32%, #27272a)`;
    vars["--pe-gradient-to"] = `color-mix(in srgb, ${accent} 14%, #09090b)`;
    vars["--pe-primary"] = accent;
  }

  return vars as CSSProperties;
}

export { designTokensForVariant, themeRootClass, type PublicEventTemplateVariant };
