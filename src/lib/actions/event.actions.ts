"use server";

import { EventStatus, EventType, GuestStatus, Role, ZoomSessionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { sendEventReminderEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { kickReminderEvaluationForEvent } from "@/lib/reminders/dispatch";
import { formatDate, formatLocationLine } from "@/lib/utils";
import { phoneToMnotifyRecipient, sendOrgMnotifyQuickSms } from "@/lib/mnotify";
import { sendOrgWhatsAppText } from "@/lib/whatsapp";
import { createZoomVirtualSession } from "@/lib/zoom";
import { ActionResult, Event } from "@/types";

const primaryHoursSchema = z.union([z.literal(24), z.literal(48), z.literal(72)]);
const finalHoursSchema = z.union([z.literal(1), z.literal(2), z.literal(5)]);

const eventSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  date: z.coerce.date(),
  endDate: z.coerce.date(),
  locationId: z.string().min(1, "Choose a venue"),
  capacity: z.coerce.number().int().min(1),
  virtualCapacity: z.coerce.number().int().min(0),
  type: z.nativeEnum(EventType),
  status: z.nativeEnum(EventStatus).optional(),
  reminderPrimaryEnabled: z.boolean(),
  reminderPrimaryHoursBefore: primaryHoursSchema,
  reminderPrimaryEmail: z.boolean(),
  reminderPrimaryWhatsapp: z.boolean(),
  reminderPrimarySms: z.boolean(),
  reminderFinalEnabled: z.boolean(),
  reminderFinalHoursBefore: finalHoursSchema,
  reminderFinalWhatsapp: z.boolean(),
  reminderFinalSms: z.boolean(),
  zoomSessionKind: z.nativeEnum(ZoomSessionKind).default(ZoomSessionKind.WEBINAR)
}).superRefine((data, ctx) => {
  if ((data.type === EventType.VIRTUAL || data.type === EventType.HYBRID) && data.virtualCapacity < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["virtualCapacity"],
      message: "Virtual and Hybrid events must have virtual capacity of at least 1."
    });
  }
  if (data.type === EventType.IN_PERSON && data.virtualCapacity > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["type"],
      message: "Set event type to Hybrid or Virtual when virtual capacity is enabled."
    });
  }
  if (data.endDate.getTime() <= data.date.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End time must be after start time."
    });
  }
});

function canCreateEvents(role: Role) {
  return role === "ADMIN" || role === "MARKETING";
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

async function sendBulkNotificationInternal(input: {
  eventId: string;
  orgId: string;
  headline: string;
}) {
  const event = await prisma.event.findFirst({
    where: { id: input.eventId, orgId: input.orgId },
    include: {
      location: true,
      org: { select: { resendApiKey: true } }
    }
  });
  if (!event) return { sent: 0 };

  const guests = await prisma.guest.findMany({
    where: { eventId: input.eventId, status: "REGISTERED" },
    select: { name: true, email: true, mode: true, zoomLink: true, qrCode: true }
  });

  let sent = 0;
  const resendApiKeyOverride = event.org.resendApiKey?.trim() || undefined;
  for (const guest of guests) {
    try {
      await sendEventReminderEmail({
        to: guest.email,
        guestName: guest.name,
        eventName: event.name,
        whenLabel: formatDate(event.date),
        locationLabel: formatLocationLine(event.location),
        headline: input.headline,
        zoomLink: guest.mode === "VIRTUAL" ? guest.zoomLink : undefined,
        qrPayload: guest.mode === "IN_PERSON" ? guest.qrCode : undefined,
        resendApiKeyOverride
      });
      sent += 1;
    } catch {
      // Best effort bulk send. Do not block lifecycle transitions.
    }
  }

  return { sent };
}

async function sendCancellationNotificationsInternal(input: { eventId: string; orgId: string }) {
  const event = await prisma.event.findFirst({
    where: { id: input.eventId, orgId: input.orgId },
    include: {
      location: true,
      org: { select: { resendApiKey: true } }
    }
  });
  if (!event) return { emails: 0, whatsapp: 0, sms: 0 };

  const guests = await prisma.guest.findMany({
    where: { eventId: input.eventId, status: GuestStatus.REGISTERED },
    select: { name: true, email: true, phone: true, mode: true, zoomLink: true, qrCode: true }
  });

  let emails = 0;
  let whatsapp = 0;
  let sms = 0;
  const headline = `Event cancelled: ${event.name}`;
  const resendApiKeyOverride = event.org.resendApiKey?.trim() || undefined;
  const smsBody = `${headline} — ${event.name} was scheduled for ${formatDate(event.date)}. Contact the organizer if you have questions.`.slice(
    0,
    450
  );

  const smsRecipients: string[] = [];
  for (const guest of guests) {
    try {
      await sendEventReminderEmail({
        to: guest.email,
        guestName: guest.name,
        eventName: event.name,
        whenLabel: formatDate(event.date),
        locationLabel: formatLocationLine(event.location),
        headline,
        zoomLink: guest.mode === "VIRTUAL" ? guest.zoomLink : undefined,
        qrPayload: guest.mode === "IN_PERSON" ? guest.qrCode : undefined,
        resendApiKeyOverride
      });
      emails += 1;
    } catch {
      /* continue */
    }
    if (guest.phone) {
      const digits = guest.phone.replace(/\D/g, "");
      if (digits.length >= 10) {
        const wa = await sendOrgWhatsAppText(
          event.orgId,
          `+${digits}`,
          `${headline} — ${event.name} was scheduled for ${formatDate(event.date)}. Contact the organizer if you have questions.`
        );
        if (wa.ok) whatsapp += 1;
        const m = phoneToMnotifyRecipient(guest.phone);
        if (m) smsRecipients.push(m);
      }
    }
  }

  const uniqueSms = [...new Set(smsRecipients)];
  if (uniqueSms.length > 0) {
    const smsRes = await sendOrgMnotifyQuickSms(event.orgId, uniqueSms, smsBody);
    if (smsRes.ok) sms = smsRes.totalSent ?? uniqueSms.length;
  }

  return { emails, whatsapp, sms };
}

const sendBulkNotificationSchema = z.object({
  eventId: z.string().min(1),
  headline: z.string().min(3).max(180)
});

export async function sendBulkNotification(
  input: z.input<typeof sendBulkNotificationSchema>
): Promise<ActionResult<{ sent: number }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to send bulk notifications." };
  }
  const parsed = sendBulkNotificationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const result = await sendBulkNotificationInternal({
    eventId: parsed.data.eventId,
    orgId: session.user.orgId,
    headline: parsed.data.headline
  });
  return { success: true, data: result };
}

