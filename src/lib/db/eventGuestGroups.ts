import { prisma } from "@/lib/prisma";

export type EventGuestGroupRow = {
  id: string;
  name: string;
  sortOrder: number;
  guestCount: number;
};

export async function listEventGuestGroupsForEvent(
  eventId: string,
  orgId: string
): Promise<EventGuestGroupRow[]> {
  const ev = await prisma.event.findFirst({ where: { id: eventId, orgId }, select: { id: true } });
  if (!ev) return [];

  const groups = await prisma.eventGuestGroup.findMany({
    where: { eventId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { guests: true } } }
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    sortOrder: g.sortOrder,
    guestCount: g._count.guests
  }));
}

export async function countGuestsUngrouped(eventId: string, orgId: string): Promise<number> {
  const ev = await prisma.event.findFirst({ where: { id: eventId, orgId }, select: { id: true } });
  if (!ev) return 0;
  return prisma.guest.count({ where: { eventId, eventGuestGroupId: null } });
}
