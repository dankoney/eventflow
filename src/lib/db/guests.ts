import { AttendMode, GuestStatus, Role } from "@prisma/client";

import { visibleEventsWhere } from "@/lib/db/events";
import { prisma } from "@/lib/prisma";

export type GuestJoinContext = {
  guestName: string;
  mode: AttendMode;
  status: GuestStatus;
  zoomLink: string | null;
  eventName: string;
  eventDate: Date;
  eventLocation: string;
  zoomMeetingId: string | null;
  zoomPasscode: string | null;
  organizationName: string;
};

/** Public join page data (no auth). */
export async function getGuestJoinContext(guestId: string): Promise<GuestJoinContext | null> {
  const row = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      name: true,
      mode: true,
      status: true,
      zoomLink: true,
      event: {
        select: {
          name: true,
          date: true,
          location: true,
          zoomMeetingId: true,
          zoomPasscode: true,
          org: { select: { name: true } }
        }
      }
    }
  });
  if (!row) return null;

  return {
    guestName: row.name,
    mode: row.mode,
    status: row.status,
    zoomLink: row.zoomLink,
    eventName: row.event.name,
    eventDate: row.event.date,
    eventLocation: row.event.location,
    zoomMeetingId: row.event.zoomMeetingId,
    zoomPasscode: row.event.zoomPasscode,
    organizationName: row.event.org.name
  };
}

export type GuestWithRep = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  tier: string;
  mode: string;
  status: string;
  qrCode: string | null;
  zoomLink: string | null;
  dietary: string | null;
  repId: string | null;
  eventId: string;
  createdAt: Date;
  repName: string | null;
  repEmail: string | null;
  checkedInAt: Date | null;
};

export async function getGuestsByEvent(eventId: string) {
  return prisma.guest.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" }
  });
}

export async function listGuestsForEventManagement(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role
): Promise<GuestWithRep[]> {
  await assertEventInOrg(eventId, orgId);

  const where =
    role === "SALES_REP"
      ? { eventId, repId: userId }
      : { eventId };

  const guests = await prisma.guest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { checkIn: { select: { checkedInAt: true } } }
  });

  const repIds = [...new Set(guests.map((g) => g.repId).filter(Boolean))] as string[];
  if (repIds.length === 0) {
    return guests.map((g) => {
      const { checkIn, ...rest } = g;
      return {
        ...rest,
        repName: null,
        repEmail: null,
        checkedInAt: checkIn?.checkedInAt ?? null
      };
    });
  }

  const reps = await prisma.user.findMany({
    where: { id: { in: repIds }, orgId },
    select: { id: true, name: true, email: true }
  });
  const map = new Map(reps.map((r) => [r.id, r]));

  return guests.map((g) => {
    const { checkIn, ...rest } = g;
    const rep = g.repId ? map.get(g.repId) : undefined;
    return {
      ...rest,
      repName: rep?.name ?? null,
      repEmail: rep?.email ?? null,
      checkedInAt: checkIn?.checkedInAt ?? null
    };
  });
}

async function assertEventInOrg(eventId: string, orgId: string) {
  const ev = await prisma.event.findFirst({ where: { id: eventId, orgId }, select: { id: true } });
  if (!ev) throw new Error("Event not found");
}

export async function getGuestById(guestId: string) {
  return prisma.guest.findUnique({
    where: { id: guestId },
    include: { checkIn: true, event: true }
  });
}

export async function getGuestByIdForOrg(guestId: string, orgId: string) {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: { checkIn: true, event: true }
  });
  if (!guest || guest.event.orgId !== orgId) return null;
  return guest;
}

/** Row for org-wide guest list (cross-event). */
export type GuestHubRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  tier: string;
  mode: string;
  status: string;
  eventId: string;
  eventName: string;
  eventDate: Date;
  repName: string | null;
  repEmail: string | null;
};

export const GUEST_HUB_MAX = 2500;

/**
 * All guests visible to the user across events (admin/marketing: org; sales rep: assigned only).
 * Capped for performance — use event-level Guests tab for full-detail workflows.
 */
export async function listGuestsForOrgHub(
  orgId: string,
  userId: string,
  role: Role
): Promise<GuestHubRow[]> {
  const where =
    role === "SALES_REP"
      ? { event: { orgId }, repId: userId }
      : { event: { orgId } };

  const guests = await prisma.guest.findMany({
    where,
    take: GUEST_HUB_MAX,
    orderBy: [{ event: { date: "desc" } }, { name: "asc" }],
    include: {
      event: { select: { id: true, name: true, date: true } }
    }
  });

  const repIds = [...new Set(guests.map((g) => g.repId).filter(Boolean))] as string[];
  if (repIds.length === 0) {
    return guests.map((g) => ({
      id: g.id,
      name: g.name,
      email: g.email,
      company: g.company,
      tier: g.tier,
      mode: g.mode,
      status: g.status,
      eventId: g.eventId,
      eventName: g.event.name,
      eventDate: g.event.date,
      repName: null,
      repEmail: null
    }));
  }

  const reps = await prisma.user.findMany({
    where: { id: { in: repIds }, orgId },
    select: { id: true, name: true, email: true }
  });
  const repMap = new Map(reps.map((r) => [r.id, r]));

  return guests.map((g) => {
    const rep = g.repId ? repMap.get(g.repId) : undefined;
    return {
      id: g.id,
      name: g.name,
      email: g.email,
      company: g.company,
      tier: g.tier,
      mode: g.mode,
      status: g.status,
      eventId: g.eventId,
      eventName: g.event.name,
      eventDate: g.event.date,
      repName: rep?.name ?? null,
      repEmail: rep?.email ?? null
    };
  });
}

export type EventFilterOption = { id: string; name: string; date: Date };

/** Events the user can scope filters to (same visibility as event list). */
export async function listEventsForGuestHubFilter(
  orgId: string,
  userId: string,
  role: Role
): Promise<EventFilterOption[]> {
  return prisma.event.findMany({
    where: visibleEventsWhere(orgId, userId, role),
    select: { id: true, name: true, date: true },
    orderBy: { date: "desc" }
  });
}
