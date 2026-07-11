import { WaitlistStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type EventWaitlistListRow = {
  id: string;
  position: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  preferredMode: string | null;
  status: WaitlistStatus;
  createdAt: Date;
  promotedToGuestId: string | null;
};

export async function listEventWaitlistForDashboard(
  eventId: string,
  orgId: string
): Promise<EventWaitlistListRow[]> {
  const ok = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true }
  });
  if (!ok) return [];

  return prisma.eventWaitlistEntry.findMany({
    where: { eventId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      position: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      preferredMode: true,
      status: true,
      createdAt: true,
      promotedToGuestId: true
    }
  });
}

export async function countEventWaitlistWaiting(eventId: string, orgId: string): Promise<number> {
  const ok = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true }
  });
  if (!ok) return 0;
  return prisma.eventWaitlistEntry.count({
    where: { eventId, status: WaitlistStatus.WAITING }
  });
}
