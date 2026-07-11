import { AttendMode, EventStatus, GuestStatus } from "@prisma/client";

import { getVenueCapacitySnapshot } from "@/lib/checkin/venueCapacity";
import { resolveCheckInDayIndexForEvent } from "@/lib/event-schedule/multiDayConfig";
import { prisma } from "@/lib/prisma";
import type { RecentCheckInRow } from "@/lib/db/checkins";

export type DoorDashboardSnapshot = {
  eventId: string;
  eventName: string;
  eventStatus: EventStatus;
  dayIndex: number;
  capacity: number;
  checkedInCount: number;
  registeredInPersonCount: number;
  percent: number;
  atCapacity: boolean;
  checkInOpen: boolean;
  checkInWindowError: string | null;
  recent: RecentCheckInRow[];
  updatedAt: string;
};

export async function getDoorDashboardSnapshot(
  eventId: string,
  orgId: string
): Promise<DoorDashboardSnapshot | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: {
      id: true,
      name: true,
      status: true,
      capacity: true,
      scheduleMode: true,
      multiDayConfig: true
    }
  });
  if (!event) return null;

  const window = resolveCheckInDayIndexForEvent(event.scheduleMode, event.multiDayConfig);
  const dayIndex = window.ok ? window.dayIndex : 1;

  const [capacitySnap, registeredInPersonCount, recentRows] = await Promise.all([
    getVenueCapacitySnapshot(event.id, dayIndex, event.capacity),
    prisma.guest.count({
      where: {
        eventId: event.id,
        mode: AttendMode.IN_PERSON,
        status: { not: GuestStatus.DECLINED }
      }
    }),
    prisma.checkIn.findMany({
      where: { guest: { eventId: event.id }, dayIndex },
      orderBy: { checkedInAt: "desc" },
      take: 20,
      include: {
        guest: { select: { id: true, name: true, email: true } }
      }
    })
  ]);

  const recent: RecentCheckInRow[] = recentRows.map((r) => ({
    id: r.id,
    guestId: r.guest.id,
    checkedInAt: r.checkedInAt,
    method: r.method,
    dayIndex: r.dayIndex,
    guestName: r.guest.name,
    guestEmail: r.guest.email
  }));

  return {
    eventId: event.id,
    eventName: event.name,
    eventStatus: event.status,
    dayIndex,
    capacity: capacitySnap.capacity,
    checkedInCount: capacitySnap.checkedInCount,
    registeredInPersonCount,
    percent: capacitySnap.percent,
    atCapacity: capacitySnap.atCapacity,
    checkInOpen: window.ok,
    checkInWindowError: window.ok ? null : (window.error ?? "Check-in window closed"),
    recent,
    updatedAt: new Date().toISOString()
  };
}

/** Lightweight poll payload (counts only). */
export async function getDoorDashboardCounts(
  eventId: string,
  orgId: string
): Promise<Pick<
  DoorDashboardSnapshot,
  "checkedInCount" | "capacity" | "percent" | "atCapacity" | "updatedAt"
> | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true, capacity: true, scheduleMode: true, multiDayConfig: true }
  });
  if (!event) return null;

  const window = resolveCheckInDayIndexForEvent(event.scheduleMode, event.multiDayConfig);
  const dayIndex = window.ok ? window.dayIndex : 1;
  const snap = await getVenueCapacitySnapshot(event.id, dayIndex, event.capacity);

  return {
    checkedInCount: snap.checkedInCount,
    capacity: snap.capacity,
    percent: snap.percent,
    atCapacity: snap.atCapacity,
    updatedAt: new Date().toISOString()
  };
}
