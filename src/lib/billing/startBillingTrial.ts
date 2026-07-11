import { OrgPlan, SubscriptionStatus } from "@prisma/client";

import { computeTrialEndsAt } from "@/lib/billing/runBillingLifecycleCron";
import { applySubscriptionEntitlements } from "@/lib/db/billing";
import { prisma } from "@/lib/prisma";

/**
 * Start a 90-day card-free PRO trial for a newly provisioned org.
 * Skipped for ENTERPRISE (manual billing).
 */
export async function startBillingTrialForOrg(orgId: string, startedAt = new Date()) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, plan: true }
  });
  if (!org) throw new Error("Organization not found.");
  if (org.plan === OrgPlan.ENTERPRISE) return { started: false as const };

  const trialEndsAt = computeTrialEndsAt(startedAt);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.upsert({
      where: { orgId },
      create: {
        orgId,
        status: SubscriptionStatus.TRIALING,
        trialStartsAt: startedAt,
        trialEndsAt
      },
      update: {
        status: SubscriptionStatus.TRIALING,
        trialStartsAt: startedAt,
        trialEndsAt
      }
    });

    await tx.organization.update({
      where: { id: orgId },
      data: { plan: OrgPlan.PRO }
    });

    await applySubscriptionEntitlements(
      { orgId, status: SubscriptionStatus.TRIALING, preserveEnterprise: false },
      tx
    );
  });

  return { started: true as const, trialEndsAt };
}
