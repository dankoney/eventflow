import {
  GuestMessageDeliveryStatus,
  type Prisma,
  type Role
} from "@prisma/client";

import {
  classifyDeliveryError,
  notificationKindLabel,
  type DeliveryErrorCode
} from "@/lib/delivery/errorCodes";
import { resolveStoredDeliveryChannel } from "@/lib/delivery/deliveryChannel";
import {
  assessGuestContactQuality,
  buildUnresolvedDeliveryHistory,
  highestSeverity,
  type DataQualityTag
} from "@/lib/delivery/dataQuality";
import type {
  DeliveryReportStatus,
  GuestCleanupRow,
  UnifiedDeliveryRow
} from "@/lib/delivery/eventDeliveryReport";
import { normalizeCompanyKey } from "@/lib/guests/companyNormalization";
import { visibleEventsWhere } from "@/lib/db/events";
import { prisma } from "@/lib/prisma";
import { isSalesRepRole } from "@/lib/permissions";

export type OrgDeliveryRow = UnifiedDeliveryRow & {
  eventId: string;
  eventName: string;
};

export type OrgEventDeliverySummary = {
  eventId: string;
  eventName: string;
  eventDate: Date;
  sent: number;
  failed: number;
  skipped: number;
  guestsNeedingCleanup: number;
  criticalIssues: number;
};

export type OrgDeliveryReport = {
  summary: {
    totalAttempts: number;
    sent: number;
    failed: number;
    skipped: number;
    emailSent: number;
    emailFailed: number;
    smsSent: number;
    smsFailed: number;
    guestsNeedingCleanup: number;
    criticalIssues: number;
    eventCount: number;
  };
  events: OrgEventDeliverySummary[];
  /** @deprecated Use `events` — kept for compatibility during transition. */
  eventsByIssues: OrgEventDeliverySummary[];
  recentDeliveries: OrgDeliveryRow[];
  cleanupGuests: Array<GuestCleanupRow & { eventId: string; eventName: string }>;
};

function guestScope(
  orgId: string,
  userId: string,
  role: Role
): Prisma.GuestWhereInput {
  return {
    event: { orgId },
    ...(isSalesRepRole(role) ? { repId: userId } : {})
  };
}

function mapNotificationChannel(channel: string, detail?: string | null): "EMAIL" | "SMS" {
  return resolveStoredDeliveryChannel(channel, detail);
}

