import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { listEventsWithGuestSplit } from "@/lib/db/events";
import { formatDate } from "@/lib/utils";
import { EventStatus } from "@prisma/client";

const statusLabel: Record<EventStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  LIVE: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

export default async function CheckInHubPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const events = await listEventsWithGuestSplit(session.user.orgId, session.user.id, session.user.role);

  return (
    <WorkspacePageShell
      className="max-w-7xl"
      kicker="Check-in"
      title="Choose an event"
      description="Open the desk for an event to scan tickets or search guests by name and email."
    >
      {events.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No events in scope yet. Create an event or get assigned guests first.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}/checkin`}>
                <Card className="transition hover:border-zinc-300 hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-zinc-900">{e.name}</p>
                      <p className="mt-1 text-sm text-zinc-600">{formatDate(e.date)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{statusLabel[e.status]}</Badge>
                      <span className="text-xs text-zinc-500">
                        {e.guestSplit.inPerson + e.guestSplit.virtual} guests
                      </span>
                      <span className="text-xs font-medium text-zinc-800">Open check-in →</span>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePageShell>
  );
}
