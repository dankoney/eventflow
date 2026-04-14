"use server";

import { EventStatus, EventType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createZoomWebinar } from "@/lib/zoom";
import { ActionResult, Event } from "@/types";

const eventSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  date: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  location: z.string().min(2),
  capacity: z.coerce.number().int().min(1),
  virtualCapacity: z.coerce.number().int().min(0),
  type: z.nativeEnum(EventType),
  status: z.nativeEnum(EventStatus).default(EventStatus.DRAFT)
});

function canCreateEvents(role: Role) {
  return role === "ADMIN" || role === "MARKETING";
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
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

  const { virtualCapacity, ...rest } = parsed.data;

  let zoomMeetingId: string | null = null;
  let zoomJoinUrl: string | null = null;
  let zoomPasscode: string | null = null;

  if (virtualCapacity > 0) {
    try {
      const zoom = await createZoomWebinar({
        topic: rest.name,
        startTime: rest.date,
        endDate: rest.endDate ?? null,
        description: rest.description
      });
      zoomMeetingId = zoom.zoomMeetingId;
      zoomJoinUrl = zoom.zoomJoinUrl;
      zoomPasscode = zoom.zoomPasscode;
    } catch {
      return { success: false, error: "Could not create Zoom webinar. Check Zoom credentials and host user." };
    }
  }

  try {
    const event = await prisma.event.create({
      data: {
        ...rest,
        description: rest.description ?? undefined,
        endDate: rest.endDate ?? undefined,
        virtualCapacity,
        orgId: session.user.orgId,
        zoomMeetingId,
        zoomJoinUrl,
        zoomPasscode
      }
    });
    revalidatePath("/events");
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

  try {
    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...parsed.data,
        description: parsed.data.description ?? undefined,
        endDate: parsed.data.endDate ?? undefined
      }
    });
    revalidatePath("/events");
    revalidatePath(`/events/${eventId}`);
    return { success: true, data: event };
  } catch {
    return { success: false, error: "Failed to update event" };
  }
}

const publishEventSchema = z.object({
  eventId: z.string().min(1)
});

/** Sets status from DRAFT → PUBLISHED so public registration opens. */
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

  try {
    await prisma.event.delete({ where: { id: eventId } });
    revalidatePath("/events");
    return { success: true, data: { id: eventId } };
  } catch {
    return { success: false, error: "Failed to delete event" };
  }
}
