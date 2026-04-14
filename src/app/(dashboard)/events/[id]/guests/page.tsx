import { redirect } from "next/navigation";

import { GuestManagementPanel } from "@/components/guests/GuestManagementPanel";
import { auth } from "@/auth";
import { listGuestsForEventManagement } from "@/lib/db/guests";
import { listSalesReps } from "@/lib/db/users";

type EventGuestsPageProps = {
  params: { id: string };
};

export default async function EventGuestsPage({ params }: EventGuestsPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const [guests, salesReps] = await Promise.all([
    listGuestsForEventManagement(params.id, session.user.orgId, session.user.id, session.user.role),
    listSalesReps(session.user.orgId)
  ]);

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">Guests</h2>
      <p className="mt-2 text-sm text-slate-600">
        Add guests individually or import a CSV. Sales reps only see guests assigned to them.
      </p>
      <div className="mt-6">
        <GuestManagementPanel
          eventId={params.id}
          guests={guests}
          salesReps={salesReps}
          role={session.user.role}
          currentUserId={session.user.id}
        />
      </div>
    </section>
  );
}
