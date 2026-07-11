import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventRemindersSettingsForm } from "@/components/events/EventRemindersSettingsForm";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getEventForUser } from "@/lib/db/events";
import { listLocationsForOrg } from "@/lib/db/locations";
import { parseMultiDayConfig } from "@/lib/event-schedule/multiDayConfig";
import { prisma } from "@/lib/prisma";
import { canManageEventTeam } from "@/lib/permissions";
import { EventStatus } from "@prisma/client";

type PageProps = { params: { id: string } };

export default async function EventSettingsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canManageEventTeam(session.user.role)) redirect(`/events/${params.id}`);

  const [event, locations] = await Promise.all([
    getEventForUser(
      params.id,
      session.user.orgId,
      session.user.id,
      session.user.role,
      session.sessionId
    ),
    listLocationsForOrg(session.user.orgId)
  ]);
  if (!event) notFound();

  const enableVirtual = event.virtualCapacity > 0;
  const multiDay = parseMultiDayConfig(event.multiDayConfig);
  const remindersLocked = event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED;

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Settings"
      title="Connect & reminders"
      description="Automated email, WhatsApp, and SMS before the event. Guest feedback is configured under the Feedback tab."
    >
      {remindersLocked ? (
        <p className="text-sm text-zinc-600">
          This event is {event.status === EventStatus.COMPLETED ? "completed" : "cancelled"}. Reminder settings are
          read-only.
        </p>
      ) : null}
      <EventRemindersSettingsForm
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
          scheduleMode: event.scheduleMode,
          multiDayDays:
            multiDay?.days.map((d) => ({
              startsAt: d.startsAt,
              endsAt: d.endsAt,
              zoomJoinUrl: d.zoomJoinUrl ?? ""
            })) ?? [],
          multiDayVirtualLinkMode: multiDay?.virtualLinkMode ?? "SHARED",
          multiDayRegistrationPolicy: multiDay?.registrationPolicy ?? "OPEN_UNTIL_EVENT_END",
          multiDayCheckInPolicy: multiDay?.checkInPolicy ?? "ONCE_FOR_EVENT",
          multiDayShowAgendaPublic: multiDay?.showDayAgendaPublic ?? true,
          multiDayAllowStaffCheckInOutsideSession: multiDay?.allowStaffCheckInOutsideSession ?? false,
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
          zoomSessionKind: event.zoomSessionKind,
          bannerImageUrl: event.bannerImageUrl ?? "",
          brandLogoUrl: event.brandLogoUrl ?? "",
          attendeeTheme: event.attendeeTheme,
          publicPageTemplate: event.publicPageTemplate,
          brandPrimaryColor: event.brandPrimaryColor ?? ""
        }}
      />
    </WorkspacePageShell>
  );
}
