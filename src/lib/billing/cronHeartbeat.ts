import "server-only";

import { BILLING_CRON_MISS_THRESHOLD_MS } from "@/lib/billing/cronHeartbeatStatus";
import { sendBillingCronMissAlertEmail } from "@/lib/email/billingEmails";
import { prisma } from "@/lib/prisma";

export { BILLING_CRON_MISS_THRESHOLD_MS };

const PLATFORM_SETTINGS_ID = "default";

export type BillingCronJob = "lifecycle" | "dunning";

export async function recordBillingCronOk(job: BillingCronJob, at = new Date()): Promise<void> {
  await prisma.platformSettings.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    create: {
      id: PLATFORM_SETTINGS_ID,
      billingAlertCcEmails: [],
      ...(job === "lifecycle"
        ? {
            billingLifecycleCronLastOkAt: at,
            billingLifecycleCronMissAlertSentAt: null
          }
        : {
            billingDunningCronLastOkAt: at,
            billingDunningCronMissAlertSentAt: null
          }),
      billingCronWatchStartedAt: at
    },
    update:
      job === "lifecycle"
        ? {
            billingLifecycleCronLastOkAt: at,
            billingLifecycleCronMissAlertSentAt: null
          }
        : {
            billingDunningCronLastOkAt: at,
            billingDunningCronMissAlertSentAt: null
          }
  });
}

export type BillingCronHealth = {
  lifecycleLastOkAt: Date | null;
  dunningLastOkAt: Date | null;
  watchStartedAt: Date | null;
  lifecycleStale: boolean;
  dunningStale: boolean;
  alertsSent: Array<{ job: BillingCronJob; hoursSince: number }>;
};

/**
 * Called from a frequent cron (reminders / event-status) so we still alert
 * when billing jobs themselves have stopped firing.
 */
export async function checkBillingCronHealthAndAlert(
  now = new Date()
): Promise<BillingCronHealth> {
  const row = await prisma.platformSettings.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    create: {
      id: PLATFORM_SETTINGS_ID,
      billingAlertCcEmails: [],
      billingCronWatchStartedAt: now
    },
    update: {},
    select: {
      billingLifecycleCronLastOkAt: true,
      billingDunningCronLastOkAt: true,
      billingCronWatchStartedAt: true,
      billingLifecycleCronMissAlertSentAt: true,
      billingDunningCronMissAlertSentAt: true
    }
  });

  let watchStartedAt = row.billingCronWatchStartedAt;
  if (!watchStartedAt) {
    await prisma.platformSettings.update({
      where: { id: PLATFORM_SETTINGS_ID },
      data: { billingCronWatchStartedAt: now }
    });
    watchStartedAt = now;
  }

  const alertsSent: Array<{ job: BillingCronJob; hoursSince: number }> = [];

  async function maybeAlert(input: {
    job: BillingCronJob;
    lastOkAt: Date | null;
    missAlertSentAt: Date | null;
  }) {
    const reference = input.lastOkAt ?? watchStartedAt!;
    const ageMs = now.getTime() - reference.getTime();
    const stale = ageMs > BILLING_CRON_MISS_THRESHOLD_MS;
    if (!stale) return false;
    if (input.missAlertSentAt) return true;

    const hoursSince = Math.round(ageMs / (60 * 60 * 1000));
    await sendBillingCronMissAlertEmail({
      job: input.job,
      hoursSince,
      lastOkAt: input.lastOkAt,
      thresholdHours: Math.round(BILLING_CRON_MISS_THRESHOLD_MS / (60 * 60 * 1000))
    });

    await prisma.platformSettings.update({
      where: { id: PLATFORM_SETTINGS_ID },
      data:
        input.job === "lifecycle"
          ? { billingLifecycleCronMissAlertSentAt: now }
          : { billingDunningCronMissAlertSentAt: now }
    });

    alertsSent.push({ job: input.job, hoursSince });
    return true;
  }

  const lifecycleStale = await maybeAlert({
    job: "lifecycle",
    lastOkAt: row.billingLifecycleCronLastOkAt,
    missAlertSentAt: row.billingLifecycleCronMissAlertSentAt
  });
  const dunningStale = await maybeAlert({
    job: "dunning",
    lastOkAt: row.billingDunningCronLastOkAt,
    missAlertSentAt: row.billingDunningCronMissAlertSentAt
  });

  return {
    lifecycleLastOkAt: row.billingLifecycleCronLastOkAt,
    dunningLastOkAt: row.billingDunningCronLastOkAt,
    watchStartedAt,
    lifecycleStale,
    dunningStale,
    alertsSent
  };
}
