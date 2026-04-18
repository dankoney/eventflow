import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import type { OrgUserRow } from "@/components/settings/UserManagementPanel";
import { listLocationsForOrg } from "@/lib/db/locations";
import { prisma } from "@/lib/prisma";

export default async function DashboardSettingsPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const isAdmin = session.user.role === Role.ADMIN;
  const canManageLocations = session.user.role === Role.ADMIN || session.user.role === Role.MARKETING;

  const [user, org, locations, orgUsersRaw] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true }
    }),
    prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: {
        name: true,
        slug: true,
        logo: true,
        zoomClientId: true,
        zoomAccountId: true,
        zoomClientSecret: true,
        whatsappEnabled: true,
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
        resendApiKey: true,
        mnotifyEnabled: true,
        mnotifySenderId: true,
        mnotifyApiKey: true
      }
    }),
    listLocationsForOrg(session.user.orgId),
    isAdmin
      ? prisma.user.findMany({
          where: { orgId: session.user.orgId },
          select: { id: true, email: true, name: true, role: true, createdAt: true },
          orderBy: { email: "asc" }
        })
      : Promise.resolve([])
  ]);

  if (!user || !org) redirect("/login");

  const orgUsers: OrgUserRow[] = orgUsersRaw.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString()
  }));

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">General preferences, users, integrations, and venues.</p>
      </div>

      <Suspense fallback={<p className="text-sm text-slate-500">Loading settings…</p>}>
        <SettingsTabs
          userEmail={user.email ?? ""}
          defaultUserName={user.name}
          orgName={org.name}
          orgSlug={org.slug}
          orgLogo={org.logo}
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
            hasStoredMnotifyKey: !!org.mnotifyApiKey && org.mnotifyApiKey.length > 0
          }}
          locations={locations}
          orgUsers={orgUsers}
        />
      </Suspense>
    </section>
  );
}
