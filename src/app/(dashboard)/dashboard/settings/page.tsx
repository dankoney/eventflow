import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import type { OrgUserRow } from "@/components/settings/UserManagementPanel";
import { listLocationsForOrg } from "@/lib/db/locations";
import { parseContactCategoryLabelsJson } from "@/lib/db/orgContact";
import { getOrgForDashboardSettings } from "@/lib/db/organizationSettings";
import { getMnotifyDefaultSenderIdFromEnv } from "@/lib/mnotify";
import { prisma } from "@/lib/prisma";

type SettingsPageProps = {
  searchParams?: { tab?: string };
};

export default async function DashboardSettingsPage({ searchParams }: SettingsPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const isAdmin = session.user.role === Role.ADMIN;
  const canManageLocations = session.user.role === Role.ADMIN || session.user.role === Role.MARKETING;
  const canManageStaffDirectory = session.user.role === Role.ADMIN || session.user.role === Role.MARKETING;

  const [user, org, locations, orgUsersRaw] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true }
    }),
    getOrgForDashboardSettings(session.user.orgId),
    listLocationsForOrg(session.user.orgId),
    isAdmin
      ? prisma.user.findMany({
          where: { orgId: session.user.orgId },
          select: { id: true, email: true, name: true, role: true, createdAt: true },
          orderBy: { email: "asc" }
        })
      : Promise.resolve([]),
  ]);

  if (!user || !org) redirect("/login");

  const mnotifyDefaultSenderId = getMnotifyDefaultSenderIdFromEnv();

  const defaultStaffCategoryLabelsCsv = parseContactCategoryLabelsJson(org?.contactCategoryLabels ?? null).join("\n");

  const orgUsers: OrgUserRow[] = orgUsersRaw.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString()
  }));

  return (
    <WorkspacePageShell
      className="max-w-7xl"
      kicker="Workspace"
      title="Settings"
      description="General preferences, users, integrations, and venues."
    >
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading settings…</p>}>
        <SettingsTabs
          userEmail={user.email ?? ""}
          defaultUserName={user.name}
          orgName={org.name}
          orgSlug={org.slug}
          orgEventDefaults={{
            defaultEventBannerImageUrl: org.defaultEventBannerImageUrl,
            defaultEventBrandLogoUrl: org.defaultEventBrandLogoUrl,
            defaultEventAttendeeTheme: org.defaultEventAttendeeTheme,
            defaultEventPublicPageTemplate: org.defaultEventPublicPageTemplate,
            defaultEventBrandPrimaryColor: org.defaultEventBrandPrimaryColor,
            defaultEventBrandSecondaryColor: org.defaultEventBrandSecondaryColor,
            defaultEventBrandTertiaryColor: org.defaultEventBrandTertiaryColor,
            defaultEventVirtualCapacity: org.defaultEventVirtualCapacity,
            defaultZoomSessionKind: org.defaultZoomSessionKind
          }}
          isAdmin={isAdmin}
          canManageLocations={canManageLocations}
          integrations={{
            zoomClientId: org.zoomClientId,
            zoomAccountId: org.zoomAccountId,
            hasStoredZoomSecret: !!org.zoomClientSecret && org.zoomClientSecret.length > 0,
            whatsappEnabled: org.whatsappEnabled,
            whatsappPhoneNumberId: org.whatsappPhoneNumberId,
            hasStoredWhatsappToken: !!org.whatsappAccessToken && org.whatsappAccessToken.length > 0,
            hasStoredResendKey: !!org.resendApiKey && org.resendApiKey.length > 0,
            mnotifyEnabled: org.mnotifyEnabled,
            mnotifySenderId: org.mnotifySenderId,
            mnotifyDefaultSenderId,
            hasStoredMnotifyKey: !!org.mnotifyApiKey && org.mnotifyApiKey.length > 0,
            hasStoredGoogleMapsKey: !!org.googleMapsApiKey && org.googleMapsApiKey.length > 0
          }}
          locations={locations}
          orgUsers={orgUsers}
          canManageStaffDirectory={canManageStaffDirectory}
          defaultStaffCategoryLabelsCsv={defaultStaffCategoryLabelsCsv}
          defaultInternalStaffFooterContact={org?.internalStaffFooterContact ?? null}
          marketingDefaults={{
            orgName: org.name,
            marketingEmailEnabled: org.marketingEmailEnabled ?? false,
            marketingConsentCopy: org.marketingConsentCopy ?? null,
            marketingPrivacyPolicyUrl: org.marketingPrivacyPolicyUrl ?? null
          }}
        />
      </Suspense>
    </WorkspacePageShell>
  );
}
