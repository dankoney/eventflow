import { auth } from "@/auth";
import { GuestsHubPanel } from "@/components/guests/GuestsHubPanel";
import {
  listEventsForGuestHubFilter,
  listGuestsForOrgHub,
  GUEST_HUB_MAX
} from "@/lib/db/guests";
import { redirect } from "next/navigation";

export default async function GuestsPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

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
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Guests</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cross-event view of everyone you can access. Sales reps only see assigned guests. For QR import and
          per-event actions, open an event&apos;s <strong>Guests</strong> tab or{" "}
          <strong>Overview</strong> for the public registration link.
        </p>
      </div>

      <GuestsHubPanel guests={guests} eventOptions={eventsForFilter} atCap={atCap} />
    </section>
  );
}
