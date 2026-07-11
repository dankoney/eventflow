import { EventStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { syncEventGuestsFromZoomParticipantReport } from "@/lib/zoom/syncEventZoomParticipants";

export type ZoomParticipantCronRowResult = {
  eventId: string;
  orgId: string;
  ok: boolean;
  error?: string;
  fetched?: number;
  matchedUpdated?: number;
  externalCreated?: number;
};

/**
 * Sync Zoom participants for events that are in-flight or recently completed.
 * Called from `/api/cron/zoom-participant-sync` on a schedule.
 */
export async function runZoomParticipantSyncCron(
  now: Date = new Date(),
  options?: { maxEvents?: number }
): Promise<{ scanned: number; results: ZoomParticipantCronRowResult[] }> {
  const maxEvents = options?.maxEvents ?? 40;
  const completedLookbackMs = 36 * 60 * 60 * 1000; // keep syncing for 36h after end
  const completedSince = new Date(now.getTime() - completedLookbackMs);

  const events = await prisma.event.findMany({
    where: {
      zoomMeetingId: { not: null },
      OR: [
        {
          status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] },
          OR: [{ endDate: { gte: now } }, { status: EventStatus.LIVE }]
        },
        {
          status: EventStatus.COMPLETED,
          endDate: { gte: completedSince }
        }
      ]
    },
    select: { id: true, orgId: true },
    orderBy: { updatedAt: "asc" },
    take: maxEvents
  });

  const results: ZoomParticipantCronRowResult[] = [];

  for (const ev of events) {
    try {
      const data = await syncEventGuestsFromZoomParticipantReport({
        eventId: ev.id,
        orgId: ev.orgId
      });
      results.push({
        eventId: ev.id,
        orgId: ev.orgId,
        ok: true,
        fetched: data.fetched,
        matchedUpdated: data.matchedUpdated,
        externalCreated: data.externalCreated
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        eventId: ev.id,
        orgId: ev.orgId,
        ok: false,
        error: msg.slice(0, 400)
      });
    }
  }

  return { scanned: events.length, results };
}