export async function createEvent(
  input: z.input<typeof eventSchema>
): Promise<ActionResult<Event>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to create events." };
  }

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const loc = await prisma.location.findFirst({
    where: { id: parsed.data.locationId, orgId: session.user.orgId }
  });
  if (!loc) return { success: false, error: "Venue not found for your organization." };

  const { virtualCapacity, zoomSessionKind, ...rest } = parsed.data;

  let zoomMeetingId: string | null = null;
  let zoomJoinUrl: string | null = null;
  let zoomPasscode: string | null = null;

  if (virtualCapacity > 0) {
    try {
      const zoom = await createZoomVirtualSession(
        zoomSessionKind,
        {
          topic: rest.name,
          startTime: rest.date,
          endDate: rest.endDate,
          description: rest.description
        },
        session.user.orgId
      );
      zoomMeetingId = zoom.zoomMeetingId;
      zoomJoinUrl = zoom.zoomJoinUrl;
      zoomPasscode = zoom.zoomPasscode;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: `Could not create Zoom link (${zoomSessionKind}). ${detail}`.slice(0, 700)
      };
    }
  }

  try {
    const event = await prisma.event.create({
      data: {
        ...rest,
        description: rest.description ?? undefined,
        endDate: rest.endDate,
        virtualCapacity,
        zoomSessionKind,
        orgId: session.user.orgId,
        status: rest.status ?? EventStatus.DRAFT,
        zoomMeetingId,
        zoomJoinUrl,
        zoomPasscode
      }
    });
    revalidatePath("/events");
    void kickReminderEvaluationForEvent(event.id);
    return { success: true, data: event };
  } catch {
    return { success: false, error: "Failed to create event" };
  }
}

