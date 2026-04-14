import { AttendMode, EventStatus, EventType, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type EventGuestSplit = {
  inPerson: number;
  virtual: number;
};

export type EventListItem = {
  id: string;
  name: string;
  description: string | null;
  date: Date;
  endDate: Date | null;
  location: string;
  capacity: number;
  virtualCapacity: number;
  type: EventType;
  status: EventStatus;
  orgId: string;
  guestSplit: EventGuestSplit;
};

/** Events visible to the user: full org for ADMIN/MARKETING; assigned guests only for SALES_REP. */
export function visibleEventsWhere(orgId: string, userId: string, role: Role) {
  if (role === "SALES_REP") {
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
    orderBy: { date: "asc" }
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
    ...event,
    guestSplit: splitMap.get(event.id) ?? { inPerson: 0, virtual: 0 }
  }));
}

export async function getEventByIdForOrg(eventId: string, orgId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, orgId }
  });
}

/** Single event if user may access it (org-scoped). Sales reps use the guest list to see only assigned rows. */
export async function getEventForUser(
  eventId: string,
  orgId: string,
  _userId: string,
  _role: Role
) {
  return prisma.event.findFirst({
    where: { id: eventId, orgId },
    include: {
      guests: true
    }
  });
}

export async function getEventById(id: string, orgId: string) {
  return prisma.event.findFirst({
    where: { id, orgId },
    include: { guests: true }
  });
}

const openRegistrationStatuses: EventStatus[] = [EventStatus.PUBLISHED, EventStatus.LIVE];

/** Minimal event for public self-registration (no auth). */
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
      location: true,
      type: true,
      capacity: true,
      virtualCapacity: true,
      zoomMeetingId: true,
      zoomPasscode: true,
      orgId: true
    }
  });
}

export type PublicRegistrationEvent = NonNullable<
  Awaited<ReturnType<typeof getEventForPublicRegistration>>
>;
