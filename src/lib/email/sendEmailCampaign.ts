import {
  EmailCampaignRecipientStatus,
  EmailCampaignStatus,
  EmailUnsubscribeSource,
  type Organization,
  type Prisma
} from "@prisma/client";

import {
  contactPropertiesFromMergeValues,
  prepareBroadcastHtmlForResend
} from "@/lib/email/broadcastHtmlForResend";
import { resolveBroadcastMergeValues } from "@/lib/email/broadcastMergeValues";
import {
  assertBroadcastReadyToSend,
  validateBroadcastHtmlForSend
} from "@/lib/email/compileEmailTemplate";
import {
  ResendMarketingApiError,
  splitDisplayName,
  upsertResendMarketingContact
} from "@/lib/email/resendMarketingClient";
import {
  addContactToResendSegment,
  createResendBroadcast,
  createResendSegment,
  ensureBroadcastContactProperties
} from "@/lib/email/resendBroadcastClient";
import { resolveSegment } from "@/lib/db/resolveSegment";
import { parseEmailSegmentDefinition } from "@/lib/email/segmentDefinition";
import { prisma } from "@/lib/prisma";

/** Contacts synced to Resend per cron/worker invocation. */
export const BROADCAST_SEND_BATCH_SIZE = 25;

/** Reclaim cron locks older than this (worker crash / hung request). */
export const BROADCAST_SEND_LOCK_STALE_MS = 10 * 60 * 1000;

/** Minimum wait between POST /broadcasts finalize retries. */
export const BROADCAST_FINALIZE_RETRY_MIN_MS = 60 * 1000;

/** Terminal finalize failures after this many attempts. */
export const BROADCAST_FINALIZE_MAX_ATTEMPTS = 5;

export class CampaignSendLockedError extends Error {
  constructor(campaignId: string) {
    super(`Campaign ${campaignId} is locked by another send worker.`);
    this.name = "CampaignSendLockedError";
  }
}

export class FinalizeBackoffError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Finalize backoff: retry in ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = "FinalizeBackoffError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** Thrown when POST /broadcasts failed but the campaign stays PREPARING for cron retry. */
export class FinalizeRetryPendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinalizeRetryPendingError";
  }
}

function shouldMarkCampaignFailedFromSendError(error: unknown): boolean {
  if (error instanceof ResendMarketingApiError) return false;
  if (error instanceof FinalizeBackoffError) return false;
  if (error instanceof FinalizeRetryPendingError) return false;
  return true;
}

/**
 * Rough lower bound for synchronous server-action timeout risk.
 * Next.js server actions inherit the hosting platform limit (often 60s on Plesk/PHP-proxy
 * setups; up to 300s when `maxDuration` is set on a route). At ~2 Resend calls/recipient,
 * 500 recipients ≈ 1000 HTTP calls — far beyond any interactive timeout.
 */
export const BROADCAST_SEND_ESTIMATED_MS_PER_RECIPIENT = 350;

const campaignInclude = {
  template: { select: { compiledHtml: true } },
  org: {
    select: {
      name: true,
      slug: true,
      resendApiKey: true,
      logoUrl: true,
      logo: true,
      defaultEventBrandLogoUrl: true,
      primaryColor: true,
      accentColor: true,
      defaultEventBrandPrimaryColor: true
    }
  }
} as const;

function resolveResendApiKey(org: Pick<Organization, "resendApiKey">): string {
  const key = org.resendApiKey?.trim() || process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("Resend API key is not configured for this workspace.");
  }
  return key;
}

function resolveBroadcastFrom(orgName: string): string {
  const from = process.env.RESEND_FROM?.trim();
  if (from) return from;
  return `${orgName} <onboarding@resend.dev>`;
}

function tryParseScheduledAt(value: string): Date | null {
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  return null;
}

export type StartEmailCampaignSendResult = {
  campaignId: string;
  totalRecipients: number;
  alreadySynced: number;
  resendSegmentId: string;
  resumed: boolean;
};

export type ProcessEmailCampaignBatchResult = {
  campaignId: string;
  processed: number;
  syncedTotal: number;
  pendingRemaining: number;
  complete: boolean;
  resendBroadcastId?: string;
  scheduled?: boolean;
  skipped?: "locked" | "finalize_backoff";
};

export type SendEmailCampaignResult = {
  mode: "preparing" | "complete";
  recipientCount: number;
  syncedCount: number;
  pendingCount: number;
  resendBroadcastId?: string;
  resendSegmentId: string;
  scheduled: boolean;
};

