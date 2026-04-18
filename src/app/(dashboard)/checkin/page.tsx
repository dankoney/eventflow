import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
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

  const events = await listEventsWithGuestSplit(
    session.user.orgId,
    session.user.id,
    session.user.role
  );

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Check-in</h1>
      <p className="mt-1 text-sm text-slate-600">
        Choose an event to scan tickets or search guests by name and email.
      </p>

      {events.length === 0 ? (
        <p className="mt-6 text-sm text-slate-600">
          No events in scope yet. Create an event or get assigned guests first.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}/checkin`}>
                <Card className="transition hover:border-slate-300 hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{e.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{formatDate(e.date)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{statusLabel[e.status]}</Badge>
                      <span className="text-xs text-slate-500">
                        {e.guestSplit.inPerson + e.guestSplit.virtual} guests
                      </span>
                      <span className="text-xs font-medium text-sky-700">Open check-in →</span>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
