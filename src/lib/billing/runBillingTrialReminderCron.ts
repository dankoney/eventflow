import { SubscriptionStatus } from "@prisma/client";

import { getTrialReminderDueAt, TRIAL_REMINDER_DAYS } from "@/lib/billing/constants";
import { sendBillingTrialReminderEmail } from "@/lib/email/billingEmails";
import { prisma } from "@/lib/prisma";
import { resolvePublicBaseForLinks } from "@/lib/url";

export type BillingTrialReminderCronResult = {
  sent: Array<{ orgId: string; day: number }>;
};

const REMINDER_FIELD: Record<
  (typeof TRIAL_REMINDER_DAYS)[number],
  "trialReminderDay60SentAt" | "trialReminderDay80SentAt" | "trialReminderDay89SentAt"
> = {
  60: "trialReminderDay60SentAt",
  80: "trialReminderDay80SentAt",
  89: "trialReminderDay89SentAt"
};

/**
 * Send trial conversion reminders on days 60, 80, and 89 (from trialStartsAt).
 */
export async function runBillingTrialReminderCron(
  now = new Date()
): Promise<BillingTrialReminderCronResult> {
  const sent: Array<{ orgId: string; day: number }> = [];
  const billingUrlBase = resolvePublicBaseForLinks();

  const trialing = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.TRIALING,
      trialStartsAt: { not: null },
      trialEndsAt: { gt: now }
    },
    select: {
      orgId: true,
      trialStartsAt: true,
      trialEndsAt: true,
      trialReminderDay60SentAt: true,
      trialReminderDay80SentAt: true,
      trialReminderDay89SentAt: true,
      org: {
        select: {
          name: true,
          users: {
            where: { role: "ADMIN" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { email: true, name: true }
          }
        }
      }
    }
  });

  for (const row of trialing) {
    if (!row.trialStartsAt || !row.trialEndsAt) continue;
    const admin = row.org.users[0];
    if (!admin?.email) continue;

    for (const day of TRIAL_REMINDER_DAYS) {
      const sentField = REMINDER_FIELD[day];
      if (row[sentField]) continue;

      const dueAt = getTrialReminderDueAt(row.trialStartsAt, day);
      if (dueAt.getTime() > now.getTime()) continue;

      const daysLeft = Math.max(
        1,
        Math.ceil((row.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      );

      await sendBillingTrialReminderEmail({
        to: admin.email,
        adminName: admin.name,
        orgName: row.org.name,
        trialEndsAt: row.trialEndsAt,
        daysLeft,
        reminderDay: day,
        billingUrl: billingUrlBase ? `${billingUrlBase}/dashboard/settings/billing` : null
      });

      await prisma.subscription.update({
        where: { orgId: row.orgId },
        data: { [sentField]: now }
      });

      sent.push({ orgId: row.orgId, day });
    }
  }

  return { sent };
}
