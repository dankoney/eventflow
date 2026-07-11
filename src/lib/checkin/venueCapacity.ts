import { AttendMode, EventType, GuestStatus } from "@prisma/client";

import { sendTransactionalEmail } from "@/lib/email";
import { sendOrgMnotifyQuickSms } from "@/lib/mnotify";
import { prisma } from "@/lib/prisma";
import { resolveCheckInDayIndexForEvent } from "@/lib/event-schedule/multiDayConfig";

export const CAPACITY_ALERT_THRESHOLDS = [80, 100] as const;

export type VenueCapacitySnapshot = {
  dayIndex: number;
  capacity: number;
  checkedInCount: number;
  percent: number;
  atCapacity: boolean;
};

/** In-person guests checked in for this session day (door count). */
export async function countInPersonCheckedInForDay(
  eventId: string,
  dayIndex: number
): Promise<number> {
  return prisma.checkIn.count({
    where: {
      dayIndex,
      guest: {
        eventId,
        mode: AttendMode.IN_PERSON,
        status: { not: GuestStatus.DECLINED }
      }
    }
  });
}

export async function getVenueCapacitySnapshot(
  eventId: string,
  dayIndex: number,
  capacity: number
): Promise<VenueCapacitySnapshot> {
  const checkedInCount = await countInPersonCheckedInForDay(eventId, dayIndex);
  const percent = capacity > 0 ? Math.min(100, Math.round((checkedInCount / capacity) * 100)) : 0;
  return {
    dayIndex,
    capacity,
    checkedInCount,
    percent,
    atCapacity: capacity > 0 && checkedInCount >= capacity
  };
}

export type VenueCapacityBlockResult =
  | { ok: true }
  | { ok: false; error: string; snapshot: VenueCapacitySnapshot };

/**
 * Blocks new in-person check-ins when the door count has reached event.capacity.
 * `additionalCount` is how many new check-ins you intend to add in this operation.
 */
export async function assertVenueCapacityForCheckIn(
  eventId: string,
  additionalCount = 1
): Promise<VenueCapacityBlockResult> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      capacity: true,
      type: true,
      scheduleMode: true,
      multiDayConfig: true
    }
  });
  if (!event) {
    return {
      ok: false,
      error: "Event not found.",
      snapshot: { dayIndex: 1, capacity: 0, checkedInCount: 0, percent: 0, atCapacity: true }
    };
  }

  if (event.type === EventType.VIRTUAL) {
    const snap = await getVenueCapacitySnapshot(eventId, 1, event.capacity);
    return { ok: true };
  }

  const window = resolveCheckInDayIndexForEvent(event.scheduleMode, event.multiDayConfig);
  if (!window.ok) {
    return {
      ok: false,
      error: window.error ?? "Check-in is not open.",
      snapshot: { dayIndex: 1, capacity: event.capacity, checkedInCount: 0, percent: 0, atCapacity: false }
    };
  }

  const snapshot = await getVenueCapacitySnapshot(eventId, window.dayIndex, event.capacity);
  if (snapshot.atCapacity || snapshot.checkedInCount + additionalCount > event.capacity) {
    return {
      ok: false,
      error: `Venue is at capacity (${snapshot.checkedInCount}/${event.capacity} checked in). Please see event staff.`,
      snapshot
    };
  }

  return { ok: true };
}

async function listOrgAdminNotifyTargets(orgId: string) {
  return prisma.user.findMany({
    where: {
      orgId,
      role: { in: ["ADMIN", "MARKETING"] }
    },
    select: { email: true, name: true }
  });
}

async function tryRecordCapacityAlert(
  eventId: string,
  dayIndex: number,
  threshold: number
): Promise<boolean> {
  try {
    await prisma.eventCapacityAlert.create({
      data: { eventId, dayIndex, threshold }
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * After a check-in, notify org admins once per threshold (80% and 100%) via email + SMS.
 */
export async function maybeNotifyOrgAdminsVenueCapacity(
  eventId: string,
  dayIndex: number
): Promise<void> {
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      capacity: true,
      orgId: true,
      org: { select: { name: true, resendApiKey: true, mnotifyEnabled: true } }
    }
  });
  if (!event || event.capacity <= 0) return;

  const snapshot = await getVenueCapacitySnapshot(eventId, dayIndex, event.capacity);

  for (const threshold of CAPACITY_ALERT_THRESHOLDS) {
    if (snapshot.percent < threshold) continue;

    const recorded = await tryRecordCapacityAlert(eventId, dayIndex, threshold);
    if (!recorded) continue;

    const admins = await listOrgAdminNotifyTargets(event.orgId);
    if (admins.length === 0) continue;

    const level =
      threshold >= 100
        ? "full"
        : "approaching";
    const subject =
      threshold >= 100
        ? `Venue at capacity: ${event.name}`
        : `Venue ${snapshot.percent}% full: ${event.name}`;
    const bodyText = `Eventflow door alert for "${event.name}" (day ${dayIndex}): ${snapshot.checkedInCount} of ${event.capacity} in-person guests checked in (${snapshot.percent}%). ${
      threshold >= 100
        ? "The venue is at capacity — new walk-ins may be blocked at the kiosk."
        : "You are approaching venue capacity."
    }`;

    const html = `<p style="font-family:system-ui,sans-serif;font-size:15px;color:#0f172a;">${bodyText}</p><p style="font-family:system-ui,sans-serif;font-size:13px;color:#64748b;">Open the live door dashboard in Eventflow to monitor check-ins.</p>`;

    const resendKey = event.org.resendApiKey?.trim() || undefined;
    for (const admin of admins) {
      try {
        await sendTransactionalEmail({
          to: admin.email,
          subject,
          html,
          resendApiKeyOverride: resendKey
        });
      } catch (e) {
        console.error("[capacity-alert] email failed", admin.email, e);
      }
    }

    if (event.org.mnotifyEnabled) {
      const orgContacts = await prisma.orgContact.findMany({
        where: {
          orgId: event.orgId,
          NOT: { phone: "" }
        },
        select: { phone: true },
        take: 5
      });
      const phones = orgContacts
        .map((c) => c.phone.trim())
        .filter((p) => p.length > 0);
      if (phones.length > 0) {
        const sms = `${event.org.name}: ${event.name} door ${level} — ${snapshot.checkedInCount}/${event.capacity} checked in (${snapshot.percent}%).`;
        try {
          await sendOrgMnotifyQuickSms(event.orgId, phones, sms.slice(0, 300));
        } catch (e) {
          console.error("[capacity-alert] sms failed", e);
        }
      }
    }
  }
}
