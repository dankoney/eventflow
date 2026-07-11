import {
  GuestMessageCampaignScope,
  GuestMessageChannel,
  GuestMessageDeliveryStatus,
  type Prisma
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type GuestMessageCampaignListRow = {
  id: string;
  channel: GuestMessageChannel;
  scope: GuestMessageCampaignScope;
  templateSubject: string | null;
  templateHeadline: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: Date;
  createdByName: string | null;
};

export type GuestMessageDeliveryRow = {
  id: string;
  guestId: string;
  guestName: string;
  guestEmail: string | null;
  status: GuestMessageDeliveryStatus;
  error: string | null;
  sentAt: Date | null;
};

export async function listGuestMessageCampaignsForEvent(
  eventId: string,
  orgId: string,
  limit = 20
): Promise<GuestMessageCampaignListRow[]> {
  const rows = await prisma.guestMessageCampaign.findMany({
    where: { eventId, event: { orgId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      channel: true,
      scope: true,
      templateSubject: true,
      templateHeadline: true,
      recipientCount: true,
      sentCount: true,
      failedCount: true,
      skippedCount: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } }
    }
  });

  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    scope: r.scope,
    templateSubject: r.templateSubject,
    templateHeadline: r.templateHeadline,
    recipientCount: r.recipientCount,
    sentCount: r.sentCount,
    failedCount: r.failedCount,
    skippedCount: r.skippedCount,
    createdAt: r.createdAt,
    createdByName: r.createdBy.name ?? r.createdBy.email
  }));
}

export async function getGuestMessageCampaignDeliveries(
  campaignId: string,
  eventId: string,
  orgId: string
): Promise<{ campaign: GuestMessageCampaignListRow | null; deliveries: GuestMessageDeliveryRow[] }> {
  const campaign = await prisma.guestMessageCampaign.findFirst({
    where: { id: campaignId, eventId, event: { orgId } },
    select: {
      id: true,
      channel: true,
      scope: true,
      templateSubject: true,
      templateHeadline: true,
      recipientCount: true,
      sentCount: true,
      failedCount: true,
      skippedCount: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } }
    }
  });

  if (!campaign) {
    return { campaign: null, deliveries: [] };
  }

  const deliveries = await prisma.guestMessageDelivery.findMany({
    where: { campaignId },
    orderBy: [{ status: "asc" }, { guest: { name: "asc" } }],
    select: {
      id: true,
      status: true,
      error: true,
      sentAt: true,
      guest: { select: { id: true, name: true, email: true } }
    }
  });

  return {
    campaign: {
      id: campaign.id,
      channel: campaign.channel,
      scope: campaign.scope,
      templateSubject: campaign.templateSubject,
      templateHeadline: campaign.templateHeadline,
      recipientCount: campaign.recipientCount,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      skippedCount: campaign.skippedCount,
      createdAt: campaign.createdAt,
      createdByName: campaign.createdBy.name ?? campaign.createdBy.email
    },
    deliveries: deliveries.map((d) => ({
      id: d.id,
      guestId: d.guest.id,
      guestName: d.guest.name,
      guestEmail: d.guest.email,
      status: d.status,
      error: d.error,
      sentAt: d.sentAt
    }))
  };
}

export async function createGuestMessageCampaign(
  data: Prisma.GuestMessageCampaignCreateInput
): Promise<string> {
  const row = await prisma.guestMessageCampaign.create({ data, select: { id: true } });
  return row.id;
}
