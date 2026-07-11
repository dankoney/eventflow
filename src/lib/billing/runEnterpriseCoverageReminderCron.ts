import { OrgPlan } from "@prisma/client";

import {
  ENTERPRISE_COVERAGE_REMINDER_DAYS,
  getEnterpriseCoverageReminderDueAt
} from "@/lib/billing/constants";
import { sendBillingEnterpriseCoverageReminderEmail } from "@/lib/email/billingEmails";
import { prisma } from "@/lib/prisma";

export type EnterpriseCoverageReminderCronResult = {
  sent: Array<{ orgId: string; daysBefore: number }>;
};

type ReminderField =
  | "enterpriseCoverageReminderDay30SentAt"
  | "enterpriseCoverageReminderDay14SentAt"
  | "enterpriseCoverageReminderDay7SentAt"
  | "enterpriseCoverageReminderDay3SentAt"
  | "enterpriseCoverageReminderDay1SentAt";

const REMINDER_FIELD: Record<
  (typeof ENTERPRISE_COVERAGE_REMINDER_DAYS)[number],
  ReminderField
> = {
  30: "enterpriseCoverageReminderDay30SentAt",
  14: "enterpriseCoverageReminderDay14SentAt",
  7: "enterpriseCoverageReminderDay7SentAt",
  3: "enterpriseCoverageReminderDay3SentAt",
  1: "enterpriseCoverageReminderDay1SentAt"
};

/**
 * Send Enterprise coverage renewal reminders at T−30/14/7/3/1 before currentPeriodEnd.
 * Does not change plan, status, or access.
 */
export async function runEnterpriseCoverageReminderCron(
  now = new Date()
): Promise<EnterpriseCoverageReminderCronResult> {
  const sent: Array<{ orgId: string; daysBefore: number }> = [];

  const rows = await prisma.subscription.findMany({
    where: {
      currentPeriodEnd: { gt: now },
      org: { plan: OrgPlan.ENTERPRISE }
    },
    select: {
      orgId: true,
      currentPeriodEnd: true,
      enterpriseCoverageReminderDay30SentAt: true,
      enterpriseCoverageReminderDay14SentAt: true,
      enterpriseCoverageReminderDay7SentAt: true,
      enterpriseCoverageReminderDay3SentAt: true,
      enterpriseCoverageReminderDay1SentAt: true,
      org: {
        select: {
          name: true,
          billingCustomer: { select: { billingEmail: true } },
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

  for (const row of rows) {
    if (!row.currentPeriodEnd) continue;

    const to =
      row.org.billingCustomer?.billingEmail?.trim() ||
      row.org.users[0]?.email?.trim() ||
      null;
    if (!to) continue;

    const adminName = row.org.users[0]?.name ?? null;

    for (const daysBefore of ENTERPRISE_COVERAGE_REMINDER_DAYS) {
      const sentField = REMINDER_FIELD[daysBefore];
      if (row[sentField]) continue;

      const dueAt = getEnterpriseCoverageReminderDueAt(row.currentPeriodEnd, daysBefore);
      if (dueAt.getTime() > now.getTime()) continue;

      const daysLeft = Math.max(
        1,
        Math.ceil((row.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      );

      await sendBillingEnterpriseCoverageReminderEmail({
        to,
        adminName,
        orgName: row.org.name,
        coverageEndsAt: row.currentPeriodEnd,
        daysLeft,
        daysBefore
      });

      await prisma.subscription.update({
        where: { orgId: row.orgId },
        data: { [sentField]: now }
      });

      sent.push({ orgId: row.orgId, daysBefore });
    }
  }

  return { sent };
}
