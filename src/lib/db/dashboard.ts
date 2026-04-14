import { GuestStatus, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type DashboardStats = {
  totalEvents: number;
  totalGuests: number;
  tierACount: number;
  avgShowRate: number;
};

function attendedWhere() {
  return { status: { in: [GuestStatus.CHECKED_IN, GuestStatus.JOINED] } };
}

export async function getDashboardStats(
  orgId: string,
  userId: string,
  role: Role
): Promise<DashboardStats> {
  if (role === "SALES_REP") {
    const guestBase = {
      repId: userId,
      event: { orgId }
    };

    const distinctEvents = await prisma.guest.findMany({
      where: guestBase,
      select: { eventId: true },
      distinct: ["eventId"]
    });

    const totalEvents = distinctEvents.length;
    const totalGuests = await prisma.guest.count({ where: guestBase });
    const tierACount = await prisma.guest.count({
      where: { ...guestBase, tier: "A" }
    });
    const attended = await prisma.guest.count({
      where: { ...guestBase, ...attendedWhere() }
    });
    const avgShowRate = totalGuests > 0 ? Math.round((attended / totalGuests) * 1000) / 10 : 0;

    return { totalEvents, totalGuests, tierACount, avgShowRate };
  }

  const eventWhere = { orgId };
  const guestWhere = { event: eventWhere };

  const totalEvents = await prisma.event.count({ where: eventWhere });
  const totalGuests = await prisma.guest.count({ where: guestWhere });
  const tierACount = await prisma.guest.count({
    where: { ...guestWhere, tier: "A" }
  });
  const attended = await prisma.guest.count({
    where: { ...guestWhere, ...attendedWhere() }
  });
  const avgShowRate = totalGuests > 0 ? Math.round((attended / totalGuests) * 1000) / 10 : 0;

  return { totalEvents, totalGuests, tierACount, avgShowRate };
}
