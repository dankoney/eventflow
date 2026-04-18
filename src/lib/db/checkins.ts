import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isRepScopedRole } from "@/lib/permissions";

export type RecentCheckInRow = {
  id: string;
  checkedInAt: Date;
  method: string;
  guestName: string;
  guestEmail: string;
};

export async function listRecentCheckInsForEvent(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role,
  limit = 25
): Promise<RecentCheckInRow[]> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true }
  });
  if (!event) return [];

  const guestFilter =
    isRepScopedRole(role) ? ({ eventId, repId: userId } as const) : ({ eventId } as const);

  const rows = await prisma.checkIn.findMany({
    where: { guest: guestFilter },
    orderBy: { checkedInAt: "desc" },
    take: limit,
    include: {
      guest: { select: { name: true, email: true } }
    }
  });

  return rows.map((r) => ({
    id: r.id,
    checkedInAt: r.checkedInAt,
    method: r.method,
    guestName: r.guest.name,
    guestEmail: r.guest.email
  }));
}

export type CheckInSearchHit = {
  id: string;
  name: string;
  email: string;
};

export async function searchGuestsForCheckInLookup(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role,
  query: string
): Promise<CheckInSearchHit[]> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true }
  });
  if (!event) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  return prisma.guest.findMany({
    where: {
      eventId,
      ...(isRepScopedRole(role) ? { repId: userId } : {}),
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } }
      ]
    },
    select: { id: true, name: true, email: true },
    take: 20,
    orderBy: { name: "asc" }
  });
}
