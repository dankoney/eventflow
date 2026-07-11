import type { Organization } from "@prisma/client";

import { resolveEmailAssetUrl } from "@/lib/email/assetUrl";

export const DEFAULT_EVENT_BRAND_PRIMARY = "#0c4a3e";
export const DEFAULT_EVENT_BRAND_SECONDARY = "#14532d";
export const DEFAULT_EVENT_BRAND_TERTIARY = "#fbbf24";

export type DefaultEventBrandColors = {
  primary: string;
  secondary: string;
  tertiary: string;
};

export type DefaultEventBranding = DefaultEventBrandColors & {
  logoUrl: string | null;
};

type OrgBrandingSource = Pick<
  Organization,
  | "defaultEventBrandLogoUrl"
  | "logoUrl"
  | "logo"
  | "defaultEventBrandPrimaryColor"
  | "defaultEventBrandSecondaryColor"
  | "defaultEventBrandTertiaryColor"
>;

type EventBrandingOverrides = {
  brandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  brandSecondaryColor?: string | null;
  brandTertiaryColor?: string | null;
};

function normalizeHex(raw: string | null | undefined, fallback: string): string {
  const t = raw?.trim() ?? "";
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t)) return t;
  return fallback;
}

export function resolveDefaultEventBrandColors(
  org: OrgBrandingSource,
  overrides?: EventBrandingOverrides
): DefaultEventBrandColors {
  return {
    primary: normalizeHex(
      overrides?.brandPrimaryColor ?? org.defaultEventBrandPrimaryColor,
      DEFAULT_EVENT_BRAND_PRIMARY
    ),
    secondary: normalizeHex(
      overrides?.brandSecondaryColor ?? org.defaultEventBrandSecondaryColor,
      DEFAULT_EVENT_BRAND_SECONDARY
    ),
    tertiary: normalizeHex(
      overrides?.brandTertiaryColor ?? org.defaultEventBrandTertiaryColor,
      DEFAULT_EVENT_BRAND_TERTIARY
    )
  };
}

/** Canonical org logo for default event branding (Settings → Default event branding). */
export function resolveDefaultEventBrandLogoUrl(
  org: OrgBrandingSource,
  eventLogoOverride?: string | null
): string | null {
  const candidate =
    eventLogoOverride?.trim() ||
    org.defaultEventBrandLogoUrl?.trim() ||
    org.logoUrl?.trim() ||
    org.logo?.trim() ||
    null;
  return resolveEmailAssetUrl(candidate);
}

export function resolveDefaultEventBranding(
  org: OrgBrandingSource,
  overrides?: EventBrandingOverrides
): DefaultEventBranding {
  return {
    ...resolveDefaultEventBrandColors(org, overrides),
    logoUrl: resolveDefaultEventBrandLogoUrl(org, overrides?.brandLogoUrl)
  };
}
