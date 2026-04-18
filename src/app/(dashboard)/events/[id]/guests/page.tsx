import { redirect } from "next/navigation";

import { GuestManagementPanel } from "@/components/guests/GuestManagementPanel";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listGuestsForEventManagement } from "@/lib/db/guests";
import { listAssignableReps } from "@/lib/db/users";
import { Role } from "@prisma/client";

type EventGuestsPageProps = {
  params: { id: string };
};

export default async function EventGuestsPage({ params }: EventGuestsPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const [guests, salesReps, zoomMeta] = await Promise.all([
    listGuestsForEventManagement(params.id, session.user.orgId, session.user.id, session.user.role),
    listAssignableReps(session.user.orgId),
    prisma.event.findFirst({
      where: { id: params.id, orgId: session.user.orgId },
      select: { zoomMeetingId: true }
    })
  ]);

  const showZoomParticipantSync =
    (session.user.role === Role.ADMIN || session.user.role === Role.MARKETING) &&
    Boolean(zoomMeta?.zoomMeetingId);

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">Guests</h2>
      <p className="mt-2 text-sm text-slate-600">
        Add guests individually or import a CSV. Staff and sales roles only see full contact details for guests
        assigned to them.
      </p>
      <div className="mt-6">
        <GuestManagementPanel
          eventId={params.id}
          guests={guests}
          salesReps={salesReps}
          role={session.user.role}
          currentUserId={session.user.id}
          showZoomParticipantSync={showZoomParticipantSync}
        />
      </div>
    </section>
  );
}
