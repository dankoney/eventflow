import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { EventCheckInPanel } from "@/components/checkin/EventCheckInPanel";
import { listRecentCheckInsForEvent } from "@/lib/db/checkins";
import { getEventForUser } from "@/lib/db/events";

type EventCheckInPageProps = {
  params: { id: string };
};

export default async function EventCheckInPage({ params }: EventCheckInPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) notFound();

  const event = await getEventForUser(params.id, session.user.orgId, session.user.id, session.user.role);
  if (!event) notFound();

  const recent = await listRecentCheckInsForEvent(
    event.id,
    session.user.orgId,
    session.user.id,
    session.user.role
  );

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">Check-in</h2>
      <p className="mt-1 text-sm text-slate-600">
        Scan QR codes from guest emails or search by name. Sales reps only see guests assigned to them.
      </p>
      <div className="mt-6">
        <EventCheckInPanel eventId={event.id} initialRecent={recent} />
      </div>
    </section>
  );
}
