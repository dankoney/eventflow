import { EmailCampaignStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type EmailCampaignListRow = {
  id: string;
  name: string;
  subject: string;
  status: EmailCampaignStatus;
  scheduledAt: Date | null;
  sentAt: Date | null;
  updatedAt: Date;
  templateName: string;
  recipientCount: number | null;
};

export type EmailCampaignDetail = {
  id: string;
  name: string;
  subject: string;
  status: EmailCampaignStatus;
  segmentDefinition: unknown;
  scheduledAt: Date | null;
  sentAt: Date | null;
  resendBroadcastId: string | null;
  resendAudienceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  template: {
    id: string;
    name: string;
    compiledHtml: string;
  };
};

export type CampaignRecipientStatusCounts = Record<string, number>;

export async function listEmailCampaignsForOrg(orgId: string): Promise<EmailCampaignListRow[]> {
  const rows = await prisma.emailCampaign.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      subject: true,
      status: true,
      scheduledAt: true,
      sentAt: true,
      updatedAt: true,
      template: { select: { name: true } },
      _count: { select: { recipients: true } }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    subject: row.subject,
    status: row.status,
    scheduledAt: row.scheduledAt,
    sentAt: row.sentAt,
    updatedAt: row.updatedAt,
    templateName: row.template.name,
    recipientCount: row._count.recipients > 0 ? row._count.recipients : null
  }));
}

export async function getEmailCampaignForOrg(
  campaignId: string,
  orgId: string
): Promise<EmailCampaignDetail | null> {
  const row = await prisma.emailCampaign.findFirst({
    where: { id: campaignId, orgId },
    select: {
      id: true,
      name: true,
      subject: true,
      status: true,
      segmentDefinition: true,
      scheduledAt: true,
      sentAt: true,
      resendBroadcastId: true,
      resendAudienceId: true,
      createdAt: true,
      updatedAt: true,
      template: {
        select: { id: true, name: true, compiledHtml: true }
      }
    }
  });
  return row;
}

export function campaignIsEditable(status: EmailCampaignStatus): boolean {
  return status === EmailCampaignStatus.DRAFT;
}

export async function getCampaignRecipientStatusCounts(
  campaignId: string
): Promise<CampaignRecipientStatusCounts> {
  const grouped = await prisma.emailCampaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true }
  });

  const counts: CampaignRecipientStatusCounts = {};
  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }
  return counts;
}

export async function createEmailCampaignRow(
  data: Prisma.EmailCampaignUncheckedCreateInput
) {
  return prisma.emailCampaign.create({ data });
}

export async function updateEmailCampaignRow(
  campaignId: string,
  orgId: string,
  data: Prisma.EmailCampaignUpdateInput
) {
  const existing = await prisma.emailCampaign.findFirst({
    where: { id: campaignId, orgId },
    select: { status: true }
  });
  if (!existing) return null;
  if (!campaignIsEditable(existing.status)) {
    throw new Error("Sent campaigns cannot be edited.");
  }
  return prisma.emailCampaign.update({
    where: { id: campaignId },
    data
  });
}
