import { GuestStatus, Role, Tier } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isSalesRepRole, isStaffRole, visibleEventsWhere } from "@/lib/permissions";

function guestWhere(orgId: string, userId: string, role: Role) {
  if (isStaffRole(role)) {
    return { event: visibleEventsWhere(orgId, userId, role) } as const;
  }
  if (isSalesRepRole(role)) {
    return { event: visibleEventsWhere(orgId, userId, role), repId: userId } as const;
  }
  return { event: { orgId } } as const;
}

export async function getDashboardStats(orgId: string, userId: string, role: Role) {
  const eventWhereClause = visibleEventsWhere(orgId, userId, role);
  const guestWhereClause = guestWhere(orgId, userId, role);

  const [totalEvents, totalGuests, tierRows, checkedIn, joined, totalForRate] = await Promise.all([
    prisma.event.count({ where: eventWhereClause }),
    isStaffRole(role)
      ? Promise.resolve(0)
      : prisma.guest.count({ where: guestWhereClause }),
    isStaffRole(role)
      ? Promise.resolve([])
      : prisma.guest.groupBy({
          by: ["tier"],
          where: guestWhereClause,
          _count: { _all: true }
        }),
    isStaffRole(role)
      ? Promise.resolve(0)
      : prisma.guest.count({
          where: { ...guestWhereClause, status: GuestStatus.CHECKED_IN }
        }),
    isStaffRole(role)
      ? Promise.resolve(0)
      : prisma.guest.count({
          where: { ...guestWhereClause, status: GuestStatus.JOINED }
        }),
    isStaffRole(role) ? Promise.resolve(0) : prisma.guest.count({ where: guestWhereClause })
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