export async function updateEvent(
  eventId: string,
  input: z.input<typeof eventSchema>
): Promise<ActionResult<Event>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to update events." };
  }

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.event.findFirst({
    where: { id: eventId, orgId: session.user.orgId }
  });
  if (!existing) return { success: false, error: "Event not found" };
  if (existing.status === EventStatus.COMPLETED || existing.status === EventStatus.CANCELLED) {
    return { success: false, error: "Completed or cancelled events are locked and cannot be edited." };
  }

  const loc = await prisma.location.findFirst({
    where: { id: parsed.data.locationId, orgId: session.user.orgId }
  });
  if (!loc) return { success: false, error: "Venue not found for your organization." };

  const { virtualCapacity, zoomSessionKind, ...rest } = parsed.data;
  const nextStatus = rest.status ?? existing.status;
  const zoomSessionKindToStore =
    existing.zoomMeetingId && virtualCapacity > 0 ? existing.zoomSessionKind : zoomSessionKind;

  try {
    let zoomMeetingId = existing.zoomMeetingId;
    let zoomJoinUrl = existing.zoomJoinUrl;
    let zoomPasscode = existing.zoomPasscode;

    if (virtualCapacity > 0 && !existing.zoomMeetingId) {
      try {
        const zoom = await createZoomVirtualSession(
          zoomSessionKindToStore,
          {
            topic: rest.name,
            startTime: rest.date,
            endDate: rest.endDate,
            description: rest.description
          },
          session.user.orgId
        );
        zoomMeetingId = zoom.zoomMeetingId;
        zoomJoinUrl = zoom.zoomJoinUrl;
        zoomPasscode = zoom.zoomPasscode;
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        return {
          success: false,
          error: `Could not create Zoom link (${zoomSessionKindToStore}). ${detail}`.slice(0, 700)
        };
      }
    }
    if (virtualCapacity === 0) {
      zoomMeetingId = null;
      zoomJoinUrl = null;
      zoomPasscode = null;
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...rest,
        status: nextStatus,
        description: parsed.data.description ?? undefined,
        endDate: parsed.data.endDate,
        virtualCapacity,
        zoomSessionKind: zoomSessionKindToStore,
        zoomMeetingId,
        zoomJoinUrl,
        zoomPasscode
      }
    });
    revalidatePath("/events");
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/edit`);
    revalidatePath(`/register/${eventId}`);
    void kickReminderEvaluationForEvent(event.id);
    return { success: true, data: event };
  } catch {
    return { success: false, error: "Failed to update event" };
  }
}

const cloneEventSchema = z.object({
  eventId: z.string().min(1)
});

export async function cloneEvent(
  input: z.input<typeof cloneEventSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to clone events." };
  }
  const parsed = cloneEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const source = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId }
  });
  if (!source) return { success: false, error: "Source event not found." };

  try {
    let zoomMeetingId: string | null = null;
    let zoomJoinUrl: string | null = null;
    let zoomPasscode: string | null = null;

    const cloned = await prisma.event.create({
      data: {
        name: `${source.name} (Copy)`,
        description: source.description ?? undefined,
        date: source.date,
        endDate: source.endDate,
        locationId: source.locationId,
        capacity: source.capacity,
        virtualCapacity: source.virtualCapacity,
        type: source.type,
        status: EventStatus.DRAFT,
        zoomMeetingId: null,
        zoomJoinUrl: null,
        zoomPasscode: null,
        reminderPrimaryEnabled: source.reminderPrimaryEnabled,
        reminderPrimaryHoursBefore: source.reminderPrimaryHoursBefore,
        reminderPrimaryEmail: source.reminderPrimaryEmail,
        reminderPrimaryWhatsapp: source.reminderPrimaryWhatsapp,
        reminderPrimarySms: source.reminderPrimarySms,
        reminderFinalEnabled: source.reminderFinalEnabled,
        reminderFinalHoursBefore: source.reminderFinalHoursBefore,
        reminderFinalWhatsapp: source.reminderFinalWhatsapp,
        reminderFinalSms: source.reminderFinalSms,
        zoomSessionKind: source.zoomSessionKind,
        orgId: session.user.orgId
      }
    });

    if (source.virtualCapacity > 0) {
      try {
        const zoom = await createZoomVirtualSession(
          source.zoomSessionKind,
          {
            topic: cloned.name,
            startTime: cloned.date,
            endDate: cloned.endDate,
            description: cloned.description
          },
          session.user.orgId
        );
        zoomMeetingId = zoom.zoomMeetingId;
        zoomJoinUrl = zoom.zoomJoinUrl;
        zoomPasscode = zoom.zoomPasscode;
        await prisma.event.update({
          where: { id: cloned.id },
          data: { zoomMeetingId, zoomJoinUrl, zoomPasscode }
        });
      } catch (e) {
        await prisma.event.delete({ where: { id: cloned.id } });
        const detail = e instanceof Error ? e.message : String(e);
        return {
          success: false,
          error: `Could not create a new Zoom link for the clone (${source.zoomSessionKind}). ${detail}`.slice(0, 700)
        };
      }
    }

    revalidatePath("/events");
    return { success: true, data: { id: cloned.id } };
  } catch {
    return { success: false, error: "Could not clone event." };
  }
}

const setEventStatusSchema = z.object({
  eventId: z.string().min(1),
  status: z.nativeEnum(EventStatus)
});

const markEventCompletedSchema = z.object({
  eventId: z.string().min(1)
});

/** Set status to COMPLETED after scheduled end (manual; automation still runs on cron). */
export async function markEventCompleted(
  input: z.input<typeof markEventCompletedSchema>
): Promise<ActionResult<{ status: EventStatus }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to complete events." };
  }
  const parsed = markEventCompletedSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, status: true, endDate: true }
  });
  if (!existing) return { success: false, error: "Event not found." };
  if (existing.status === EventStatus.COMPLETED || existing.status === EventStatus.CANCELLED) {
    return { success: false, error: "This event is already completed or cancelled." };
  }
  if (existing.status !== EventStatus.PUBLISHED && existing.status !== EventStatus.LIVE) {
    return { success: false, error: "Only published or live events can be marked complete." };
  }
  const now = Date.now();
  if (existing.endDate.getTime() > now) {
    return { success: false, error: "The scheduled end time has not passed yet." };
  }

  try {
    const event = await prisma.event.update({
      where: { id: parsed.data.eventId },
      data: { status: EventStatus.COMPLETED }
    });

    revalidatePath("/events");
    revalidatePath(`/events/${event.id}`);
    revalidatePath(`/events/${event.id}/edit`);
    revalidatePath(`/register/${event.id}`);
    return { success: true, data: { status: event.status } };
  } catch {
    return { success: false, error: "Failed to mark event complete." };
  }
}

export async function setEventStatus(
  input: z.input<typeof setEventStatusSchema>
): Promise<ActionResult<{ status: EventStatus }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to update event status." };
  }
  const parsed = setEventStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, status: true }
  });
  if (!existing) return { success: false, error: "Event not found." };
  if (existing.status === EventStatus.COMPLETED || existing.status === EventStatus.CANCELLED) {
    return { success: false, error: "Completed or cancelled events are locked." };
  }

  try {
    const event = await prisma.event.update({
      where: { id: parsed.data.eventId },
      data: { status: parsed.data.status }
    });

    revalidatePath("/events");
    revalidatePath(`/events/${event.id}`);
    revalidatePath(`/events/${event.id}/edit`);
    revalidatePath(`/register/${event.id}`);
    return { success: true, data: { status: event.status } };
  } catch {
    return { success: false, error: "Failed to update event status." };
  }
}

const cancelEventSchema = z.object({
  eventId: z.string().min(1),
  notifyGuests: z.boolean()
});

export async function cancelEvent(
  input: z.input<typeof cancelEventSchema>
): Promise<ActionResult<{ cancelled: true; emailsSent: number; whatsappSent: number; smsSent: number }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to cancel events." };
  }
  const parsed = cancelEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, status: true }
  });
  if (!existing) return { success: false, error: "Event not found." };
  if (existing.status !== EventStatus.PUBLISHED && existing.status !== EventStatus.LIVE) {
    return { success: false, error: "Only published or live events can be cancelled." };
  }

  try {
    await prisma.event.update({
      where: { id: parsed.data.eventId },
      data: { status: EventStatus.CANCELLED }
    });

    let emailsSent = 0;
    let whatsappSent = 0;
    let smsSent = 0;
    if (parsed.data.notifyGuests) {
      const r = await sendCancellationNotificationsInternal({
        eventId: parsed.data.eventId,
        orgId: session.user.orgId
      });
      emailsSent = r.emails;
      whatsappSent = r.whatsapp;
      smsSent = r.sms;
    }

    revalidatePath("/events");
    revalidatePath(`/events/${parsed.data.eventId}`);
    revalidatePath(`/events/${parsed.data.eventId}/edit`);
    revalidatePath(`/register/${parsed.data.eventId}`);
    return {
      success: true,
      data: { cancelled: true, emailsSent, whatsappSent, smsSent }
    };
  } catch {
    return { success: false, error: "Failed to cancel event." };
  }
}

const publishEventSchema = z.object({
  eventId: z.string().min(1)
});

export async function publishEvent(
  input: z.input<typeof publishEventSchema>
): Promise<ActionResult<{ status: EventStatus }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to publish events." };
  }

  const parsed = publishEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId }
  });
  if (!existing) return { success: false, error: "Event not found" };

  if (existing.status !== EventStatus.DRAFT) {
    return { success: false, error: "Only draft events can be published." };
  }

  try {
    const event = await prisma.event.update({
      where: { id: parsed.data.eventId },
      data: { status: EventStatus.PUBLISHED }
    });
    revalidatePath("/events");
    revalidatePath(`/events/${parsed.data.eventId}`);
    revalidatePath(`/register/${parsed.data.eventId}`);
    void kickReminderEvaluationForEvent(event.id);
    return { success: true, data: { status: event.status } };
  } catch {
    return { success: false, error: "Failed to publish event" };
  }
}

export async function deleteEvent(eventId: string): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to delete events." };
  }

  const existing = await prisma.event.findFirst({
    where: { id: eventId, orgId: session.user.orgId }
  });
  if (!existing) return { success: false, error: "Event not found" };
  const effectiveEnd = existing.endDate;
  if (effectiveEnd.getTime() > Date.now()) {
    return { success: false, error: "Only past events can be deleted." };
  }

  try {
    await prisma.event.delete({ where: { id: eventId } });
    revalidatePath("/events");
    return { success: true, data: { id: eventId } };
  } catch {
    return { success: false, error: "Failed to delete event" };
  }
}
