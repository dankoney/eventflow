import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventForm } from "@/components/events/EventForm";
import { orgRecordToEventFormDefaults } from "@/components/events/eventFormSchema";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { listLocationsForOrg } from "@/lib/db/locations";
import { getOrgForDashboardSettings } from "@/lib/db/organizationSettings";
import { isGoogleMapsConfigured } from "@/lib/maps/googleMapsConfigured";

export default async function NewEventClassicPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "MARKETING") {
    redirect("/events");
  }

  const [locations, org] = await Promise.all([
    listLocationsForOrg(session.user.orgId),
    getOrgForDashboardSettings(session.user.orgId)
  ]);
  const orgDefaults = orgRecordToEventFormDefaults(org);
  const hasGoogleMaps = isGoogleMapsConfigured(org?.googleMapsApiKey);

  return (
    <WorkspacePageShell
      className="mx-auto max-w-5xl"
      kicker="Classic"
      title="Create event"
      description="Single-page editor for teams that prefer one scrollable form."
      headerActions={
        <Link
          href="/events/new"
          className="text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950"
        >
          Blueprint wizard
        </Link>
      }
    >
      <EventForm mode="create" locations={locations} orgDefaults={orgDefaults} hasGoogleMaps={hasGoogleMaps} />
    </WorkspacePageShell>
  );
}
