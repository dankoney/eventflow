import "server-only";

import {
  addPaystackPlanInterval,
  periodExtensionBase
} from "@/lib/billing/constants";
import {
  createPaystackSubscription,
  disablePaystackSubscription,
  fetchPaystackSubscription,
  PaystackApiError
} from "@/lib/billing/paystackClient";
import { prisma } from "@/lib/prisma";

/**
 * After a renew checkout charge: keep local paid-through date, then replace the
 * Paystack subscription so the next auto-debit is at the new period end (avoids
 * double-billing remaining prepaid time).
 */
export async function schedulePaystackSubscriptionAfterRenew(input: {
  orgId: string;
  planCode: string;
  periodEnd: Date;
  authorizationCode: string;
  customerCode: string;
  previousSubscriptionCode: string | null;
  previousEmailToken: string | null;
}): Promise<void> {
  if (input.previousSubscriptionCode) {
    let emailToken = input.previousEmailToken;
    if (!emailToken) {
      try {
        const remote = await fetchPaystackSubscription(input.previousSubscriptionCode);
        emailToken = remote.email_token ?? null;
      } catch {
        emailToken = null;
      }
    }
    if (emailToken) {
      try {
        await disablePaystackSubscription({
          subscriptionCode: input.previousSubscriptionCode,
          emailToken
        });
      } catch {
        /* already disabled */
      }
    }
  }

  try {
    const created = await createPaystackSubscription({
      customerCode: input.customerCode,
      planCode: input.planCode,
      authorizationCode: input.authorizationCode,
      startDate: input.periodEnd.toISOString()
    });

    await prisma.subscription.update({
      where: { orgId: input.orgId },
      data: {
        paystackSubscriptionCode: created.subscription_code,
        emailToken: created.email_token,
        paystackStatus: created.status || "active",
        paystackPlanCode: input.planCode,
        cancelAtPeriodEnd: false
      }
    });
  } catch (error) {
    const message = error instanceof PaystackApiError ? error.message : String(error);
    console.error("[billing] renew schedule failed", { orgId: input.orgId, message });
  }
}

export function computeRenewPeriodWindow(input: {
  currentPeriodEnd: Date | null;
  planInterval: string;
  now?: Date;
}): { periodStart: Date; periodEnd: Date } {
  const now = input.now ?? new Date();
  const periodStart = periodExtensionBase(input.currentPeriodEnd, now);
  const periodEnd = addPaystackPlanInterval(periodStart, input.planInterval);
  return { periodStart, periodEnd };
}
