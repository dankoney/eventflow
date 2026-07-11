import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { GuestsHubPanel } from "@/components/guests/GuestsHubPanel";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import {
  listEventsForGuestHubFilter,
  listGuestsForOrgHub,
  GUEST_HUB_MAX
} from "@/lib/db/guests";
import { canManageEventGuests } from "@/lib/permissions";

export default async function GuestsPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (!canManageEventGuests(session.user.role)) redirect("/dashboard");

  const [guestRows, eventOptions] = await Promise.all([
    listGuestsForOrgHub(session.user.orgId, session.user.id, session.user.role),
    listEventsForGuestHubFilter(session.user.orgId, session.user.id, session.user.role)
  ]);

  const guests = guestRows.map((g) => ({
    ...g,
    eventDate: g.eventDate.toISOString()
  }));

  const eventsForFilter = eventOptions.map((e) => ({
    id: e.id,
    name: e.name,
    date: e.date.toISOString()
  }));

  const atCap = guestRows.length >= GUEST_HUB_MAX;

  return (
    <WorkspacePageShell
      className="max-w-7xl"
      kicker="Directory"
      title="Guests across events"
      description="Cross-event view of everyone you can access. Sales reps only see assigned guests. For CSV import, Zoom sync, and per-event actions, open the Guests tab on an event; use Overview for the public registration link."
    >
      <GuestsHubPanel guests={guests} eventOptions={eventsForFilter} atCap={atCap} />
    </WorkspacePageShell>
  );
}
