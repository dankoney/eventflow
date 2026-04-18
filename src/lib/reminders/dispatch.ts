import { AttendMode, EventStatus, Prisma } from "@prisma/client";

import { sendEventReminderEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { phoneToMnotifyRecipient, sendOrgMnotifyQuickSms } from "@/lib/mnotify";
import { sendOrgWhatsAppText } from "@/lib/whatsapp";
import { getOpenZoomJoinAbsoluteUrl } from "@/lib/url";
import { formatDate, formatLocationLine } from "@/lib/utils";

const WINDOW_MS = 20 * 60 * 1000;

function anchorAt(eventDate: Date, hoursBefore: number): Date {
  return new Date(eventDate.getTime() - hoursBefore * 60 * 60 * 1000);
}

function inDispatchWindow(now: Date, target: Date): boolean {
  return now.getTime() >= target.getTime() && now.getTime() < target.getTime() + WINDOW_MS;
}

export const eventReminderInclude = {
  location: true,
  org: { select: { resendApiKey: true } }
} as const satisfies Prisma.EventInclude;

export type EventForReminderDelivery = Prisma.EventGetPayload<{ include: typeof eventReminderInclude }>;

/**
 * Sends primary reminder content (email / WhatsApp / SMS) for one event.
 * Does not write `EventReminderLog` — safe for manual “send now” without affecting cron.
 */
export async function deliverPrimaryReminderPayloads(
  event: EventForReminderDelivery,
  eventId: string
): Promise<void> {
  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: { id: true, email: true, name: true, mode: true, zoomLink: true }
  });
  const resendKey = event.org.resendApiKey?.trim() || undefined;
  if (event.reminderPrimaryEmail && guests.length) {
    for (const g of guests) {
      try {
        const zoomForEmail =
          g.mode === AttendMode.VIRTUAL && (g.zoomLink || event.zoomJoinUrl)
            ? getOpenZoomJoinAbsoluteUrl(g.id) ?? g.zoomLink ?? event.zoomJoinUrl
            : null;
        await sendEventReminderEmail({
          to: g.email,
          guestName: g.name,
          eventName: event.name,
          whenLabel: formatDate(event.date),
          locationLabel: formatLocationLine(event.location),
          headline: `Reminder: ${event.name} is coming up`,
          zoomLink: zoomForEmail ?? undefined,
          resendApiKeyOverride: resendKey
        });
      } catch {
        /* continue */
      }
    }
  }
  if (event.reminderPrimaryWhatsapp) {
    const withPhone = await prisma.guest.findMany({
      where: { eventId, NOT: { phone: null } },
      select: { phone: true },
      take: 50
    });
    for (const row of withPhone) {
      if (!row.phone) continue;
      const e164 = row.phone.replace(/\D/g, "");
      if (e164.length < 10) continue;
      await sendOrgWhatsAppText(event.orgId, `+${e164}`, `Reminder: ${event.name} at ${formatDate(event.date)}`);
    }
  }
  if (event.reminderPrimarySms) {
    const withPhone = await prisma.guest.findMany({
      where: { eventId, NOT: { phone: null } },
      select: { phone: true },
      take: 500
    });
    const nums = [
      ...new Set(
        withPhone.map((r) => phoneToMnotifyRecipient(r.phone)).filter((x): x is string => Boolean(x))
      )
    ];
    if (nums.length) {
      await sendOrgMnotifyQuickSms(
        event.orgId,
        nums,
        `Reminder: ${event.name} at ${formatDate(event.date)}`
      );
    }
  }
}

/**
 * Sends final reminder content (WhatsApp / SMS / email order matches cron).
 * Does not write `EventReminderLog`.
 */
