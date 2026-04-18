import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventForm } from "@/components/events/EventForm";
import { getEventForUser } from "@/lib/db/events";
import { listLocationsForOrg } from "@/lib/db/locations";

type PageProps = { params: { id: string } };

export default async function EditEventPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "MARKETING") {
    redirect("/events");
  }

  const [event, locations] = await Promise.all([
    getEventForUser(params.id, session.user.orgId, session.user.id, session.user.role),
    listLocationsForOrg(session.user.orgId)
  ]);

  if (!event) notFound();

  const enableVirtual = event.virtualCapacity > 0;

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Edit event</h1>
      <p className="mt-1 text-sm text-slate-600">Update details for this event.</p>
      <div className="mt-8">
        <EventForm
          mode="edit"
          eventId={event.id}
          eventStatus={event.status}
          locations={locations}
          zoomSessionKindLocked={!!event.zoomMeetingId}
          defaultValues={{
            name: event.name,
            description: event.description ?? "",
            date: event.date,
            endDate: event.endDate,
            locationId: event.locationId,
            capacity: event.capacity,
            enableVirtual,
            virtualCapacity: event.virtualCapacity || 50,
            type: event.type,
            historicalMode: event.date.getTime() < Date.now(),
            reminderPrimaryEnabled: event.reminderPrimaryEnabled,
            reminderPrimaryHoursBefore: event.reminderPrimaryHoursBefore as 24 | 48 | 72,
            reminderPrimaryEmail: event.reminderPrimaryEmail,
            reminderPrimaryWhatsapp: event.reminderPrimaryWhatsapp,
            reminderPrimarySms: event.reminderPrimarySms,
            reminderFinalEnabled: event.reminderFinalEnabled,
            reminderFinalHoursBefore: event.reminderFinalHoursBefore as 1 | 2 | 5,
            reminderFinalWhatsapp: event.reminderFinalWhatsapp,
            reminderFinalSms: event.reminderFinalSms,
            zoomSessionKind: event.zoomSessionKind
          }}
        />
      </div>
    </section>
  );
}