export type SendEmailCampaignOptions = {
  /** ISO 8601 for Resend `scheduled_at` (requires send:true — schedules, does not send now). */
  scheduledAt?: string | null;
  /** When true, process the first batch inline before returning (still not full sync). */
  inlineFirstBatch?: boolean;
};

async function loadCampaign(campaignId: string, orgId: string) {
  return prisma.emailCampaign.findFirst({
    where: { id: campaignId, orgId },
    include: campaignInclude
  });
}

async function markCampaignFailed(campaignId: string, error: string) {
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: EmailCampaignStatus.FAILED,
      sendError: error.slice(0, 4000),
      sendProcessingStartedAt: null
    }
  });
}

async function tryClaimCampaignSendLock(campaignId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - BROADCAST_SEND_LOCK_STALE_MS);
  const claimed = await prisma.emailCampaign.updateMany({
    where: {
      id: campaignId,
      status: EmailCampaignStatus.PREPARING,
      resendBroadcastId: null,
      OR: [
        { sendProcessingStartedAt: null },
        { sendProcessingStartedAt: { lt: staleBefore } }
      ]
    },
    data: { sendProcessingStartedAt: new Date() }
  });
  return claimed.count > 0;
}

async function releaseCampaignSendLock(campaignId: string): Promise<void> {
  await prisma.emailCampaign.updateMany({
    where: { id: campaignId },
    data: { sendProcessingStartedAt: null }
  });
}

function isReadyToFinalize(campaign: {
  finalizeAttemptCount: number;
  lastFinalizeAttemptAt: Date | null;
}): { ready: boolean; retryAfterMs?: number } {
  if (campaign.finalizeAttemptCount >= BROADCAST_FINALIZE_MAX_ATTEMPTS) {
    return { ready: false };
  }
  if (!campaign.lastFinalizeAttemptAt) {
    return { ready: true };
  }
  const elapsed = Date.now() - campaign.lastFinalizeAttemptAt.getTime();
  if (elapsed >= BROADCAST_FINALIZE_RETRY_MIN_MS) {
    return { ready: true };
  }
  return { ready: false, retryAfterMs: BROADCAST_FINALIZE_RETRY_MIN_MS - elapsed };
}

/**
 * Phase 1 — claim campaign, resolve segment at send time, create Resend segment,
 * materialize recipient rows. Safe to call once; resumable when status is PREPARING.
 */
export async function startEmailCampaignSend(
  campaignId: string,
  orgId: string,
  options?: Pick<SendEmailCampaignOptions, "scheduledAt">
): Promise<StartEmailCampaignSendResult> {
  const campaign = await loadCampaign(campaignId, orgId);
  if (!campaign) throw new Error("Campaign not found.");

  if (campaign.resendBroadcastId) {
    throw new Error("This campaign was already submitted to Resend.");
  }

  const validation = validateBroadcastHtmlForSend(campaign.template.compiledHtml);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }
  assertBroadcastReadyToSend(campaign.template.compiledHtml);

  const segmentDefinition = parseEmailSegmentDefinition(campaign.segmentDefinition);
  if (segmentDefinition.orgId !== orgId) {
    throw new Error("Invalid campaign segment definition.");
  }

  const resumed = campaign.status === EmailCampaignStatus.PREPARING;

  if (!resumed) {
    if (campaign.status !== EmailCampaignStatus.DRAFT && campaign.status !== EmailCampaignStatus.SCHEDULED) {
      throw new Error("Only draft or scheduled campaigns can be sent.");
    }

    const claimed = await prisma.emailCampaign.updateMany({
      where: {
        id: campaignId,
        orgId,
        status: { in: [EmailCampaignStatus.DRAFT, EmailCampaignStatus.SCHEDULED] },
        resendBroadcastId: null
      },
      data: {
        status: EmailCampaignStatus.PREPARING,
        sendError: null,
        scheduledAt: options?.scheduledAt ? tryParseScheduledAt(options.scheduledAt) : campaign.scheduledAt
      }
    });

    if (claimed.count === 0) {
      throw new Error("Campaign is already being prepared or was sent.");
    }
  }

  const segmentResult = await resolveSegment(segmentDefinition);
  if (segmentResult.recipientCount === 0) {
    await markCampaignFailed(campaignId, "No subscribed recipients match this segment.");
    throw new Error("No subscribed recipients match this segment.");
  }

  const apiKey = resolveResendApiKey(campaign.org);
  await ensureBroadcastContactProperties(apiKey);

  let resendSegmentId = campaign.resendAudienceId;
  if (!resendSegmentId) {
    const segmentName = `Eventflow: ${campaign.name} (${campaign.id.slice(-8)})`;
    resendSegmentId = await createResendSegment(apiKey, segmentName);
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { resendAudienceId: resendSegmentId }
    });
  }

  const existingRows = await prisma.emailCampaignRecipient.count({ where: { campaignId } });
  if (existingRows === 0) {
    const contactIds = segmentResult.recipients.map((r) => r.emailContactId);
    await prisma.emailCampaignRecipient.createMany({
      data: contactIds.map((emailContactId) => ({
        campaignId,
        emailContactId,
        status: EmailCampaignRecipientStatus.PENDING
      })),
      skipDuplicates: true
    });
  }

  const synced = await prisma.emailCampaignRecipient.count({
    where: { campaignId, resendSegmentSyncedAt: { not: null } }
  });

  return {
    campaignId,
    totalRecipients: segmentResult.recipientCount,
    alreadySynced: synced,
    resendSegmentId,
    resumed
  };
}

