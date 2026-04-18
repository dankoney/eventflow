import { AttendMode, EventStatus, GuestStatus, Role, ZoomSessionKind } from "@prisma/client";

import { visibleEventsWhere } from "@/lib/db/events";
import { prisma } from "@/lib/prisma";
import { displayEmailForGuest, displayPhoneForGuest, isRepScopedRole } from "@/lib/permissions";
import { getOpenZoomJoinAbsoluteUrl } from "@/lib/url";
import { formatLocationLine } from "@/lib/utils";

export type GuestJoinContext = {
  guestName: string;
  /** Company from registration (used with workspace name for Zoom display label). */
  guestCompany: string | null;
  mode: AttendMode;
  status: GuestStatus;
  zoomLink: string | null;
  /** Host join URL when guest has no personal Zoom row yet */
  eventZoomJoinUrl: string | null;
  eventName: string;
  eventDate: Date;
  eventLocation: string;
  zoomMeetingId: string | null;
  zoomPasscode: string | null;
  zoomSessionKind: ZoomSessionKind;
  organizationName: string;
  eventStatus: EventStatus;
};

export async function getGuestJoinContext(guestId: string): Promise<GuestJoinContext | null> {
  const row = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      name: true,
      company: true,
      mode: true,
      status: true,
      zoomLink: true,
      event: {
        select: {
          name: true,
          date: true,
          orgId: true,
          location: { select: { name: true, address: true } },
          zoomMeetingId: true,
          zoomJoinUrl: true,
          zoomPasscode: true,
          zoomSessionKind: true,
          status: true,
          org: { select: { name: true } }
        }
      }
    }
  });
  if (!row) return null;

  return {
    guestName: row.name,
    guestCompany: row.company,
    mode: row.mode,
    status: row.status,
    zoomLink: row.zoomLink,
    eventZoomJoinUrl: row.event.zoomJoinUrl,
    eventName: row.event.name,
    eventDate: row.event.date,
    eventLocation: formatLocationLine(row.event.location),
    zoomMeetingId: row.event.zoomMeetingId,
    zoomPasscode: row.event.zoomPasscode,
    zoomSessionKind: row.event.zoomSessionKind,
    organizationName: row.event.org.name,
    eventStatus: row.event.status
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
  joinSource: string;
  qrCode: string | null;
  zoomLink: string | null;
  /**
   * Same per-guest `/join/{id}/open-zoom` URL as confirmation email (null if site base URL is unset).
   */
  openZoomJoinUrl: string | null;
  dietary: string | null;
  repId: string | null;
  eventId: string;
  createdAt: Date;
  repName: string | null;
  repEmail: string | null;
  checkedInAt: Date | null;
  /** When true, QR and sensitive actions should be hidden in UI. */
  contactsRedacted: boolean;
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

  const guests = await prisma.guest.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: { checkIn: { select: { checkedInAt: true } } }
  });

  const repIds = [...new Set(guests.map((g) => g.repId).filter(Boolean))] as string[];
  const repMap = new Map<string, { name: string | null; email: string }>();
  if (repIds.length > 0) {
    const reps = await prisma.user.findMany({
      where: { id: { in: repIds }, orgId },
      select: { id: true, name: true, email: true }
    });
    for (const r of reps) repMap.set(r.id, r);
  }

  return guests.map((g) => {
    const { checkIn, ...rest } = g;
    const rep = g.repId ? repMap.get(g.repId) : undefined;
    const full =
      role === Role.ADMIN || role === Role.MARKETING || (isRepScopedRole(role) && g.repId === userId);
    const openZoomJoinUrl =
      full && g.mode === AttendMode.VIRTUAL ? getOpenZoomJoinAbsoluteUrl(g.id) : null;
    return {
      ...rest,
      email: displayEmailForGuest(role, userId, { email: g.email, repId: g.repId }),
      phone: displayPhoneForGuest(role, userId, { phone: g.phone, repId: g.repId }),
      repName: rep?.name ?? null,
      repEmail: rep?.email ?? null,
      checkedInAt: checkIn?.checkedInAt ?? null,
      contactsRedacted: !full,
      openZoomJoinUrl
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

export async function listGuestsForOrgHub(
  orgId: string,
  userId: string,
  role: Role
): Promise<GuestHubRow[]> {
  const guests = await prisma.guest.findMany({
    where: { event: { orgId } },
    take: GUEST_HUB_MAX,
    orderBy: [{ event: { date: "desc" } }, { name: "asc" }],
    include: {
      event: { select: { id: true, name: true, date: true } }
    }
  });

  const repIds = [...new Set(guests.map((g) => g.repId).filter(Boolean))] as string[];
  const repMap = new Map<string, { name: string | null; email: string }>();
  if (repIds.length > 0) {
    const reps = await prisma.user.findMany({
      where: { id: { in: repIds }, orgId },
      select: { id: true, name: true, email: true }
    });
    for (const r of reps) repMap.set(r.id, r);
  }

  return guests.map((g) => {
    const rep = g.repId ? repMap.get(g.repId) : undefined;
    return {
      id: g.id,
      name: g.name,
      email: displayEmailForGuest(role, userId, { email: g.email, repId: g.repId }),
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

export type GuestCheckInCacheRow = {
  id: string;
  name: string;
  email: string;
  repId: string | null;
  qrCode: string | null;
  status: GuestStatus;
  checkedInAt: Date | null;
};

/** Operational guest rows for offline check-in cache (not masked; scoped by role). */
export async function listGuestsForCheckInCache(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role
): Promise<GuestCheckInCacheRow[]> {
  await assertEventInOrg(eventId, orgId);
  const where = isRepScopedRole(role) ? { eventId, repId: userId } : { eventId };

  const guests = await prisma.guest.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      repId: true,
      qrCode: true,
      status: true,
      checkIn: { select: { checkedInAt: true } }
    }
  });

  return guests.map((g) => ({
    id: g.id,
    name: g.name,
    email: g.email,
    repId: g.repId,
    qrCode: g.qrCode,
    status: g.status,
    checkedInAt: g.checkIn?.checkedInAt ?? null
  }));
}

export type EventFilterOption = { id: string; name: string; date: Date };

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
