/**
 * Eventflow public page design tokens — Professional Light & Night Edition.
 * Night palette follows Material Design 3 roles from the UNCITRAL Night Edition reference.
 */

export type PublicEventTemplateVariant =
  | "professional-light"
  | "summit-dark"
  | "night-edition"
  | "technexus-dark"
  | "technexus-light";

export type PublicEventDesignTokens = {
  variant: PublicEventTemplateVariant;
  fonts: {
    body: string;
    display: string;
  };
  radius: {
    default: string;
    lg: string;
    xl: string;
    full: string;
  };
  spacing: {
    marginMobile: string;
    marginDesktop: string;
    containerMax: string;
    gutter: string;
  };
};

export const PROFESSIONAL_LIGHT_TOKENS: PublicEventDesignTokens = {
  variant: "professional-light",
  fonts: {
    body: "var(--font-register-body), Inter, ui-sans-serif, system-ui, sans-serif",
    display: "var(--font-register-display), ui-sans-serif, system-ui, sans-serif"
  },
  radius: { default: "0.75rem", lg: "1rem", xl: "1.5rem", full: "9999px" },
  spacing: {
    marginMobile: "1.5rem",
    marginDesktop: "4rem",
    containerMax: "80rem",
    gutter: "1.5rem"
  }
};

export const NIGHT_EDITION_TOKENS: PublicEventDesignTokens = {
  variant: "night-edition",
  fonts: {
    body: "var(--font-register-body), Inter, ui-sans-serif, system-ui, sans-serif",
    display: "var(--font-register-display), Manrope, ui-sans-serif, system-ui, sans-serif"
  },
  radius: { default: "1rem", lg: "2rem", xl: "3rem", full: "9999px" },
  spacing: {
    marginMobile: "20px",
    marginDesktop: "64px",
    containerMax: "1280px",
    gutter: "24px"
  }
};

const TECH_NEXUS_BASE: Omit<PublicEventDesignTokens, "variant"> = {
  fonts: {
    body: "var(--font-register-body), Inter, ui-sans-serif, system-ui, sans-serif",
    display: "var(--font-tn-display), Sora, ui-sans-serif, system-ui, sans-serif"
  },
  radius: { default: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
  spacing: {
    marginMobile: "32px",
    marginDesktop: "32px",
    containerMax: "1200px",
    gutter: "24px"
  }
};

export const TECH_NEXUS_TOKENS: PublicEventDesignTokens = {
  variant: "technexus-dark",
  ...TECH_NEXUS_BASE
};

export const TECH_NEXUS_LIGHT_TOKENS: PublicEventDesignTokens = {
  variant: "technexus-light",
  ...TECH_NEXUS_BASE
};

export function designTokensForVariant(variant: PublicEventTemplateVariant): PublicEventDesignTokens {
  if (variant === "night-edition") return NIGHT_EDITION_TOKENS;
  if (variant === "technexus-dark") return TECH_NEXUS_TOKENS;
  if (variant === "technexus-light") return TECH_NEXUS_LIGHT_TOKENS;
  return PROFESSIONAL_LIGHT_TOKENS;
}

/** Root theme class applied to the public page shell (`pe-theme-*`). */
export function themeRootClass(variant: PublicEventTemplateVariant): string {
  if (variant === "night-edition") return "pe-theme-night";
  if (variant === "summit-dark") return "pe-theme-summit-dark";
  if (variant === "technexus-light") return "pe-theme-technexus pe-theme-technexus--light";
  if (variant === "technexus-dark") return "pe-theme-technexus";
  return "pe-theme-light";
}
