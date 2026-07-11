import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WizardManager } from "@/components/event-wizard/WizardManager";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { orgRecordToEventFormDefaults } from "@/components/events/eventFormSchema";
import {
  distinctOrgContactFieldValues,
  getOrgContactCategoryLabels,
  listOrgContactsForWizardPick
} from "@/lib/db/orgContact";
import { listOrgContactGroupsForOrg } from "@/lib/db/crm";
import { listLocationsForOrg } from "@/lib/db/locations";
import { getOrgForDashboardSettings } from "@/lib/db/organizationSettings";
import { isGoogleMapsConfigured } from "@/lib/maps/googleMapsConfigured";
import { prisma } from "@/lib/prisma";

export default async function NewEventPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "MARKETING") {
    redirect("/events");
  }

  const [locations, org, contactPickList, distinctContacts, presetCategories, groups] = await Promise.all([
    listLocationsForOrg(session.user.orgId),
    getOrgForDashboardSettings(session.user.orgId),
    listOrgContactsForWizardPick(session.user.orgId),
    distinctOrgContactFieldValues(session.user.orgId),
    getOrgContactCategoryLabels(session.user.orgId),
    listOrgContactGroupsForOrg(session.user.orgId)
  ]);

  const staffDirectoryMeta = {
    contactPickList,
    departments: distinctContacts.departments,
    ranks: distinctContacts.ranks,
    categories: distinctContacts.categories,
    presetCategories,
    groups
  };

  const orgHasZoomCredentials = Boolean(
    org?.zoomClientId?.trim() && org?.zoomClientSecret?.trim() && org?.zoomAccountId?.trim()
  );
  const orgDefaults = orgRecordToEventFormDefaults(org);
  const hasGoogleMaps = isGoogleMapsConfigured(org?.googleMapsApiKey);

  return (
    <WorkspacePageShell
      className="mx-auto max-w-5xl"
      kicker="Blueprint-first"
      title="Create event"
      description="Pick a program archetype and walk through readiness checks. The program is created as a draft; publish it from the event’s Publish tab when you are ready to open registration."
      headerActions={
        <Link
          href="/events/new/classic"
          className="shrink-0 text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950"
        >
          Classic single-page form
        </Link>
      }
    >
      <WizardManager
        locations={locations}
        orgHasZoomCredentials={orgHasZoomCredentials}
        orgDefaults={orgDefaults}
        hasGoogleMaps={hasGoogleMaps}
        staffDirectoryMeta={staffDirectoryMeta}
      />
    </WorkspacePageShell>
  );
}
