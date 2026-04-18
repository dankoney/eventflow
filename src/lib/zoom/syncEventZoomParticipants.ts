import { createHash } from "crypto";

import {
  AttendMode,
  EventStatus,
  GuestJoinSource,
  GuestStatus,
  Tier
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  fetchZoomDashboardParticipants,
  fetchZoomParticipantReport,
  mergeZoomParticipantRows,
  participantEmailFromReport,
  participantStableId,
  type ZoomReportParticipant
} from "@/lib/zoom/zoomParticipantReports";

export type SyncZoomParticipantsResult = {
  fetched: number;
  reportRows: number;
  liveDashboardRows: number;
  pastDashboardRows: number;
  matchedUpdated: number;
  externalCreated: number;
  skippedNoIdentifier: number;
};

function zoomDisplayRaw(p: ZoomReportParticipant): string {
  return (p.name ?? p.user_name ?? p.participant_user_name ?? "").trim();
}

function displayNameFromParticipant(p: ZoomReportParticipant): string {
  return zoomDisplayRaw(p) || "Zoom participant";
}

function syntheticEmailForParticipant(eventId: string, participantId: string): string {
  const safePid = participantId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return `zoom-${eventId.slice(0, 8)}-${safePid}@external.eventflow`.slice(0, 120);
}

/** Stable synthetic email for name-only participants (re-sync safe when join_time is present). */
function anonymousDedupeEmail(eventId: string, p: ZoomReportParticipant, displayName: string): string {
  const join = (p.join_time ?? "").trim();
  const h = createHash("sha256")
    .update(`${eventId}|${displayName}|${join}`)
    .digest("hex")
    .slice(0, 28);
  return `zoom-anon-${h}@external.eventflow`;
}

async function markGuestJoinedFromReport(guestId: string, reportId: string | null): Promise<void> {
  const g = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { status: true, zoomParticipantReportId: true }
  });
  if (!g) return;

  const nextStatus =
    g.status === GuestStatus.INVITED || g.status === GuestStatus.REGISTERED
      ? GuestStatus.JOINED
      : undefined;

  const attachReportId =
    reportId && !g.zoomParticipantReportId ? reportId : undefined;

  if (nextStatus === undefined && attachReportId === undefined) return;

  await prisma.guest.update({
    where: { id: guestId },
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(attachReportId ? { zoomParticipantReportId: attachReportId } : {})
    }
  });
}

/**
 * Merge Zoom **dashboard** (live + recent) and **report** (post-session) participants, then:
 * - Match roster guests by email → JOINED
 * - Create EXTERNAL_JOIN rows for unknown emails or anonymous display names
 */
export async function syncEventGuestsFromZoomParticipantReport(input: {
  eventId: string;
  orgId: string;
}): Promise<SyncZoomParticipantsResult> {
  const event = await prisma.event.findFirst({
    where: { id: input.eventId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      zoomMeetingId: true,
      zoomSessionKind: true
    }
  });

  if (!event?.zoomMeetingId) {
    throw new Error("This event has no Zoom meeting or webinar ID.");
  }

  if (
    event.status !== EventStatus.PUBLISHED &&
    event.status !== EventStatus.LIVE &&
    event.status !== EventStatus.COMPLETED
  ) {
    throw new Error(
      "Zoom participant sync is only available for published, live, or completed events."
    );
  }

  const reportRows = await fetchZoomParticipantReport(
    event.zoomSessionKind,
    event.zoomMeetingId,
    input.orgId
  );

  let liveDashboardRows: ZoomReportParticipant[] = [];
  let pastDashboardRows: ZoomReportParticipant[] = [];
  try {
    liveDashboardRows = await fetchZoomDashboardParticipants(
      event.zoomSessionKind,
      event.zoomMeetingId,
      input.orgId,
      "live"
    );
  } catch {
    liveDashboardRows = [];
  }
  try {
    pastDashboardRows = await fetchZoomDashboardParticipants(
      event.zoomSessionKind,
      event.zoomMeetingId,
      input.orgId,
      "past"
    );
  } catch {
    pastDashboardRows = [];
  }

  const participants = mergeZoomParticipantRows([
    ...liveDashboardRows,
    ...pastDashboardRows,
    ...reportRows
  ]);

  const dedupeKey = (p: ZoomReportParticipant) =>
    participantStableId(p) ?? participantEmailFromReport(p) ?? `anon:${(p.join_time ?? "").trim()}:${zoomDisplayRaw(p)}`;

  const seen = new Set<string>();
  const unique = participants.filter((p) => {
    const k = dedupeKey(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let matchedUpdated = 0;
  let externalCreated = 0;
  let skippedNoIdentifier = 0;

  for (const p of unique) {
    const emailNorm = participantEmailFromReport(p);
    const stableId = participantStableId(p);
    const rawDisplay = zoomDisplayRaw(p);
    const displayDefault = displayNameFromParticipant(p);

    if (emailNorm) {
      const byEmail = await prisma.guest.findFirst({
        where: { eventId: event.id, email: emailNorm }
      });
      if (byEmail) {
        await markGuestJoinedFromReport(byEmail.id, stableId);
        matchedUpdated += 1;
        continue;
      }
    }

    if (stableId) {
      const byReport = await prisma.guest.findFirst({
        where: { eventId: event.id, zoomParticipantReportId: stableId }
      });
      if (byReport) {
        await markGuestJoinedFromReport(byReport.id, stableId);
        matchedUpdated += 1;
        continue;
      }
    }

    if (!emailNorm && !stableId) {
      if (!rawDisplay) {
        skippedNoIdentifier += 1;
        continue;
      }
      const emailToStore = anonymousDedupeEmail(event.id, p, rawDisplay);
      const guestName = `Anonymous Zoom Participant (${rawDisplay})`.slice(0, 200);

      const clash = await prisma.guest.findFirst({
        where: { eventId: event.id, email: emailToStore }
      });
      if (clash) {
        await markGuestJoinedFromReport(clash.id, null);
        matchedUpdated += 1;
        continue;
      }

      await prisma.guest.create({
        data: {
          eventId: event.id,
          name: guestName,
          email: emailToStore,
          tier: Tier.C,
          mode: AttendMode.VIRTUAL,
          status: GuestStatus.JOINED,
          joinSource: GuestJoinSource.EXTERNAL_JOIN
        }
      });
      externalCreated += 1;
      continue;
    }

    const emailToStore = emailNorm ?? syntheticEmailForParticipant(event.id, stableId!);

    const clash = await prisma.guest.findFirst({
      where: { eventId: event.id, email: emailToStore }
    });
    if (clash) {
      await markGuestJoinedFromReport(clash.id, stableId);
      matchedUpdated += 1;
      continue;
    }

    await prisma.guest.create({
      data: {
        eventId: event.id,
        name: displayDefault,
        email: emailToStore,
        tier: Tier.C,
        mode: AttendMode.VIRTUAL,
        status: GuestStatus.JOINED,
        joinSource: GuestJoinSource.EXTERNAL_JOIN,
        zoomParticipantReportId: stableId ?? undefined
      }
    });
    externalCreated += 1;
  }

  return {
    fetched: participants.length,
    reportRows: reportRows.length,
    liveDashboardRows: liveDashboardRows.length,
    pastDashboardRows: pastDashboardRows.length,
    matchedUpdated,
    externalCreated,
    skippedNoIdentifier
  };
}