export async function deliverFinalReminderPayloads(
  event: EventForReminderDelivery,
  eventId: string
): Promise<void> {
  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: { id: true, email: true, name: true, mode: true, zoomLink: true, qrCode: true }
  });
  const resendKeyFinal = event.org.resendApiKey?.trim() || undefined;
  if (event.reminderFinalWhatsapp) {
    const withPhone = await prisma.guest.findMany({
      where: { eventId, NOT: { phone: null } },
      select: { id: true, phone: true, mode: true, zoomLink: true, qrCode: true },
      take: 50
    });
    for (const row of withPhone) {
      if (!row.phone) continue;
      const e164 = row.phone.replace(/\D/g, "");
      if (e164.length < 10) continue;
      const bits = [`Final reminder: ${event.name}`];
      const tracked =
        row.mode === AttendMode.VIRTUAL && (row.zoomLink || event.zoomJoinUrl)
          ? getOpenZoomJoinAbsoluteUrl(row.id) ?? row.zoomLink ?? event.zoomJoinUrl
          : null;
      if (tracked) bits.push(`Join: ${tracked}`);
      else if (row.zoomLink) bits.push(`Zoom: ${row.zoomLink}`);
      if (row.qrCode) bits.push("Check-in QR was emailed at registration.");
      await sendOrgWhatsAppText(event.orgId, `+${e164}`, bits.join("\n"));
    }
  }
  if (event.reminderFinalSms) {
    const withPhoneSms = await prisma.guest.findMany({
      where: { eventId, NOT: { phone: null } },
      select: { id: true, phone: true, mode: true, zoomLink: true, qrCode: true },
      take: 200
    });
    for (const row of withPhoneSms) {
      const num = phoneToMnotifyRecipient(row.phone);
      if (!num) continue;
      const bits = [`Final: ${event.name}`];
      const tracked =
        row.mode === AttendMode.VIRTUAL && (row.zoomLink || event.zoomJoinUrl)
          ? getOpenZoomJoinAbsoluteUrl(row.id) ?? row.zoomLink ?? event.zoomJoinUrl
          : null;
      if (tracked) bits.push(tracked);
      else if (row.qrCode) bits.push("QR was emailed at registration.");
      await sendOrgMnotifyQuickSms(event.orgId, [num], bits.join(" ").slice(0, 400));
    }
  }
  for (const g of guests) {
    try {
      const zoomForEmail =
        g.mode === AttendMode.VIRTUAL && (g.zoomLink || event.zoomJoinUrl)
          ? getOpenZoomJoinAbsoluteUrl(g.id) ?? g.zoomLink ?? event.zoomJoinUrl
          : g.zoomLink;
      await sendEventReminderEmail({
        to: g.email,
        guestName: g.name,
        eventName: event.name,
        whenLabel: formatDate(event.date),
        locationLabel: formatLocationLine(event.location),
        headline: `Starting soon: ${event.name}`,
        zoomLink: zoomForEmail ?? undefined,
        qrPayload: g.qrCode,
        resendApiKeyOverride: resendKeyFinal
      });
    } catch {
      /* continue */
    }
  }
}

/** Fire-and-forget: evaluate reminder windows once after event mutations. */
export async function kickReminderEvaluationForEvent(eventId: string): Promise<void> {
  try {
    await runDueRemindersForEvent(eventId, new Date());
  } catch {
    /* best-effort */
  }
}

export async function runDueRemindersForEvent(eventId: string, now = new Date()): Promise<{ sent: number }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventReminderInclude
  });
  if (!event) return { sent: 0 };
  if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.LIVE) return { sent: 0 };

  let sent = 0;

  if (event.reminderPrimaryEnabled) {
    const target = anchorAt(event.date, event.reminderPrimaryHoursBefore);
    if (inDispatchWindow(now, target)) {
      const existing = await prisma.eventReminderLog.findFirst({
        where: { eventId, kind: "PRIMARY", anchorAt: target }
      });
      if (!existing) {
        await deliverPrimaryReminderPayloads(event, eventId);
        await prisma.eventReminderLog.create({
          data: { eventId, kind: "PRIMARY", anchorAt: target }
        });
        sent += 1;
      }
    }
  }

  if (event.reminderFinalEnabled) {
    const target = anchorAt(event.date, event.reminderFinalHoursBefore);
    if (inDispatchWindow(now, target)) {
      const existing = await prisma.eventReminderLog.findFirst({
        where: { eventId, kind: "FINAL", anchorAt: target }
      });
      if (!existing) {
        await deliverFinalReminderPayloads(event, eventId);
        await prisma.eventReminderLog.create({
          data: { eventId, kind: "FINAL", anchorAt: target }
        });
        sent += 1;
      }
    }
  }

  return { sent };
}

/** Scan recent/upcoming org events (for cron). */
export async function runDueRemindersForOrg(orgId: string, now = new Date()): Promise<{ eventsScanned: number }> {
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: {
      orgId,
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] },
      date: { gte: from, lte: to }
    },
    select: { id: true }
  });
  for (const e of events) {
    await runDueRemindersForEvent(e.id, now);
  }
  return { eventsScanned: events.length };
}