/**
 * Phase 2 — sync a batch of contacts to Resend + add to segment. Idempotent per row via
 * `resendSegmentSyncedAt`. Re-run safe until all rows synced.
 */
export async function processEmailCampaignSendBatch(
  campaignId: string,
  orgId: string,
  options?: { batchSize?: number; skipLock?: boolean }
): Promise<ProcessEmailCampaignBatchResult> {
  const batchSize = options?.batchSize ?? BROADCAST_SEND_BATCH_SIZE;

  if (!options?.skipLock) {
    const claimed = await tryClaimCampaignSendLock(campaignId);
    if (!claimed) {
      const pendingRemaining = await prisma.emailCampaignRecipient.count({
        where: { campaignId, resendSegmentSyncedAt: null }
      });
      const syncedTotal = await prisma.emailCampaignRecipient.count({
        where: { campaignId, resendSegmentSyncedAt: { not: null } }
      });
      return {
        campaignId,
        processed: 0,
        syncedTotal,
        pendingRemaining,
        complete: false,
        skipped: "locked"
      };
    }
  }

  try {
    return await processEmailCampaignSendBatchLocked(campaignId, orgId, batchSize);
  } finally {
    if (!options?.skipLock) {
      await releaseCampaignSendLock(campaignId);
    }
  }
}

async function processEmailCampaignSendBatchLocked(
  campaignId: string,
  orgId: string,
  batchSize: number
): Promise<ProcessEmailCampaignBatchResult> {
  const campaign = await loadCampaign(campaignId, orgId);
  if (!campaign) throw new Error("Campaign not found.");

  if (campaign.status !== EmailCampaignStatus.PREPARING) {
    throw new Error("Campaign is not in preparing state.");
  }
  if (campaign.resendBroadcastId) {
    return {
      campaignId,
      processed: 0,
      syncedTotal: 0,
      pendingRemaining: 0,
      complete: true,
      resendBroadcastId: campaign.resendBroadcastId
    };
  }
  if (!campaign.resendAudienceId) {
    throw new Error("Campaign segment is not initialized.");
  }

  const apiKey = resolveResendApiKey(campaign.org);
  const segmentId = campaign.resendAudienceId;

  const pendingRows = await prisma.emailCampaignRecipient.findMany({
    where: { campaignId, resendSegmentSyncedAt: null },
    take: batchSize,
    orderBy: { createdAt: "asc" },
    include: {
      emailContact: {
        include: {
          guest: {
            select: {
              id: true,
              name: true,
              email: true,
              tier: true,
              company: true,
              invitationToken: true,
              contact: { select: { company: true } },
              event: { select: { id: true, name: true, date: true } }
            }
          }
        }
      }
    }
  });

  let processed = 0;

  for (const row of pendingRows) {
    const contact = row.emailContact;
    const guest = contact.guest;

    if (!contact.isSubscribed) {
      await prisma.emailCampaignRecipient.update({
        where: { id: row.id },
        data: {
          status: EmailCampaignRecipientStatus.SKIPPED_UNSUBSCRIBED,
          resendSegmentSyncedAt: new Date()
        }
      });
      processed += 1;
      continue;
    }

    const mergeValues = resolveBroadcastMergeValues({
      guest: {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        tier: guest.tier,
        company: guest.company,
        invitationToken: guest.invitationToken,
        contactCompany: guest.contact?.company ?? null
      },
      event: guest.event,
      org: campaign.org
    });

    const { firstName, lastName } = splitDisplayName(guest.name);
    const upserted = await upsertResendMarketingContact({
      apiKey,
      email: contact.email,
      firstName,
      lastName,
      isSubscribed: true,
      existingResendContactId: contact.resendContactId,
      properties: contactPropertiesFromMergeValues(mergeValues)
    });

    if (upserted.resendUnsubscribed) {
      await prisma.$transaction([
        prisma.emailContact.update({
          where: { id: contact.id },
          data: {
            isSubscribed: false,
            unsubscribedAt: new Date(),
            unsubscribeSource: EmailUnsubscribeSource.EMAIL_LINK
          }
        }),
        prisma.emailCampaignRecipient.update({
          where: { id: row.id },
          data: {
            status: EmailCampaignRecipientStatus.SKIPPED_UNSUBSCRIBED,
            resendSegmentSyncedAt: new Date()
          }
        })
      ]);
      processed += 1;
      continue;
    }

    if (contact.resendContactId !== upserted.resendContactId) {
      await prisma.emailContact.update({
        where: { id: contact.id },
        data: { resendContactId: upserted.resendContactId }
      });
    }

    await addContactToResendSegment(apiKey, upserted.resendContactId, segmentId);

    await prisma.emailCampaignRecipient.update({
      where: { id: row.id },
      data: { resendSegmentSyncedAt: new Date() }
    });
    processed += 1;
  }

  const pendingRemaining = await prisma.emailCampaignRecipient.count({
    where: { campaignId, resendSegmentSyncedAt: null }
  });

  const syncedTotal = await prisma.emailCampaignRecipient.count({
    where: { campaignId, resendSegmentSyncedAt: { not: null } }
  });

  if (pendingRemaining > 0) {
    return {
      campaignId,
      processed,
      syncedTotal,
      pendingRemaining,
      complete: false
    };
  }

  const finalizeReady = isReadyToFinalize(campaign);
  if (!finalizeReady.ready) {
    return {
      campaignId,
      processed,
      syncedTotal,
      pendingRemaining: 0,
      complete: false,
      skipped: "finalize_backoff"
    };
  }

  return finalizeEmailCampaignBroadcast(campaignId, orgId);
}

