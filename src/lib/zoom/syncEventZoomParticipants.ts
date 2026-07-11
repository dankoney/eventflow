import { createHash } from "crypto";

import {
  AttendMode,
  EventStatus,
  GuestJoinSource,
  GuestStatus,
  Tier
} from "@prisma/client";

import { isZoomSyntheticAnonEmail } from "@/lib/zoom/anonRosterName";
import { prisma } from "@/lib/prisma";
import {
  fetchZoomDashboardParticipants,
  fetchZoomParticipantReportWithKindFallback,
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
  pastOneDashboardRows: number;
  matchedUpdated: number;
  matchedNoChange: number;
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

function participantFallsWithinEventWindow(
  p: ZoomReportParticipant,
  eventStart: Date,
  eventEnd: Date,
  now: Date,
  isLive: boolean
): boolean {
  const raw = (p.join_time ?? "").trim();
  if (!raw) return true;
  const joinedAt = new Date(raw);
  if (Number.isNaN(joinedAt.getTime())) return true;
  // For live sessions, strongly bias to "today's" active occurrence to avoid test runs.
  const from = isLive
    ? eventStart.getTime() - 6 * 60 * 60 * 1000
    : eventStart.getTime() - 2 * 60 * 60 * 1000;
  const to = isLive
    ? Math.max(eventEnd.getTime() + 2 * 60 * 60 * 1000, now.getTime() + 60 * 60 * 1000)
    : eventEnd.getTime() + 12 * 60 * 60 * 1000;
  const ts = joinedAt.getTime();
  return ts >= from && ts <= to;
}

/** Stable synthetic email for name-only participants (re-sync safe when join_time is present). */
function normalizeZoomDisplayName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Match roster guests when Zoom reports display name only (no email). */
async function findGuestByZoomDisplayName(eventId: string, displayName: string) {
  const norm = normalizeZoomDisplayName(displayName);
  if (!norm || norm.length < 2) return null;

  const candidates = await prisma.guest.findMany({
    where: {
      eventId,
      joinSource: { not: GuestJoinSource.EXTERNAL_JOIN },
      status: { not: GuestStatus.DECLINED }
    },
    select: {
      id: true,
      name: true,
      email: true,
      zoomParticipantReportId: true
    }
  });

  const matches = candidates.filter((g) => {
    if (isZoomSyntheticAnonEmail(g.email)) return false;
    return normalizeZoomDisplayName(g.name) === norm;
  });

  if (matches.length !== 1) return null;
  return matches[0];
}

function anonymousDedupeEmail(eventId: string, p: ZoomReportParticipant, displayName: string): string {
  const join = (p.join_time ?? "").trim();
  const day = (() => {
    if (!join) return "";
    const d = new Date(join);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  })();
  const normName = displayName.trim().toLowerCase().replace(/\s+/g, " ");
  const h = createHash("sha256")
    .update(`${eventId}|${normName}|${day}`)
    .digest("hex")
    .slice(0, 28);
  return `zoom-anon-${h}@external.eventflow`;
}

async function markGuestJoinedFromReport(guestId: string, reportId: string | null): Promise<boolean> {
  const g = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { status: true, zoomParticipantReportId: true }
  });
  if (!g) return false;

  const nextStatus =
    g.status === GuestStatus.INVITED ||
    g.status === GuestStatus.REGISTERED ||
    g.status === GuestStatus.ACCEPTED
      ? GuestStatus.JOINED
      : undefined;

  const attachReportId =
    reportId && !g.zoomParticipantReportId ? reportId : undefined;

  if (nextStatus === undefined && attachReportId === undefined) return false;

  await prisma.guest.update({
    where: { id: guestId },
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(attachReportId ? { zoomParticipantReportId: attachReportId } : {})
    }
  });
  return true;
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
  const now = new Date();
  const event = await prisma.event.findFirst({
    where: { id: input.eventId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      date: true,
      endDate: true,
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

  const {
    participants: reportRows,
    sessionKindUsed: reportSessionKind
  } = await fetchZoomParticipantReportWithKindFallback(
    event.zoomSessionKind,
    event.zoomMeetingId,
    input.orgId,
    { startsAt: event.date, endsAt: event.endDate }
  );

  if (reportSessionKind !== event.zoomSessionKind) {
    await prisma.event.update({
      where: { id: event.id },
      data: { zoomSessionKind: reportSessionKind }
    });
  }

  let liveDashboardRows: ZoomReportParticipant[] = [];
  let pastDashboardRows: ZoomReportParticipant[] = [];
  let pastOneDashboardRows: ZoomReportParticipant[] = [];
  let dashboardLiveError: string | null = null;
  let dashboardPastError: string | null = null;
  let dashboardPastOneError: string | null = null;
  try {
    liveDashboardRows = await fetchZoomDashboardParticipants(
      reportSessionKind,
      event.zoomMeetingId,
      input.orgId,
      "live"
    );
  } catch (e) {
    dashboardLiveError = e instanceof Error ? e.message : String(e);
    liveDashboardRows = [];
  }
  try {
    pastDashboardRows = await fetchZoomDashboardParticipants(
      reportSessionKind,
      event.zoomMeetingId,
      input.orgId,
      "past"
    );
  } catch (e) {
    dashboardPastError = e instanceof Error ? e.message : String(e);
    pastDashboardRows = [];
  }
  try {
    pastOneDashboardRows = await fetchZoomDashboardParticipants(
      reportSessionKind,
      event.zoomMeetingId,
      input.orgId,
      "pastOne"
    );
  } catch (e) {
    dashboardPastOneError = e instanceof Error ? e.message : String(e);
    pastOneDashboardRows = [];
  }

  const preFilterRows = [
    ...liveDashboardRows,
    ...pastDashboardRows,
    ...pastOneDashboardRows,
    ...reportRows
  ];

  const participants = mergeZoomParticipantRows(preFilterRows).filter((p) =>
    participantFallsWithinEventWindow(p, event.date, event.endDate, now, event.status === EventStatus.LIVE)
  );

  if (event.status === EventStatus.LIVE && participants.length === 0) {
    if (dashboardLiveError || dashboardPastError || dashboardPastOneError) {
      throw new Error(
        "No live Zoom participants returned for the current event window. Ensure your Zoom app has dashboard scope " +
          "(dashboard_meetings:read:admin or dashboard_webinars:read:admin), then retry sync."
      );
    }
    if (reportRows.length > 0) {
      throw new Error(
        "Zoom returned participants, but all are outside this event's live window (often from earlier test runs). " +
          "Use a fresh Zoom meeting/webinar for the real event, or align the event schedule window, then sync again."
      );
    }
  }

  const dedupeKey = (p: ZoomReportParticipant) => {
    const stable = participantStableId(p);
    if (stable) return stable;
    const email = participantEmailFromReport(p);
    if (email) return email;
    const display = zoomDisplayRaw(p).trim().toLowerCase().replace(/\s+/g, " ");
    if (!display) return `anon:${(p.join_time ?? "").trim()}`;
    const day = (() => {
      const raw = (p.join_time ?? "").trim();
      if (!raw) return "";
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    })();
    return `anon:${display}:${day}`;
  };

  const seen = new Set<string>();
  const unique = participants.filter((p) => {
    const k = dedupeKey(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let matchedUpdated = 0;
  let matchedNoChange = 0;
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
        const changed = await markGuestJoinedFromReport(byEmail.id, stableId);
        if (changed) matchedUpdated += 1;
        else matchedNoChange += 1;
        continue;
      }
    }

    if (stableId) {
      const byReport = await prisma.guest.findFirst({
        where: { eventId: event.id, zoomParticipantReportId: stableId }
      });
      if (byReport) {
        const changed = await markGuestJoinedFromReport(byReport.id, stableId);
        if (changed) matchedUpdated += 1;
        else matchedNoChange += 1;
        continue;
      }
    }

    if (!emailNorm && !stableId && rawDisplay) {
      const byName = await findGuestByZoomDisplayName(event.id, rawDisplay);
      if (byName) {
        const changed = await markGuestJoinedFromReport(byName.id, null);
        if (changed) matchedUpdated += 1;
        else matchedNoChange += 1;
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
        const changed = await markGuestJoinedFromReport(clash.id, null);
        if (changed) matchedUpdated += 1;
        else matchedNoChange += 1;
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
      const changed = await markGuestJoinedFromReport(clash.id, stableId);
      if (changed) matchedUpdated += 1;
      else matchedNoChange += 1;
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
    pastOneDashboardRows: pastOneDashboardRows.length,
    matchedUpdated,
    matchedNoChange,
    externalCreated,
    skippedNoIdentifier
  };
}
