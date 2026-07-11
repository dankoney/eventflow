import { AttendeeTheme, Prisma, PublicPageTemplate, ZoomSessionKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Row shape used by dashboard settings (org card + integrations + event defaults). */
export type OrgDashboardSettingsRow = {
  name: string;
  slug: string;
  logo: string | null;
  defaultEventBannerImageUrl: string | null;
  defaultEventBrandLogoUrl: string | null;
  defaultEventAttendeeTheme: AttendeeTheme;
  defaultEventPublicPageTemplate: PublicPageTemplate;
  defaultEventBrandPrimaryColor: string | null;
  defaultEventBrandSecondaryColor: string | null;
  defaultEventBrandTertiaryColor: string | null;
  defaultEventVirtualCapacity: number;
  defaultZoomSessionKind: ZoomSessionKind;
  contactCategoryLabels: unknown | null;
  internalStaffFooterContact: string | null;
  zoomClientId: string | null;
  zoomAccountId: string | null;
  zoomClientSecret: string | null;
  zoomMeetingSdkKey: string | null;
  zoomMeetingSdkSecret: string | null;
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string | null;
  whatsappAccessToken: string | null;
  resendApiKey: string | null;
  mnotifyEnabled: boolean;
  mnotifySenderId: string | null;
  mnotifyApiKey: string | null;
  googleMapsApiKey: string | null;
  marketingEmailEnabled: boolean;
  marketingConsentCopy: string | null;
  marketingPrivacyPolicyUrl: string | null;
};

const orgDashboardSettingsSelectBase = {
  name: true,
  slug: true,
  logo: true,
  zoomClientId: true,
  zoomAccountId: true,
  zoomClientSecret: true,
  zoomMeetingSdkKey: true,
  zoomMeetingSdkSecret: true,
  whatsappEnabled: true,
  whatsappPhoneNumberId: true,
  whatsappAccessToken: true,
  resendApiKey: true,
  mnotifyEnabled: true,
  mnotifySenderId: true,
  mnotifyApiKey: true,
  googleMapsApiKey: true
} satisfies Prisma.OrganizationSelect;

const orgDashboardSettingsSelectFull = {
  ...orgDashboardSettingsSelectBase,
  defaultEventBannerImageUrl: true,
  defaultEventBrandLogoUrl: true,
  defaultEventAttendeeTheme: true,
  defaultEventPublicPageTemplate: true,
  defaultEventBrandPrimaryColor: true,
  defaultEventBrandSecondaryColor: true,
  defaultEventBrandTertiaryColor: true,
  defaultEventVirtualCapacity: true,
  defaultZoomSessionKind: true,
  contactCategoryLabels: true,
  internalStaffFooterContact: true,
  marketingEmailEnabled: true,
  marketingConsentCopy: true,
  marketingPrivacyPolicyUrl: true
} satisfies Prisma.OrganizationSelect;

function defaultEventOrgColumns(): Pick<
  OrgDashboardSettingsRow,
  | "defaultEventBannerImageUrl"
  | "defaultEventBrandLogoUrl"
  | "defaultEventAttendeeTheme"
  | "defaultEventPublicPageTemplate"
  | "defaultEventBrandPrimaryColor"
  | "defaultEventBrandSecondaryColor"
  | "defaultEventBrandTertiaryColor"
  | "defaultEventVirtualCapacity"
  | "defaultZoomSessionKind"
  | "contactCategoryLabels"
  | "internalStaffFooterContact"
  | "marketingEmailEnabled"
  | "marketingConsentCopy"
  | "marketingPrivacyPolicyUrl"
> {
  return {
    defaultEventBannerImageUrl: null,
    defaultEventBrandLogoUrl: null,
    defaultEventAttendeeTheme: AttendeeTheme.SYSTEM,
    defaultEventPublicPageTemplate: PublicPageTemplate.SUMMIT,
    defaultEventBrandPrimaryColor: null,
    defaultEventBrandSecondaryColor: null,
    defaultEventBrandTertiaryColor: null,
    defaultEventVirtualCapacity: 100,
    defaultZoomSessionKind: ZoomSessionKind.MEETING,
    contactCategoryLabels: null,
    internalStaffFooterContact: null,
    marketingEmailEnabled: false,
    marketingConsentCopy: null,
    marketingPrivacyPolicyUrl: null
  };
}

function isMissingColumnError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /\bcolumn\b.*\bdoes not exist\b/i.test(msg);
}

/**
 * Loads organization row for Settings. If DB is behind migrations (missing org default columns),
 * falls back to a slimmer query and Prisma/schema defaults so the page still renders.
 */
export async function getOrgForDashboardSettings(orgId: string): Promise<OrgDashboardSettingsRow | null> {
  try {
    const row = await prisma.organization.findUnique({
      where: { id: orgId },
      select: orgDashboardSettingsSelectFull
    });
    if (!row) return null;
    return row;
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
    const row = await prisma.organization.findUnique({
      where: { id: orgId },
      select: orgDashboardSettingsSelectBase
    });
    if (!row) return null;
    return { ...row, ...defaultEventOrgColumns(), googleMapsApiKey: null };
  }
}
