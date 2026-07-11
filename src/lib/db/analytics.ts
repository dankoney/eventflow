import { GuestStatus, Role, Tier } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isEventLinkedRole, isSalesRepRole, isStaffRole, visibleEventsWhere } from "@/lib/permissions";

export type TierDatum = { tier: string; count: number };
export type StatusDatum = { status: GuestStatus; count: number; label: string };
export type HourDatum = { hour: number; label: string; count: number };
export type RegistrationDayDatum = { day: string; count: number };

export type EventAnalyticsData = {
  tierData: TierDatum[];
  statusData: StatusDatum[];
  hourlyData: HourDatum[];
  registrationByDay: RegistrationDayDatum[];
  totalGuests: number;
};

const STATUS_LABEL: Record<GuestStatus, string> = {
  INVITED: "Invited",
  REGISTERED: "Registered",
  ACCEPTED: "Accepted",
  CHECKED_IN: "Checked in",
  JOINED: "Joined (virtual)",
  NO_SHOW: "No-show",
  DECLINED: "Declined"
};

function guestFilterForEvent(eventId: string, userId: string, role: Role) {
  if (isStaffRole(role)) return { eventId, id: "__none__" };
  return {
    eventId,
    ...(isSalesRepRole(role) ? { repId: userId } : {})
  };
}

function guestFilterForOrg(orgId: string, userId: string, role: Role) {
  if (isStaffRole(role)) return { event: { orgId }, id: "__none__" };
  return {
    event: { orgId },
    ...(isSalesRepRole(role) ? { repId: userId } : {})
  };
}

/** Per-event charts (scoped to visible guests). */
export async function getEventAnalytics(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role
): Promise<EventAnalyticsData | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true }
  });
  if (!event) return null;

  const gWhere = guestFilterForEvent(eventId, userId, role);

  const [tierRows, statusRows, checkIns, guests] = await Promise.all([
    prisma.guest.groupBy({
      by: ["tier"],
      where: gWhere,
      _count: { _all: true }
    }),
    prisma.guest.groupBy({
      by: ["status"],
      where: gWhere,
      _count: { _all: true }
    }),
    prisma.checkIn.findMany({
      where: { guest: gWhere },
      select: { checkedInAt: true }
    }),
    prisma.guest.findMany({
      where: gWhere,
      select: { createdAt: true },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const tierOrder = [Tier.A, Tier.B, Tier.C];
  const tierData: TierDatum[] = tierOrder.map((t) => {
    const row = tierRows.find((r) => r.tier === t);
    return { tier: t, count: row?._count._all ?? 0 };
  });

  const statusData: StatusDatum[] = statusRows
    .map((r) => ({
      status: r.status,
      count: r._count._all,
      label: STATUS_LABEL[r.status]
    }))
    .sort((a, b) => b.count - a.count);

  const hourBuckets = Array.from({ length: 24 }, (_, h) => h);
  const hourCounts = new Map<number, number>();
  for (const h of hourBuckets) hourCounts.set(h, 0);
  for (const c of checkIns) {
    const h = new Date(c.checkedInAt).getHours();
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }
  const hourlyData: HourDatum[] = hourBuckets.map((h) => ({
    hour: h,
    label: formatHourLabel(h),
    count: hourCounts.get(h) ?? 0
  }));

  const byDay = new Map<string, number>();
  for (const g of guests) {
    const key = g.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  let registrationByDay: RegistrationDayDatum[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
  if (registrationByDay.length > 45) {
    registrationByDay = registrationByDay.slice(-45);
  }

  return {
    tierData,
    statusData,
    hourlyData,
    registrationByDay,
    totalGuests: guests.length
  };
}

function formatHourLabel(h: number) {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

export type TopEventDatum = { id: string; name: string; guestCount: number; date: Date };

export type OrgAnalyticsData = {
  tierData: TierDatum[];
  statusData: StatusDatum[];
  topEvents: TopEventDatum[];
  totalGuests: number;
  totalEvents: number;
};

/** Organization-wide aggregates (scoped by role). */
export async function getOrgAnalytics(orgId: string, userId: string, role: Role): Promise<OrgAnalyticsData> {
  const gWhere = guestFilterForOrg(orgId, userId, role);

  const eventWhere = visibleEventsWhere(orgId, userId, role);

  const [tierRows, statusRows, totalGuests, totalEvents, eventsWithCounts] = await Promise.all([
    prisma.guest.groupBy({
      by: ["tier"],
      where: gWhere,
      _count: { _all: true }
    }),
    prisma.guest.groupBy({
      by: ["status"],
      where: gWhere,
      _count: { _all: true }
    }),
    prisma.guest.count({ where: gWhere }),
    prisma.event.count({ where: eventWhere }),
    prisma.event.findMany({
      where: eventWhere,
      select: {
        id: true,
        name: true,
        date: true,
        _count: {
          select: {
            guests: isSalesRepRole(role) ? { where: { repId: userId } } : true
          }
        }
      },
      take: 60,
      orderBy: { date: "desc" }
    })
  ]);

  const tierOrder = [Tier.A, Tier.B, Tier.C];
  const tierData: TierDatum[] = tierOrder.map((t) => {
    const row = tierRows.find((r) => r.tier === t);
    return { tier: t, count: row?._count._all ?? 0 };
  });

  const statusData: StatusDatum[] = statusRows
    .map((r) => ({
      status: r.status,
      count: r._count._all,
      label: STATUS_LABEL[r.status]
    }))
    .sort((a, b) => b.count - a.count);

  const topEvents: TopEventDatum[] = [...eventsWithCounts]
    .map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      guestCount: e._count.guests
    }))
    .sort((a, b) => b.guestCount - a.guestCount)
    .slice(0, 8);

  return {
    tierData,
    statusData,
    topEvents,
    totalGuests,
    totalEvents
  };
}
