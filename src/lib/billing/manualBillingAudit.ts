import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const SNAPSHOT_SELECT = {
  plan: true,
  subscription: {
    select: {
      status: true,
      currency: true,
      paystackSubscriptionCode: true,
      paystackPlanCode: true,
      authorizationCode: true,
      emailToken: true,
      cardLast4: true,
      cardExpMonth: true,
      cardExpYear: true,
      trialStartsAt: true,
      trialEndsAt: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      paystackStatus: true,
      pastDueSince: true,
      dunningAttempt: true,
      lastDunningAttemptAt: true,
      nextDunningAt: true,
      dunningPausedAt: true,
      suspendedAt: true,
      compPlan: true,
      compEndsAt: true
    }
  },
  billingCustomer: {
    select: {
      paystackCustomerCode: true,
      billingEmail: true
    }
  }
} as const;

export async function snapshotOrgBillingState(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: SNAPSHOT_SELECT
  });
  return (org ?? { missing: true }) as Prisma.InputJsonValue;
}

export async function recordManualBillingAction(input: {
  orgId: string;
  actorUserId: string;
  action: string;
  reason: string;
  beforeState: Prisma.InputJsonValue;
  afterState: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}): Promise<string> {
  const row = await prisma.manualBillingAction.create({
    data: {
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: input.action,
      reason: input.reason,
      beforeState: input.beforeState,
      afterState: input.afterState,
      metadata: input.metadata ?? undefined
    },
    select: { id: true }
  });
  return row.id;
}
