import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { DoorDashboardClient } from "@/components/door/DoorDashboardClient";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { listCheckInsForEventPaginated } from "@/lib/db/checkins";
import { getDoorDashboardSnapshot } from "@/lib/db/doorDashboard";
import { getEventForUser } from "@/lib/db/events";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { canUseCheckIn } from "@/lib/permissions";

type DoorPageProps = { params: { id: string } };

export default async function EventDoorDashboardPage({ params }: DoorPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) notFound();
  if (!canUseCheckIn(session.user.role)) notFound();

  await syncEventStatusForEvent(params.id);
  const event = await getEventForUser(params.id, session.user.orgId, session.user.id, session.user.role);
  if (!event) notFound();

  const initial = await getDoorDashboardSnapshot(event.id, session.user.orgId);
  if (!initial) notFound();

  const initialCheckIns = await listCheckInsForEventPaginated(
    event.id,
    session.user.orgId,
    session.user.id,
    session.user.role,
    { page: 1, pageSize: 20, dayIndex: initial.dayIndex }
  );

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Live ops"
      title="Door dashboard"
      description={
        <>
          Real-time view of check-ins vs venue capacity for{" "}
          <span className="font-medium text-slate-800">{event.name}</span>. Org admins receive email
          alerts at 80% and 100% capacity.
        </>
      }
    >
      <div className="mb-4">
        <Link
          href={`/events/${event.id}`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back to event
        </Link>
      </div>
      <DoorDashboardClient
        eventId={event.id}
        initial={initial}
        initialCheckIns={initialCheckIns}
        dayIndex={initial.dayIndex}
      />
    </WorkspacePageShell>
  );
}
