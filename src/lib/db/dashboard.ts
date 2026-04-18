import { GuestStatus, Role, Tier } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isRepScopedRole } from "@/lib/permissions";

function eventWhere(orgId: string, userId: string, role: Role) {
  if (isRepScopedRole(role)) {
    return {
      orgId,
      guests: { some: { repId: userId } }
    } as const;
  }
  return { orgId } as const;
}

function guestWhere(orgId: string, userId: string, role: Role) {
  if (isRepScopedRole(role)) {
    return { event: { orgId }, repId: userId } as const;
  }
  return { event: { orgId } } as const;
}

export async function getDashboardStats(orgId: string, userId: string, role: Role) {
  const eventWhereClause = eventWhere(orgId, userId, role);
  const guestWhereClause = guestWhere(orgId, userId, role);

  const [totalEvents, totalGuests, tierRows, checkedIn, joined, totalForRate] = await Promise.all([
    prisma.event.count({ where: eventWhereClause }),
    prisma.guest.count({ where: guestWhereClause }),
    prisma.guest.groupBy({
      by: ["tier"],
      where: guestWhereClause,
      _count: { _all: true }
    }),
    prisma.guest.count({
      where: { ...guestWhereClause, status: GuestStatus.CHECKED_IN }
    }),
    prisma.guest.count({
      where: { ...guestWhereClause, status: GuestStatus.JOINED }
    }),
    prisma.guest.count({ where: guestWhereClause })
  ]);

  const tierACount = tierRows.find((r) => r.tier === Tier.A)?._count._all ?? 0;
  const denom = totalForRate > 0 ? totalForRate : 1;
  const avgShowRate = Math.round(((checkedIn + joined) / denom) * 100);

  return {
    totalEvents,
    totalGuests,
    tierACount,
    avgShowRate
  };
}
