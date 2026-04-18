import { AttendMode, EventStatus, EventType, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isRepScopedRole } from "@/lib/permissions";
import { formatLocationLine } from "@/lib/utils";

export type EventGuestSplit = {
  inPerson: number;
  virtual: number;
};

export type EventListItem = {
  id: string;
  name: string;
  description: string | null;
  date: Date;
  endDate: Date;
  locationId: string;
  locationSummary: string;
  capacity: number;
  virtualCapacity: number;
  type: EventType;
  status: EventStatus;
  orgId: string;
  guestSplit: EventGuestSplit;
};

export type EventsListTabId = "ongoing" | "upcoming" | "past";

/**
 * Split dashboard events into tabs: in-session (started, not ended), before start, or ended / terminal.
 */
export function partitionEventsForTabs(events: EventListItem[], now = new Date()) {
  const t = now.getTime();
  const ongoing: EventListItem[] = [];
  const upcoming: EventListItem[] = [];
  const past: EventListItem[] = [];

  for (const e of events) {
    const start = new Date(e.date).getTime();
    const end = new Date(e.endDate).getTime();

    if (e.status === EventStatus.COMPLETED || e.status === EventStatus.CANCELLED) {
      past.push(e);
      continue;
    }
    if (t < start) {
      upcoming.push(e);
      continue;
    }
    if (t < end) {
      ongoing.push(e);
      continue;
    }
    past.push(e);
  }

  return { ongoing, upcoming, past };
}

export function resolveEventsListTab(
  requested: string | undefined,
  counts: { ongoing: number; upcoming: number; past: number }
): EventsListTabId {
  if (requested === "ongoing" || requested === "upcoming" || requested === "past") {
    return requested;
  }
  if (counts.ongoing > 0) return "ongoing";
  if (counts.upcoming > 0) return "upcoming";
  return "past";
}

/** Events visible: full org for ADMIN/MARKETING; STAFF/SALES_REF only events where they have assigned guests. */
export function visibleEventsWhere(orgId: string, userId: string, role: Role) {
  if (isRepScopedRole(role)) {
    return {
      orgId,
      guests: { some: { repId: userId } }
    } as const;
  }
  return { orgId } as const;
}

export async function listEventsWithGuestSplit(
  orgId: string,
  userId: string,
  role: Role
): Promise<EventListItem[]> {
  const where = visibleEventsWhere(orgId, userId, role);

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      location: { select: { id: true, name: true, address: true } }
    }
  });

  if (events.length === 0) return [];

  const ids = events.map((e) => e.id);
  const grouped = await prisma.guest.groupBy({
    by: ["eventId", "mode"],
    where: { eventId: { in: ids } },
    _count: { _all: true }
  });

  const splitMap = new Map<string, EventGuestSplit>();
  for (const id of ids) {
    splitMap.set(id, { inPerson: 0, virtual: 0 });
  }
  for (const row of grouped) {
    const current = splitMap.get(row.eventId) ?? { inPerson: 0, virtual: 0 };
    if (row.mode === AttendMode.IN_PERSON) {
      current.inPerson = row._count._all;
    } else {
      current.virtual = row._count._all;
    }
    splitMap.set(row.eventId, current);
  }

  return events.map((event) => ({
    id: event.id,
    name: event.name,
    description: event.description,
    date: event.date,
    endDate: event.endDate,
    locationId: event.locationId,
    locationSummary: formatLocationLine(event.location),
    capacity: event.capacity,
    virtualCapacity: event.virtualCapacity,
    type: event.type,
    status: event.status,
    orgId: event.orgId,
    guestSplit: splitMap.get(event.id) ?? { inPerson: 0, virtual: 0 }
  }));
}

export async function getEventByIdForOrg(eventId: string, orgId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, orgId },
    include: { location: true }
  });
}

export async function getEventForUser(
  eventId: string,
  orgId: string,
  _userId: string,
  _role: Role
) {
  return prisma.event.findFirst({
    where: { id: eventId, orgId },
    include: {
      guests: true,
      location: true
    }
  });
}

export async function getEventById(id: string, orgId: string) {
  return prisma.event.findFirst({
    where: { id, orgId },
    include: { guests: true, location: true }
  });
}

const openRegistrationStatuses: EventStatus[] = [EventStatus.PUBLISHED, EventStatus.LIVE];

export async function getEventForPublicRegistration(eventId: string) {
  return prisma.event.findFirst({
    where: {
      id: eventId,
      status: { in: openRegistrationStatuses }
    },
    select: {
      id: true,
      name: true,
      date: true,
      type: true,
      capacity: true,
      virtualCapacity: true,
      zoomMeetingId: true,
      zoomJoinUrl: true,
      zoomPasscode: true,
      zoomSessionKind: true,
      orgId: true,
      location: { select: { name: true, address: true } },
      org: { select: { name: true, resendApiKey: true } }
    }
  });
}

export async function getEventForPublicPage(eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      date: true,
      status: true,
      type: true,
      capacity: true,
      virtualCapacity: true,
      zoomMeetingId: true,
      zoomJoinUrl: true,
      zoomPasscode: true,
      zoomSessionKind: true,
      orgId: true,
      location: { select: { name: true, address: true } },
      org: { select: { name: true, resendApiKey: true } }
    }
  });
}

export type PublicRegistrationEvent = NonNullable<
  Awaited<ReturnType<typeof getEventForPublicRegistration>>
>;