export async function getOrgDeliveryReport(
  orgId: string,
  userId: string,
  role: Role,
  opts?: { deliveryLimit?: number; eventLimit?: number }
): Promise<OrgDeliveryReport> {
  const scope = guestScope(orgId, userId, role);
  const deliveryLimit = opts?.deliveryLimit ?? 500;
  const eventLimit = opts?.eventLimit ?? 500;

  const guests = await prisma.guest.findMany({
    where: scope,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      eventId: true,
      notificationsSuppressedAt: true,
      event: { select: { id: true, name: true, date: true } }
    }
  });

  const guestIds = guests.map((g) => g.id);

  const orgEvents = await prisma.event.findMany({
    where: visibleEventsWhere(orgId, userId, role),
    select: { id: true, name: true, date: true },
    orderBy: { date: "desc" },
    take: eventLimit
  });

  const eventIds = orgEvents.map((e) => e.id);
  const eventNameById = new Map(orgEvents.map((e) => [e.id, e.name]));

  const empty: OrgDeliveryReport = {
    summary: {
      totalAttempts: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      emailSent: 0,
      emailFailed: 0,
      smsSent: 0,
      smsFailed: 0,
      guestsNeedingCleanup: 0,
      criticalIssues: 0,
      eventCount: 0
    },
    events: [],
    eventsByIssues: [],
    recentDeliveries: [],
    cleanupGuests: []
  };

  if (orgEvents.length === 0) return empty;

  if (guestIds.length === 0) {
    const events: OrgEventDeliverySummary[] = orgEvents.map((event) => ({
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
      sent: 0,
      failed: 0,
      skipped: 0,
      guestsNeedingCleanup: 0,
      criticalIssues: 0
    }));
    return {
      summary: {
        totalAttempts: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        emailSent: 0,
        emailFailed: 0,
        smsSent: 0,
        smsFailed: 0,
        guestsNeedingCleanup: 0,
        criticalIssues: 0,
        eventCount: orgEvents.length
      },
      events,
      eventsByIssues: [],
      recentDeliveries: [],
      cleanupGuests: []
    };
  }

  const [systemLogs, customDeliveries, logAgg] = await Promise.all([
    prisma.guestNotificationLog.findMany({
      where: {
        eventId: { in: eventIds },
        guestId: { in: guestIds }
      },
      orderBy: { createdAt: "desc" },
      take: deliveryLimit * 2,
      select: {
        id: true,
        createdAt: true,
        guestId: true,
        eventId: true,
        kind: true,
        channel: true,
        status: true,
        detail: true,
        recipient: true,
        errorCode: true,
        guest: { select: { name: true, email: true, phone: true } }
      }
    }),
    prisma.guestMessageDelivery.findMany({
      where: {
        campaign: { event: { orgId } },
        guestId: { in: guestIds }
      },
      orderBy: { createdAt: "desc" },
      take: deliveryLimit * 2,
      select: {
        id: true,
        createdAt: true,
        guestId: true,
        status: true,
        error: true,
        sentAt: true,
        guest: { select: { name: true, email: true, phone: true } },
        campaign: {
          select: {
            eventId: true,
            channel: true,
            templateHeadline: true,
            templateSubject: true,
            event: { select: { name: true } }
          }
        }
      }
    }),
    guestIds.length > 0 && eventIds.length > 0
      ? prisma.guestNotificationLog.groupBy({
          by: ["eventId", "status"],
          where: {
            eventId: { in: eventIds },
            guestId: { in: guestIds }
          },
          _count: { _all: true }
        })
      : Promise.resolve([])
  ]);

  const unified: OrgDeliveryRow[] = [];

  for (const log of systemLogs) {
    const channel = mapNotificationChannel(log.channel, log.detail);
    const status = log.status as DeliveryReportStatus;
    const errorCode =
      (log.errorCode as DeliveryErrorCode | null) ??
      (status === "FAILED" || status === "SKIPPED"
        ? classifyDeliveryError(log.detail, channel)
        : null);

    unified.push({
      id: `sys:${log.id}`,
      at: log.createdAt,
      guestId: log.guestId,
      guestName: log.guest.name,
      guestEmail: log.guest.email,
      channel,
      kind: log.kind,
      kindLabel: notificationKindLabel(log.kind),
      status,
      recipient:
        log.recipient ??
        (channel === "EMAIL" ? log.guest.email : log.guest.phone),
      errorCode,
      errorDetail: log.detail,
      source: "system",
      campaignLabel: null,
      eventId: log.eventId,
      eventName: eventNameById.get(log.eventId) ?? "Event"
    });
  }

  for (const d of customDeliveries) {
    const channel: "EMAIL" | "SMS" = d.campaign.channel === "SMS" ? "SMS" : "EMAIL";
    const status =
      d.status === GuestMessageDeliveryStatus.SENT
        ? "SENT"
        : d.status === GuestMessageDeliveryStatus.FAILED
          ? "FAILED"
          : "SKIPPED";
    const errorCode =
      status === "FAILED" || status === "SKIPPED"
        ? classifyDeliveryError(d.error, channel)
        : null;

    unified.push({
      id: `msg:${d.id}`,
      at: d.sentAt ?? d.createdAt,
      guestId: d.guestId,
      guestName: d.guest.name,
      guestEmail: d.guest.email,
      channel,
      kind: "custom_message",
      kindLabel: "Custom message",
      status,
      recipient: channel === "EMAIL" ? d.guest.email : d.guest.phone,
      errorCode,
      errorDetail: d.error,
      source: "custom",
      campaignLabel: d.campaign.templateHeadline ?? d.campaign.templateSubject,
      eventId: d.campaign.eventId,
      eventName: d.campaign.event.name
    });
  }

  unified.sort((a, b) => b.at.getTime() - a.at.getTime());
  const recentDeliveries = unified.slice(0, deliveryLimit);

  const attemptsByGuest = new Map<
    string,
    Array<{ at: Date; channel: "EMAIL" | "SMS"; status: "SENT" | "FAILED" | "SKIPPED" }>
  >();

  for (const row of unified) {
    const list = attemptsByGuest.get(row.guestId) ?? [];
    list.push({ at: row.at, channel: row.channel, status: row.status });
    attemptsByGuest.set(row.guestId, list);
  }

  const failureByGuest = new Map<string, ReturnType<typeof buildUnresolvedDeliveryHistory>>();
  for (const [guestId, attempts] of attemptsByGuest) {
    failureByGuest.set(guestId, buildUnresolvedDeliveryHistory(attempts));
  }

  const companyKeysByEvent = new Map<string, Set<string>>();
  for (const g of guests) {
    const key = g.company ? normalizeCompanyKey(g.company) : "";
    if (!key) continue;
    const set = companyKeysByEvent.get(g.eventId) ?? new Set<string>();
    set.add(key);
    companyKeysByEvent.set(g.eventId, set);
  }

  const cleanupGuests: Array<GuestCleanupRow & { eventId: string; eventName: string }> = [];
  for (const g of guests) {
    const hist = failureByGuest.get(g.id) ?? {
      emailFailed: 0,
      smsFailed: 0,
      totalFailed: 0,
      lastFailureAt: null
    };
    const tags = assessGuestContactQuality(g, hist, {
      peerCompanyKeys: companyKeysByEvent.get(g.eventId)
    });
    if (tags.length === 0 && hist.totalFailed === 0) continue;
    cleanupGuests.push({
      guestId: g.id,
      guestName: g.name,
      email: g.email,
      phone: g.phone,
      company: g.company,
      failedAttempts: hist.totalFailed,
      lastFailureAt: hist.lastFailureAt,
      tags,
      highestSeverity: highestSeverity(tags),
      eventId: g.eventId,
      eventName: g.event.name
    });
  }

  cleanupGuests.sort((a, b) => {
    const rank = { critical: 0, error: 1, warning: 2, info: 3, null: 4 };
    const ar = rank[a.highestSeverity ?? "null"];
    const br = rank[b.highestSeverity ?? "null"];
    if (ar !== br) return ar - br;
    return b.failedAttempts - a.failedAttempts;
  });

  const eventStats = new Map<string, OrgEventDeliverySummary>();

  for (const event of orgEvents) {
    eventStats.set(event.id, {
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
      sent: 0,
      failed: 0,
      skipped: 0,
      guestsNeedingCleanup: 0,
      criticalIssues: 0
    });
  }

  for (const row of logAgg) {
    const stat = eventStats.get(row.eventId);
    if (!stat) continue;
    if (row.status === "SENT") stat.sent += row._count._all;
    else if (row.status === "FAILED") stat.failed += row._count._all;
    else stat.skipped += row._count._all;
  }

  for (const g of cleanupGuests) {
    const stat = eventStats.get(g.eventId);
    if (!stat) continue;
    stat.guestsNeedingCleanup += 1;
    if (g.highestSeverity === "critical") stat.criticalIssues += 1;
  }

  const events = [...eventStats.values()].sort(
    (a, b) => b.eventDate.getTime() - a.eventDate.getTime()
  );

  const eventsByIssues = events.filter(
    (e) => e.failed > 0 || e.skipped > 0 || e.guestsNeedingCleanup > 0
  );

  const summary = {
    totalAttempts: unified.length,
    sent: unified.filter((d) => d.status === "SENT").length,
    failed: unified.filter((d) => d.status === "FAILED").length,
    skipped: unified.filter((d) => d.status === "SKIPPED").length,
    emailSent: unified.filter((d) => d.channel === "EMAIL" && d.status === "SENT").length,
    emailFailed: unified.filter((d) => d.channel === "EMAIL" && d.status === "FAILED").length,
    smsSent: unified.filter((d) => d.channel === "SMS" && d.status === "SENT").length,
    smsFailed: unified.filter((d) => d.channel === "SMS" && d.status === "FAILED").length,
    guestsNeedingCleanup: cleanupGuests.length,
    criticalIssues: cleanupGuests.filter((g) => g.highestSeverity === "critical").length,
    eventCount: orgEvents.length
  };

  return { summary, events, eventsByIssues, recentDeliveries, cleanupGuests };
}
