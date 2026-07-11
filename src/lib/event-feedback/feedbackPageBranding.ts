import {
  resolveDefaultEventBrandColors,
  resolveDefaultEventBrandLogoUrl
} from "@/lib/email/defaultEventBranding";
import type { Organization } from "@prisma/client";

type FeedbackPageOrgBranding = Pick<Organization, "name"> &
  Partial<
    Pick<
      Organization,
      | "defaultEventBrandLogoUrl"
      | "logoUrl"
      | "logo"
      | "defaultEventBrandPrimaryColor"
      | "defaultEventBrandSecondaryColor"
      | "defaultEventBrandTertiaryColor"
    >
  >;

type FeedbackPageEventBranding = {
  brandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
};

export function resolveFeedbackPageBranding(
  org: FeedbackPageOrgBranding,
  event: FeedbackPageEventBranding
) {
  const colors = resolveDefaultEventBrandColors(
    {
      defaultEventBrandLogoUrl: org.defaultEventBrandLogoUrl ?? null,
      logoUrl: org.logoUrl ?? null,
      logo: org.logo ?? null,
      defaultEventBrandPrimaryColor: org.defaultEventBrandPrimaryColor ?? null,
      defaultEventBrandSecondaryColor: org.defaultEventBrandSecondaryColor ?? null,
      defaultEventBrandTertiaryColor: org.defaultEventBrandTertiaryColor ?? null
    },
    {
      brandPrimaryColor: event.brandPrimaryColor
    }
  );
  const logoUrl = resolveDefaultEventBrandLogoUrl(
    {
      defaultEventBrandLogoUrl: org.defaultEventBrandLogoUrl ?? null,
      logoUrl: org.logoUrl ?? null,
      logo: org.logo ?? null,
      defaultEventBrandPrimaryColor: org.defaultEventBrandPrimaryColor ?? null,
      defaultEventBrandSecondaryColor: org.defaultEventBrandSecondaryColor ?? null,
      defaultEventBrandTertiaryColor: org.defaultEventBrandTertiaryColor ?? null
    },
    event.brandLogoUrl
  );

  return {
    orgName: org.name,
    logoUrl,
    accent: colors.primary
  };
}
