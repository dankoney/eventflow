import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventPublishView } from "@/components/events/EventPublishView";
import { getEventForUser } from "@/lib/db/events";
import { prisma } from "@/lib/prisma";
import { isWalkInBoothOpen, walkInBoothStatusMessage } from "@/lib/checkin/walkInBoothWindow";
import { getEventPollAbsoluteUrl, getEventWalkInCheckInBoothUrl, getOrgCommandCenterUrl, getPublicSiteUrl } from "@/lib/url";
import { EventBlueprintTemplate, EventStatus, EventType, Role } from "@prisma/client";

type PageProps = { params: { id: string } };

export default async function EventPublishPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canPublish = session.user.role === "ADMIN" || session.user.role === "MARKETING";
  if (!canPublish) {
    redirect("/events");
  }

  const event = await getEventForUser(params.id, session.user.orgId, session.user.id, session.user.role);
  if (!event) notFound();

  if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
    redirect(`/events/${params.id}`);
  }

  const baseUrl = getPublicSiteUrl();
  const registrationUrl = `${baseUrl}/register/${event.id}`;

  /**
   * Surface the Election & Polling add-on only when an organizer has configured
   * a poll for this event. The Direct Link card mirrors the one on the dedicated
   * Poll tab so the publish surface is the single "share everywhere" view.
   */
  const poll = await prisma.poll.findUnique({
    where: { eventId: event.id },
    select: { isActive: true }
  });
  const pollDirectLink = poll ? getEventPollAbsoluteUrl(event.id) : null;
  const commandCenterUrl = getOrgCommandCenterUrl(event.org.slug);
  const checkInBoothUrl = getEventWalkInCheckInBoothUrl(event.org.slug, event.id);
  const isOnsiteEvent = event.type !== EventType.VIRTUAL;
  const eventIsLive = event.status === EventStatus.LIVE;
  const boothOpen = isWalkInBoothOpen({
    date: event.date,
    endDate: event.endDate,
    status: event.status,
    type: event.type
  });
  const boothStatusMessage = walkInBoothStatusMessage({
    date: event.date,
    endDate: event.endDate,
    status: event.status,
    type: event.type
  });
  const canHostZoom = session.user.role === Role.ADMIN;
  const hasZoomRoom =
    event.virtualCapacity > 0 && Boolean(event.zoomMeetingId && event.zoomJoinUrl);

  return (
    <EventPublishView
      eventId={event.id}
      name={event.name}
      status={event.status}
      registrationUrl={registrationUrl}
      canPublish={canPublish}
      isInternalStaff={event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF}
      pollUrl={pollDirectLink}
      pollIsActive={poll?.isActive ?? false}
      commandCenterUrl={commandCenterUrl}
      checkInBoothUrl={checkInBoothUrl}
      orgSlug={event.org.slug}
      allowFlashEntry={event.allowFlashEntry}
      eventIsLive={eventIsLive}
      boothOpen={boothOpen}
      boothStatusMessage={boothStatusMessage}
      isOnsiteEvent={isOnsiteEvent}
      canHostZoom={canHostZoom}
      hasZoomRoom={hasZoomRoom}
      zoomStartUrl={event.zoomStartUrl}
      zoomJoinUrl={event.zoomJoinUrl}
    />
  );
}