/**
 * Phase 3 — create Resend broadcast after all contacts are in the segment.
 */
export async function finalizeEmailCampaignBroadcast(
  campaignId: string,
  orgId: string
): Promise<ProcessEmailCampaignBatchResult> {
  const campaign = await loadCampaign(campaignId, orgId);
  if (!campaign) throw new Error("Campaign not found.");
  if (campaign.resendBroadcastId) {
    return {
      campaignId,
      processed: 0,
      syncedTotal: 0,
      pendingRemaining: 0,
      complete: true,
      resendBroadcastId: campaign.resendBroadcastId
    };
  }
  if (!campaign.resendAudienceId) {
    throw new Error("Campaign segment is not initialized.");
  }

  const finalizeReady = isReadyToFinalize(campaign);
  if (!finalizeReady.ready) {
    if (campaign.finalizeAttemptCount >= BROADCAST_FINALIZE_MAX_ATTEMPTS) {
      const msg = campaign.sendError ?? "Broadcast finalize exhausted retries.";
      await markCampaignFailed(campaignId, msg);
      throw new Error(msg);
    }
    throw new FinalizeBackoffError(finalizeReady.retryAfterMs ?? BROADCAST_FINALIZE_RETRY_MIN_MS);
  }

  const deliverable = await prisma.emailCampaignRecipient.count({
    where: {
      campaignId,
      status: EmailCampaignRecipientStatus.PENDING,
      resendSegmentSyncedAt: { not: null }
    }
  });
  if (deliverable === 0) {
    await markCampaignFailed(campaignId, "No deliverable recipients after Resend sync.");
    throw new Error("No deliverable recipients after Resend sync.");
  }

  const apiKey = resolveResendApiKey(campaign.org);
  const broadcastHtml = prepareBroadcastHtmlForResend(campaign.template.compiledHtml, campaign.org);
  const scheduledAtIso = campaign.scheduledAt?.toISOString();

  let resendBroadcastId: string;
  try {
    resendBroadcastId = await createResendBroadcast({
      apiKey,
      segmentId: campaign.resendAudienceId,
      from: resolveBroadcastFrom(campaign.org.name),
      subject: campaign.subject,
      html: broadcastHtml,
      name: campaign.name,
      send: true,
      scheduledAt: scheduledAtIso
    });
  } catch (e) {
    const attempt = campaign.finalizeAttemptCount + 1;
    const msg = formatResendBroadcastError(e);
    const errorDetail = `Finalize failed (attempt ${attempt}/${BROADCAST_FINALIZE_MAX_ATTEMPTS}): ${msg}`;

    if (attempt >= BROADCAST_FINALIZE_MAX_ATTEMPTS) {
      await markCampaignFailed(campaignId, errorDetail);
      throw new Error(errorDetail);
    }

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: EmailCampaignStatus.PREPARING,
        finalizeAttemptCount: attempt,
        lastFinalizeAttemptAt: new Date(),
        sendError: errorDetail,
        sendProcessingStartedAt: null
      }
    });
    throw new FinalizeRetryPendingError(errorDetail);
  }

  const sendNow = !scheduledAtIso;

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: sendNow ? EmailCampaignStatus.SENDING : EmailCampaignStatus.SCHEDULED,
      resendBroadcastId,
      sendError: null,
      finalizeAttemptCount: 0,
      lastFinalizeAttemptAt: null,
      sendProcessingStartedAt: null,
      sentAt: sendNow ? new Date() : null
    }
  });

  const syncedTotal = await prisma.emailCampaignRecipient.count({
    where: { campaignId, resendSegmentSyncedAt: { not: null } }
  });

  return {
    campaignId,
    processed: 0,
    syncedTotal,
    pendingRemaining: 0,
    complete: true,
    resendBroadcastId,
    scheduled: !sendNow
  };
}

