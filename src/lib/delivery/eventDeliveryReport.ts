import {
  GuestMessageDeliveryStatus,
  type GuestMessageChannel,
  type Prisma
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
import { normalizeCompanyKey } from "@/lib/guests/companyNormalization";
import { prisma } from "@/lib/prisma";
import { isSalesRepRole } from "@/lib/permissions";

export type DeliveryReportStatus = "SENT" | "FAILED" | "SKIPPED";

export type UnifiedDeliveryRow = {
  id: string;
  at: Date;
  guestId: string;
  guestName: string;
  guestEmail: string | null;
  channel: "EMAIL" | "SMS";
  kind: string;
  kindLabel: string;
  status: DeliveryReportStatus;
  recipient: string | null;
  errorCode: DeliveryErrorCode | null;
  errorDetail: string | null;
  source: "system" | "custom";
  campaignLabel: string | null;
};

export type GuestCleanupRow = {
  guestId: string;
  guestName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  failedAttempts: number;
  lastFailureAt: Date | null;
  tags: DataQualityTag[];
  highestSeverity: ReturnType<typeof highestSeverity>;
};

export type EventDeliveryReport = {
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
  };
  deliveries: UnifiedDeliveryRow[];
  cleanupGuests: GuestCleanupRow[];
};

function mapNotificationChannel(channel: string, detail?: string | null): "EMAIL" | "SMS" {
  return resolveStoredDeliveryChannel(channel, detail);
}

function guestScope(
  eventId: string,
  orgId: string,
  userId: string,
  role: Parameters<typeof isSalesRepRole>[0]
): Prisma.GuestWhereInput {
  return {
    eventId,
    event: { orgId },
    ...(isSalesRepRole(role) ? { repId: userId } : {})
  };
}

export async function getEventDeliveryReport(
  eventId: string,
  orgId: string,
  userId: string,
  role: Parameters<typeof isSalesRepRole>[0],
  opts?: { limit?: number }
): Promise<EventDeliveryReport | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true }
  });
  if (!event) return null;

  const scope = guestScope(eventId, orgId, userId, role);
  const guestIds = (
    await prisma.guest.findMany({
      where: scope,
      select: { id: true }
    })
  ).map((g) => g.id);

  if (guestIds.length === 0 && isSalesRepRole(role)) {
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
        criticalIssues: 0
      },
      deliveries: [],
      cleanupGuests: []
    };
  }

  const limit = opts?.limit ?? 500;

  const [systemLogs, customDeliveries, guests] = await Promise.all([
    prisma.guestNotificationLog.findMany({
      where: {
        eventId,
        ...(guestIds.length ? { guestId: { in: guestIds } } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        guestId: true,
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
        campaign: { eventId, event: { orgId } },
        ...(guestIds.length ? { guestId: { in: guestIds } } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit,
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
            channel: true,
            templateHeadline: true,
            templateSubject: true,
            scope: true
          }
        }
      }
    }),
    prisma.guest.findMany({
      where: scope,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        notificationsSuppressedAt: true
      }
    })
  ]);

  const unified: UnifiedDeliveryRow[] = [];

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
      campaignLabel: null
    });
  }

  for (const d of customDeliveries) {
    const channel: "EMAIL" | "SMS" =
      d.campaign.channel === "SMS" ? "SMS" : "EMAIL";
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
      campaignLabel: d.campaign.templateHeadline ?? d.campaign.templateSubject
    });
  }

  unified.sort((a, b) => b.at.getTime() - a.at.getTime());
  const deliveries = unified.slice(0, limit);

  const attemptsByGuest = new Map<
    string,
    Array<{ at: Date; channel: "EMAIL" | "SMS"; status: DeliveryReportStatus }>
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

  const companyKeys = new Set<string>();
  for (const g of guests) {
    const key = g.company ? normalizeCompanyKey(g.company) : "";
    if (key) companyKeys.add(key);
  }

  const cleanupGuests: GuestCleanupRow[] = [];
  for (const g of guests) {
    const hist = failureByGuest.get(g.id) ?? {
      emailFailed: 0,
      smsFailed: 0,
      totalFailed: 0,
      lastFailureAt: null
    };
    const tags = assessGuestContactQuality(g, hist, { peerCompanyKeys: companyKeys });
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
      highestSeverity: highestSeverity(tags)
    });
  }

  cleanupGuests.sort((a, b) => {
    const rank = { critical: 0, error: 1, warning: 2, info: 3, null: 4 };
    const ar = rank[a.highestSeverity ?? "null"];
    const br = rank[b.highestSeverity ?? "null"];
    if (ar !== br) return ar - br;
    return b.failedAttempts - a.failedAttempts;
  });

  const summary = {
    totalAttempts: deliveries.length,
    sent: deliveries.filter((d) => d.status === "SENT").length,
    failed: deliveries.filter((d) => d.status === "FAILED").length,
    skipped: deliveries.filter((d) => d.status === "SKIPPED").length,
    emailSent: deliveries.filter((d) => d.channel === "EMAIL" && d.status === "SENT").length,
    emailFailed: deliveries.filter((d) => d.channel === "EMAIL" && d.status === "FAILED").length,
    smsSent: deliveries.filter((d) => d.channel === "SMS" && d.status === "SENT").length,
    smsFailed: deliveries.filter((d) => d.channel === "SMS" && d.status === "FAILED").length,
    guestsNeedingCleanup: cleanupGuests.length,
    criticalIssues: cleanupGuests.filter((g) => g.highestSeverity === "critical").length
  };

  return { summary, deliveries, cleanupGuests };
}

export function channelLabel(channel: GuestMessageChannel): "EMAIL" | "SMS" {
  return channel === "SMS" ? "SMS" : "EMAIL";
}
