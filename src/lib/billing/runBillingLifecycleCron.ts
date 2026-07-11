import { OrgPlan, SubscriptionStatus } from "@prisma/client";

import { TRIAL_DURATION_MS, daysBetween } from "@/lib/billing/constants";
import { sendBillingEnterpriseCoverageOverdueEmail } from "@/lib/email/billingEmails";
import { applySubscriptionEntitlements } from "@/lib/db/billing";
import { prisma } from "@/lib/prisma";

export type BillingLifecycleCronResult = {
  trialExpired: string[];
  periodEnded: string[];
  compsExpired: string[];
  enterpriseCoverageOverdue: string[];
  enterpriseCoverageOverdueAlerts: string[];
};

/**
 * Trial expiry + PRO cancel-at-period-end downgrade + comp expiry +
 * Enterprise coverage overdue stamp + overdue alert email (no access change).
 */
export async function runBillingLifecycleCron(now = new Date()): Promise<BillingLifecycleCronResult> {
  const trialExpired: string[] = [];
  const periodEnded: string[] = [];
  const compsExpired: string[] = [];
  const enterpriseCoverageOverdue: string[] = [];
  const enterpriseCoverageOverdueAlerts: string[] = [];

  const expiringTrials = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.TRIALING,
      trialEndsAt: { lte: now },
      authorizationCode: null
    },
    select: { orgId: true }
  });

  for (const row of expiringTrials) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { orgId: row.orgId },
        data: { status: SubscriptionStatus.TRIAL_EXPIRED }
      });
      await applySubscriptionEntitlements(
        { orgId: row.orgId, status: SubscriptionStatus.TRIAL_EXPIRED },
        tx
      );
    });
    trialExpired.push(row.orgId);
  }

  /**
   * PRO (and other non-ENTERPRISE) cancel-at-period-end: mark CANCELLED when
   * the paid window ends. ENTERPRISE is excluded — coverage expiry only stamps
   * coverageOverdueSince and never changes plan/status/access here.
   */
  const endingPeriods = await prisma.subscription.findMany({
    where: {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { lte: now },
      status: { in: [SubscriptionStatus.CANCELLED, SubscriptionStatus.ACTIVE] },
      org: { plan: { not: OrgPlan.ENTERPRISE } }
    },
    select: { orgId: true }
  });

  for (const row of endingPeriods) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { orgId: row.orgId },
        data: { status: SubscriptionStatus.CANCELLED }
      });
      await applySubscriptionEntitlements(
        { orgId: row.orgId, status: SubscriptionStatus.CANCELLED },
        tx
      );
    });
    periodEnded.push(row.orgId);
  }

  const lapsedEnterprise = await prisma.subscription.findMany({
    where: {
      currentPeriodEnd: { lte: now, not: null },
      org: { plan: OrgPlan.ENTERPRISE }
    },
    select: {
      orgId: true,
      currentPeriodEnd: true,
      coverageOverdueSince: true,
      enterpriseCoverageOverdueAlertSentAt: true,
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

  for (const row of lapsedEnterprise) {
    if (!row.currentPeriodEnd) continue;

    let overdueSince = row.coverageOverdueSince;
    if (!overdueSince) {
      overdueSince = row.currentPeriodEnd;
      await prisma.subscription.update({
        where: { orgId: row.orgId },
        data: {
          /** Stamp = real coverage end, not cron detection time. */
          coverageOverdueSince: overdueSince
        }
      });
      enterpriseCoverageOverdue.push(row.orgId);
    }

    if (!row.enterpriseCoverageOverdueAlertSentAt) {
      const to =
        row.org.billingCustomer?.billingEmail?.trim() ||
        row.org.users[0]?.email?.trim() ||
        null;
      if (to) {
        const daysOverdue = Math.max(0, -daysBetween(now, overdueSince));
        try {
          await sendBillingEnterpriseCoverageOverdueEmail({
            to,
            adminName: row.org.users[0]?.name ?? null,
            orgName: row.org.name,
            coverageEndedAt: overdueSince,
            daysOverdue
          });
          await prisma.subscription.update({
            where: { orgId: row.orgId },
            data: { enterpriseCoverageOverdueAlertSentAt: now }
          });
          enterpriseCoverageOverdueAlerts.push(row.orgId);
        } catch (err) {
          console.error("[billing-lifecycle] enterprise overdue alert failed", {
            orgId: row.orgId,
            err
          });
        }
      }
    }
  }

  const expiredComps = await prisma.subscription.findMany({
    where: {
      compEndsAt: { lte: now },
      compPlan: { not: null }
    },
    select: { orgId: true, status: true, authorizationCode: true }
  });

  for (const row of expiredComps) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { orgId: row.orgId },
        data: { compPlan: null, compEndsAt: null }
      });
      const statusForEntitlements =
        row.status === SubscriptionStatus.ACTIVE && row.authorizationCode
          ? SubscriptionStatus.ACTIVE
          : row.status === SubscriptionStatus.TRIALING
            ? SubscriptionStatus.TRIALING
            : row.status === SubscriptionStatus.PAST_DUE
              ? SubscriptionStatus.PAST_DUE
              : row.status === SubscriptionStatus.SUSPENDED
                ? SubscriptionStatus.SUSPENDED
                : SubscriptionStatus.NONE;
      await applySubscriptionEntitlements(
        {
          orgId: row.orgId,
          status: statusForEntitlements,
          preserveEnterprise: false
        },
        tx
      );
    });
    compsExpired.push(row.orgId);
  }

  return {
    trialExpired,
    periodEnded,
    compsExpired,
    enterpriseCoverageOverdue,
    enterpriseCoverageOverdueAlerts
  };
}

export function computeTrialEndsAt(start = new Date()): Date {
  return new Date(start.getTime() + TRIAL_DURATION_MS);
}
