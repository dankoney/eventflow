import { EmailCampaignRecipientStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  EmailCampaignAnalytics,
  EmailCampaignAnalyticsDetail,
  EmailCampaignEngagementBucket,
  EmailCampaignListAnalyticsRow,
  EmailCampaignRates,
  EmailCampaignRecipientCounts
} from "@/types/emailCampaignAnalytics";

type RawCampaignAggRow = {
  campaign_id: string;
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  complained: number;
  skipped_unsubscribed: number;
};

const EMPTY_COUNTS: EmailCampaignRecipientCounts = {
  total: 0,
  pending: 0,
  sent: 0,
  delivered: 0,
  bounced: 0,
  opened: 0,
  clicked: 0,
  complained: 0,
  skipped_unsubscribed: 0
};

export function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function computeEmailCampaignRates(counts: EmailCampaignRecipientCounts): EmailCampaignRates {
  return {
    deliveryRate: safeRate(counts.delivered, counts.sent),
    openRate: safeRate(counts.opened, counts.delivered),
    clickRate: safeRate(counts.clicked, counts.delivered),
    bounceRate: safeRate(counts.bounced, counts.sent),
    complaintRate: safeRate(counts.complained, counts.delivered)
  };
}

export function formatEmailCampaignRate(rate: number | null, digits = 1): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(digits)}%`;
}

function countsFromAggRow(row: RawCampaignAggRow): EmailCampaignRecipientCounts {
  return {
    total: row.total,
    pending: row.pending,
    sent: row.sent,
    delivered: row.delivered,
    bounced: row.bounced,
    opened: row.opened,
    clicked: row.clicked,
    complained: row.complained,
    skipped_unsubscribed: row.skipped_unsubscribed
  };
}

function analyticsFromCounts(counts: EmailCampaignRecipientCounts): EmailCampaignAnalytics {
  return { counts, rates: computeEmailCampaignRates(counts) };
}

async function aggregateRecipientCountsForCampaign(
  campaignId: string
): Promise<EmailCampaignRecipientCounts> {
  const [total, pending, sent, delivered, bounced, opened, clicked, complained, skipped] =
    await Promise.all([
      prisma.emailCampaignRecipient.count({ where: { campaignId } }),
      prisma.emailCampaignRecipient.count({
        where: { campaignId, status: EmailCampaignRecipientStatus.PENDING }
      }),
      prisma.emailCampaignRecipient.count({
        where: { campaignId, sentAt: { not: null } }
      }),
      prisma.emailCampaignRecipient.count({
        where: { campaignId, deliveredAt: { not: null } }
      }),
      prisma.emailCampaignRecipient.count({
        where: { campaignId, status: EmailCampaignRecipientStatus.BOUNCED }
      }),
      prisma.emailCampaignRecipient.count({
        where: { campaignId, openedAt: { not: null } }
      }),
      prisma.emailCampaignRecipient.count({
        where: { campaignId, firstClickedAt: { not: null } }
      }),
      prisma.emailCampaignRecipient.count({
        where: { campaignId, status: EmailCampaignRecipientStatus.COMPLAINED }
      }),
      prisma.emailCampaignRecipient.count({
        where: { campaignId, status: EmailCampaignRecipientStatus.SKIPPED_UNSUBSCRIBED }
      })
    ]);

  return {
    total,
    pending,
    sent,
    delivered,
    bounced,
    opened,
    clicked,
    complained,
    skipped_unsubscribed: skipped
  };
}

async function aggregateRecipientCountsForOrg(
  orgId: string
): Promise<Map<string, EmailCampaignRecipientCounts>> {
  const rows = await prisma.$queryRaw<RawCampaignAggRow[]>`
    SELECT
      r."campaignId" AS campaign_id,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE r.status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE r."sentAt" IS NOT NULL)::int AS sent,
      COUNT(*) FILTER (WHERE r."deliveredAt" IS NOT NULL)::int AS delivered,
      COUNT(*) FILTER (WHERE r.status = 'BOUNCED')::int AS bounced,
      COUNT(*) FILTER (WHERE r."openedAt" IS NOT NULL)::int AS opened,
      COUNT(*) FILTER (WHERE r."firstClickedAt" IS NOT NULL)::int AS clicked,
      COUNT(*) FILTER (WHERE r.status = 'COMPLAINED')::int AS complained,
      COUNT(*) FILTER (WHERE r.status = 'SKIPPED_UNSUBSCRIBED')::int AS skipped_unsubscribed
    FROM "EmailCampaignRecipient" r
    INNER JOIN "EmailCampaign" c ON c.id = r."campaignId"
    WHERE c."orgId" = ${orgId}
    GROUP BY r."campaignId"
  `;

  const map = new Map<string, EmailCampaignRecipientCounts>();
  for (const row of rows) {
    map.set(row.campaign_id, countsFromAggRow(row));
  }
  return map;
}

function bucketKeyForDate(date: Date, granularity: "hour" | "day"): string {
  if (granularity === "day") {
    return date.toISOString().slice(0, 10);
  }
  const copy = new Date(date);
  copy.setUTCMinutes(0, 0, 0);
  return copy.toISOString();
}

function formatBucketLabel(bucket: string, granularity: "hour" | "day"): string {
  try {
    const d =
      granularity === "day"
        ? new Date(`${bucket}T12:00:00Z`)
        : new Date(bucket);
    if (granularity === "day") {
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" });
  } catch {
    return bucket;
  }
}

function buildEngagementTimeline(
  rows: Array<{
    sentAt: Date | null;
    deliveredAt: Date | null;
    openedAt: Date | null;
    firstClickedAt: Date | null;
  }>,
  campaignSentAt: Date | null
): EmailCampaignEngagementBucket[] {
  const events: Array<{ at: Date; field: keyof Pick<EmailCampaignEngagementBucket, "sent" | "delivered" | "opened" | "clicked"> }> =
    [];

  for (const row of rows) {
    if (row.sentAt) events.push({ at: row.sentAt, field: "sent" });
    if (row.deliveredAt) events.push({ at: row.deliveredAt, field: "delivered" });
    if (row.openedAt) events.push({ at: row.openedAt, field: "opened" });
    if (row.firstClickedAt) events.push({ at: row.firstClickedAt, field: "clicked" });
  }

  if (events.length === 0) return [];

  const minAt = Math.min(...events.map((e) => e.at.getTime()));
  const maxAt = Math.max(...events.map((e) => e.at.getTime()));
  const spanMs = maxAt - minAt;
  const granularity: "hour" | "day" = spanMs > 3 * 24 * 60 * 60 * 1000 ? "day" : "hour";

  const bucketMap = new Map<string, EmailCampaignEngagementBucket>();

  const ensureBucket = (key: string) => {
    let bucket = bucketMap.get(key);
    if (!bucket) {
      bucket = {
        bucket: key,
        label: formatBucketLabel(key, granularity),
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0
      };
      bucketMap.set(key, bucket);
    }
    return bucket;
  };

  for (const event of events) {
    const key = bucketKeyForDate(event.at, granularity);
    ensureBucket(key)[event.field] += 1;
  }

  const sortedKeys = [...bucketMap.keys()].sort();
  if (sortedKeys.length === 0) return [];

  const startKey = campaignSentAt
    ? bucketKeyForDate(campaignSentAt, granularity)
    : sortedKeys[0]!;
  if (!bucketMap.has(startKey)) {
    ensureBucket(startKey);
  }

  return [...bucketMap.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export async function getEmailCampaignAnalyticsForOrg(
  campaignId: string,
  orgId: string
): Promise<EmailCampaignAnalyticsDetail | null> {
  const campaign = await prisma.emailCampaign.findFirst({
    where: { id: campaignId, orgId },
    select: { id: true, sentAt: true }
  });
  if (!campaign) return null;

  const [counts, timelineRows] = await Promise.all([
    aggregateRecipientCountsForCampaign(campaignId),
    prisma.emailCampaignRecipient.findMany({
      where: { campaignId },
      select: {
        sentAt: true,
        deliveredAt: true,
        openedAt: true,
        firstClickedAt: true
      }
    })
  ]);

  const analytics = analyticsFromCounts(counts);
  const timeline = buildEngagementTimeline(timelineRows, campaign.sentAt);

  return { ...analytics, timeline };
}

export async function listEmailCampaignsWithAnalyticsForOrg(
  orgId: string
): Promise<EmailCampaignListAnalyticsRow[]> {
  const [campaigns, aggByCampaign] = await Promise.all([
    prisma.emailCampaign.findMany({
      where: { orgId },
      orderBy: [{ sentAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        subject: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        updatedAt: true,
        template: { select: { name: true } }
      }
    }),
    aggregateRecipientCountsForOrg(orgId)
  ]);

  return campaigns.map((row) => {
    const counts = aggByCampaign.get(row.id) ?? { ...EMPTY_COUNTS };
    return {
      id: row.id,
      name: row.name,
      subject: row.subject,
      status: row.status,
      scheduledAt: row.scheduledAt,
      sentAt: row.sentAt,
      updatedAt: row.updatedAt,
      templateName: row.template.name,
      analytics: analyticsFromCounts(counts)
    };
  });
}