/**
 * Orchestrator used by the server action: start + optional first batch, then cron continues.
 */
export async function executeEmailCampaignSend(
  campaignId: string,
  orgId: string,
  options?: SendEmailCampaignOptions
): Promise<SendEmailCampaignResult> {
  try {
    const started = await startEmailCampaignSend(campaignId, orgId, options);

    let batch: ProcessEmailCampaignBatchResult | null = null;
    if (options?.inlineFirstBatch !== false) {
      batch = await processEmailCampaignSendBatch(campaignId, orgId);
    }

    const pendingCount =
      batch?.pendingRemaining ??
      started.totalRecipients - started.alreadySynced;

    if (batch?.complete && batch.resendBroadcastId) {
      return {
        mode: "complete",
        recipientCount: started.totalRecipients,
        syncedCount: batch.syncedTotal,
        pendingCount: 0,
        resendBroadcastId: batch.resendBroadcastId,
        resendSegmentId: started.resendSegmentId,
        scheduled: batch.scheduled ?? false
      };
    }

    return {
      mode: "preparing",
      recipientCount: started.totalRecipients,
      syncedCount: batch?.syncedTotal ?? started.alreadySynced,
      pendingCount,
      resendSegmentId: started.resendSegmentId,
      scheduled: Boolean(options?.scheduledAt)
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Campaign send failed.";
    if (shouldMarkCampaignFailedFromSendError(e)) {
      await markCampaignFailed(campaignId, message).catch(() => undefined);
    }
    throw e;
  }
}

export async function runEmailCampaignSendCron(options?: {
  campaignId?: string;
  maxBatches?: number;
}): Promise<{
  campaigns: Array<{
    campaignId: string;
    batches: number;
    complete: boolean;
    error?: string;
  }>;
}> {
  const maxBatches = options?.maxBatches ?? 4;
  const preparing = await prisma.emailCampaign.findMany({
    where: {
      status: EmailCampaignStatus.PREPARING,
      resendBroadcastId: null,
      ...(options?.campaignId ? { id: options.campaignId } : {})
    },
    select: { id: true, orgId: true },
    take: 5
  });

  const campaigns: Array<{
    campaignId: string;
    batches: number;
    complete: boolean;
    error?: string;
  }> = [];

  for (const row of preparing) {
    let batches = 0;
    let complete = false;
    let error: string | undefined;

    try {
      while (batches < maxBatches) {
        const result = await processEmailCampaignSendBatch(row.id, row.orgId);
        batches += 1;
        if (result.complete) {
          complete = true;
          break;
        }
        if (result.skipped === "locked" || result.skipped === "finalize_backoff") {
          break;
        }
        if (result.processed === 0) break;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Batch failed.";
      if (shouldMarkCampaignFailedFromSendError(e)) {
        await markCampaignFailed(row.id, error);
      }
    }

    campaigns.push({ campaignId: row.id, batches, complete, error });
  }

  return { campaigns };
}

export function formatResendBroadcastError(error: unknown): string {
  if (error instanceof ResendMarketingApiError) {
    const bodyMsg =
      typeof error.body === "object" &&
      error.body !== null &&
      "message" in error.body &&
      typeof (error.body as { message: unknown }).message === "string"
        ? (error.body as { message: string }).message
        : null;
    return bodyMsg ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return "Campaign send failed.";
}
