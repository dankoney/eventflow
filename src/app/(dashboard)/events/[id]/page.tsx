import { EventStatus, EventType, ZoomSessionKind } from "@prisma/client";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { EventLifecyclePanel } from "@/components/events/EventLifecyclePanel";
import { RegistrationLinkSection } from "@/components/events/RegistrationLinkSection";
import { ZoomMeetingDetailsShare } from "@/components/events/ZoomMeetingDetailsShare";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { getEventForUser } from "@/lib/db/events";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { getPublicSiteUrl } from "@/lib/url";
import { formatDate, formatLocationLine } from "@/lib/utils";

const statusLabel: Record<EventStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  LIVE: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

const typeLabel: Record<EventType, string> = {
  IN_PERSON: "In person",
  VIRTUAL: "Virtual",
  HYBRID: "Hybrid"
};

type PageProps = { params: { id: string } };

export default async function EventOverviewPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.orgId) notFound();

  await syncEventStatusForEvent(params.id);

  const event = await getEventForUser(params.id, session.user.orgId, session.user.id, session.user.role);
  if (!event) notFound();

  const inPersonCount = event.guests.filter((g) => g.mode === "IN_PERSON").length;
  const virtualCount = event.guests.filter((g) => g.mode === "VIRTUAL").length;

  const baseUrl = getPublicSiteUrl();
  const registrationUrl = `${baseUrl}/register/${event.id}`;
  const canPublish = session.user.role === "ADMIN" || session.user.role === "MARKETING";
  const effectiveEnd = event.endDate;
  const canDeletePast = effectiveEnd.getTime() <= Date.now();
  const scheduledEndHasPassed = event.endDate.getTime() <= Date.now();

  return (
    <div className="space-y-6">
    {canPublish ? (
      <EventLifecyclePanel
        eventId={event.id}
        status={event.status}
        canManage={canPublish}
        canDeletePast={canDeletePast}
        scheduledEndHasPassed={scheduledEndHasPassed}
      />
    ) : null}
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Details</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Status</dt>
            <dd>
              <Badge>{statusLabel[event.status]}</Badge>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Type</dt>
            <dd className="font-medium text-slate-900">{typeLabel[event.type]}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Starts</dt>
            <dd className="text-slate-900">{formatDate(event.date)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Ends</dt>
            <dd className="text-slate-900">{formatDate(event.endDate)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Location</dt>
            <dd className="text-right text-slate-900">{formatLocationLine(event.location)}</dd>
          </div>
          {event.description ? (
            <div>
              <dt className="text-slate-500">Description</dt>
              <dd className="mt-1 text-slate-800">{event.description}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Capacity</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">In-person capacity</dt>
            <dd className="font-medium">{event.capacity}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Registered in person</dt>
            <dd className="font-medium">
              {inPersonCount} / {event.capacity}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Virtual capacity</dt>
            <dd className="font-medium">{event.virtualCapacity}</dd>
          </div>
          {event.virtualCapacity > 0 ? (
            <div className="flex justify-between">
              <dt className="text-slate-500">Registered virtual</dt>
              <dd className="font-medium">
                {virtualCount} / {event.virtualCapacity}
              </dd>
            </div>
          ) : null}
        </dl>

        {event.virtualCapacity > 0 && (event.zoomJoinUrl || event.zoomMeetingId) ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Zoom {event.zoomSessionKind === ZoomSessionKind.MEETING ? "meeting" : "webinar"}
            </h3>
            <dl className="mt-2 space-y-2 text-sm">
              {event.zoomMeetingId ? (
                <div>
                  <dt className="text-slate-500">Meeting ID</dt>
                  <dd className="font-mono text-slate-900">{event.zoomMeetingId}</dd>
                </div>
              ) : null}
              {event.zoomPasscode ? (
                <div>
                  <dt className="text-slate-500">Passcode</dt>
                  <dd className="font-mono text-slate-900">{event.zoomPasscode}</dd>
                </div>
              ) : null}
              {event.zoomJoinUrl ? (
                <div>
                  <dt className="text-slate-500">Join URL</dt>
                  <dd className="text-slate-900">
                    <ZoomMeetingDetailsShare
                      eventName={event.name}
                      sessionLabel={
                        event.zoomSessionKind === ZoomSessionKind.MEETING ? "meeting" : "webinar"
                      }
                      meetingId={event.zoomMeetingId}
                      passcode={event.zoomPasscode}
                      joinUrl={event.zoomJoinUrl}
                    />
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </Card>
    </div>

    <RegistrationLinkSection
      eventId={event.id}
      status={event.status}
      registrationUrl={registrationUrl}
      canPublish={canPublish}
    />
    </div>
  );
}
