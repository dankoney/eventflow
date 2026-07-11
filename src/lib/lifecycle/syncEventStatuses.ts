import { EventStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import { eventCompletionAt } from "./eventTiming";

function revalidateEventPaths(eventId: string) {
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/edit`);
  revalidatePath(`/register/${eventId}`);
}

/**
 * Time-based transitions (batch):
 * - PUBLISHED → LIVE when now >= start (date) and before completion threshold.
 * - PUBLISHED or LIVE → COMPLETED when now >= endDate + 6h.
 */
export async function syncEventStatuses(now = new Date()): Promise<{ completed: number; live: number }> {
  const candidates = await prisma.event.findMany({
    where: { status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] } },
    select: { id: true, date: true, endDate: true, status: true }
  });

  let completed = 0;
  let live = 0;

  for (const ev of candidates) {
    const completeAt = eventCompletionAt(ev.endDate);
    if (now.getTime() >= completeAt.getTime()) {
      await prisma.event.update({
        where: { id: ev.id },
        data: { status: EventStatus.COMPLETED }
      });
      completed += 1;
      revalidateEventPaths(ev.id);
      continue;
    }
    if (ev.status === EventStatus.PUBLISHED && now.getTime() >= ev.date.getTime()) {
      await prisma.event.update({
        where: { id: ev.id },
        data: { status: EventStatus.LIVE }
      });
      live += 1;
      revalidateEventPaths(ev.id);
    }
  }

  return { completed, live };
}

/**
 * Same rules for a single event (call on event detail fetch).
 */
export async function syncEventStatusForEvent(eventId: string, now = new Date()): Promise<void> {
  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, date: true, endDate: true, status: true }
  });
  if (!ev || (ev.status !== EventStatus.PUBLISHED && ev.status !== EventStatus.LIVE)) return;

  const completeAt = eventCompletionAt(ev.endDate);
  if (now.getTime() >= completeAt.getTime()) {
    await prisma.event.update({
      where: { id: ev.id },
      data: { status: EventStatus.COMPLETED }
    });
    revalidateEventPaths(ev.id);
    return;
  }
  if (ev.status === EventStatus.PUBLISHED && now.getTime() >= ev.date.getTime()) {
    await prisma.event.update({
      where: { id: ev.id },
      data: { status: EventStatus.LIVE }
    });
    revalidateEventPaths(ev.id);
  }
}
