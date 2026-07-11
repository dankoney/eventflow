import type { Organization } from "@prisma/client";

export const DEFAULT_ORG_PRIMARY_COLOR = "#4F46E5";

export type OrgEmailBranding = {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
};

export function resolveOrgEmailBranding(
  org: Pick<
    Organization,
    "logoUrl" | "logo" | "defaultEventBrandLogoUrl" | "primaryColor" | "accentColor" | "defaultEventBrandPrimaryColor"
  >
): OrgEmailBranding {
  const primaryColor =
    org.primaryColor?.trim() ||
    org.defaultEventBrandPrimaryColor?.trim() ||
    DEFAULT_ORG_PRIMARY_COLOR;

  const accentColor = org.accentColor?.trim() || primaryColor;

  const logoUrl =
    org.logoUrl?.trim() ||
    org.logo?.trim() ||
    org.defaultEventBrandLogoUrl?.trim() ||
    null;

  return { logoUrl, primaryColor, accentColor };
}

export function orgBrandingToMergeValues(branding: OrgEmailBranding, orgName: string): Record<string, string> {
  return {
    org_logo_url: branding.logoUrl ?? "",
    org_primary_color: branding.primaryColor,
    org_accent_color: branding.accentColor,
    org_name: orgName
  };
}
