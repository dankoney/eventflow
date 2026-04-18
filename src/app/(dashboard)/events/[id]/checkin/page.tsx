import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { EventCheckInPanel } from "@/components/checkin/EventCheckInPanel";
import { listRecentCheckInsForEvent } from "@/lib/db/checkins";
import { getEventForUser } from "@/lib/db/events";
import { listGuestsForCheckInCache } from "@/lib/db/guests";

type EventCheckInPageProps = {
  params: { id: string };
};

export default async function EventCheckInPage({ params }: EventCheckInPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) notFound();

  const event = await getEventForUser(params.id, session.user.orgId, session.user.id, session.user.role);
  if (!event) notFound();

  const [recent, guestCache] = await Promise.all([
    listRecentCheckInsForEvent(event.id, session.user.orgId, session.user.id, session.user.role),
    listGuestsForCheckInCache(event.id, session.user.orgId, session.user.id, session.user.role)
  ]);

  const initialGuestCache = guestCache.map((g) => ({
    id: g.id,
    name: g.name,
    email: g.email,
    repId: g.repId,
    qrCode: g.qrCode,
    status: g.status,
    checkedInAt: g.checkedInAt ? g.checkedInAt.toISOString() : null
  }));

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">Check-in</h2>
      <p className="mt-1 text-sm text-slate-600">
        Scan QR codes from guest emails or search by name. Field roles only see guests assigned to them. This screen
        can be installed as an app and works with a cached guest list when offline.
      </p>
      <div className="mt-6">
        <EventCheckInPanel eventId={event.id} initialRecent={recent} initialGuestCache={initialGuestCache} />
      </div>
    </section>
  );
}
