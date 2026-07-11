import { SubscriptionStatus } from "@prisma/client";

import { getDunningRetryDueAt, MAX_DUNNING_ATTEMPTS, PAST_DUE_GRACE_MS } from "@/lib/billing/constants";
import { chargePaystackAuthorization, fetchPaystackPlan, PaystackApiError } from "@/lib/billing/paystackClient";
import { applySubscriptionEntitlements } from "@/lib/db/billing";
import { prisma } from "@/lib/prisma";

export type BillingDunningCronResult = {
  retried: Array<{ orgId: string; reference: string }>;
  suspended: string[];
  skipped: Array<{ orgId: string; reason: string }>;
};

function nextDunningAt(pastDueSince: Date, retryIndex: number): Date | null {
  return getDunningRetryDueAt(pastDueSince, retryIndex);
}

/**
 * Re-attempt renewal charges against stored Paystack authorizations.
 * Retry schedule is anchored to `pastDueSince` (days 1/3/5) via `nextDunningAt` —
 * cron frequency only controls when we notice a due retry, not which retry fires.
 * Phase 4 enforces `SUSPENDED` at the dashboard gate (`/billing/suspended`).
 * OTP sign-in remains allowed so the org can renew.
 */
export async function runBillingDunningCron(now = new Date()): Promise<BillingDunningCronResult> {
  const retried: Array<{ orgId: string; reference: string }> = [];
  const suspended: string[] = [];
  const skipped: Array<{ orgId: string; reason: string }> = [];

  const due = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.PAST_DUE,
      nextDunningAt: { lte: now },
      authorizationCode: { not: null },
      dunningPausedAt: null
    },
    select: {
      orgId: true,
      pastDueSince: true,
      dunningAttempt: true,
      authorizationCode: true,
      paystackPlanCode: true,
      currency: true
    }
  });

  for (const subscription of due) {
    const orgId = subscription.orgId;
    const pastDueSince = subscription.pastDueSince;
    if (!pastDueSince) {
      skipped.push({ orgId, reason: "missing_past_due_since" });
      continue;
    }

    const anchoredDueAt = getDunningRetryDueAt(pastDueSince, subscription.dunningAttempt);
    if (anchoredDueAt && anchoredDueAt.getTime() > now.getTime()) {
      skipped.push({ orgId, reason: "retry_not_due_yet" });
      continue;
    }

    const graceEnded = pastDueSince.getTime() + PAST_DUE_GRACE_MS <= now.getTime();
    const attemptsExhausted = subscription.dunningAttempt >= MAX_DUNNING_ATTEMPTS;

    if (attemptsExhausted && graceEnded) {
      await prisma.subscription.update({
        where: { orgId },
        data: {
          status: SubscriptionStatus.SUSPENDED,
          suspendedAt: now,
          nextDunningAt: null
        }
      });
      await applySubscriptionEntitlements({ orgId, status: SubscriptionStatus.SUSPENDED });
      suspended.push(orgId);
      continue;
    }

    if (!subscription.authorizationCode) {
      skipped.push({ orgId, reason: "missing_authorization" });
      continue;
    }

    const customer = await prisma.billingCustomer.findUnique({
      where: { orgId },
      select: { billingEmail: true }
    });
    if (!customer?.billingEmail) {
      skipped.push({ orgId, reason: "missing_billing_email" });
      continue;
    }

    let amountPesewas: number | null = null;
    if (subscription.paystackPlanCode) {
      try {
        const plan = await fetchPaystackPlan(subscription.paystackPlanCode);
        amountPesewas = plan.amount;
      } catch (error) {
        const message = error instanceof PaystackApiError ? error.message : "plan_fetch_failed";
        skipped.push({ orgId, reason: message });
        continue;
      }
    }

    if (!amountPesewas) {
      skipped.push({ orgId, reason: "missing_plan_amount" });
      continue;
    }

    const reference = `dunning-${orgId}-${subscription.dunningAttempt + 1}-${now.getTime()}`;

    try {
      await chargePaystackAuthorization({
        authorizationCode: subscription.authorizationCode,
        email: customer.billingEmail,
        amountPesewas,
        currency: subscription.currency,
        reference
      });

      await prisma.subscription.update({
        where: { orgId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          pastDueSince: null,
          dunningAttempt: 0,
          lastDunningAttemptAt: now,
          nextDunningAt: null,
          suspendedAt: null
        }
      });
      await applySubscriptionEntitlements({ orgId, status: SubscriptionStatus.ACTIVE });
      retried.push({ orgId, reference });
    } catch {
      const nextAttempt = subscription.dunningAttempt + 1;
      const nextAt = nextDunningAt(pastDueSince, nextAttempt);
      await prisma.subscription.update({
        where: { orgId },
        data: {
          dunningAttempt: nextAttempt,
          lastDunningAttemptAt: now,
          nextDunningAt: nextAt
        }
      });
      skipped.push({ orgId, reason: "charge_failed" });
    }
  }

  return { retried, suspended, skipped };
}
