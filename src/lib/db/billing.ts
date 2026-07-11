import { OrgPlan, SubscriptionStatus, type Prisma } from "@prisma/client";

import {
  deriveOrgBillingAccess,
  orgCanFromContext,
  resolveFeaturePlan,
  type BillingCapability,
  type OrgBillingAccess
} from "@/lib/billing/entitlements";
import { prisma } from "@/lib/prisma";

/**
 * Primary billing access check for server actions — loads org + subscription from DB.
 * Returns null only when the org row does not exist.
 *
 * Pre-billing orgs (no Subscription row): subscription is null, status resolves to
 * `NONE`, and FREE-tier orgs get no PRO capabilities without throwing.
 */
export async function getOrgBillingAccess(orgId: string): Promise<OrgBillingAccess | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      plan: true,
      subscription: {
        select: {
          status: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          pastDueSince: true,
          compEndsAt: true,
          compPlan: true
        }
      }
    }
  });
  if (!org) return null;

  return deriveOrgBillingAccess({
    org: { id: org.id, plan: org.plan },
    subscription: org.subscription
  });
}

/** Gate a capability for an org. Returns false when org is missing. */
export async function orgCan(orgId: string, capability: BillingCapability): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      plan: true,
      subscription: {
        select: {
          status: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          pastDueSince: true,
          compEndsAt: true,
          compPlan: true
        }
      }
    }
  });
  if (!org) return false;

  return orgCanFromContext(
    { org: { id: org.id, plan: org.plan }, subscription: org.subscription },
    capability
  );
}

/**
 * Server-action helper — returns a user-facing error when billing blocks the capability.
 * Respects grandfathered PRO/ENTERPRISE (no Subscription row → status NONE + plan PRO).
 *
 * Note: `create_event` is allowed on FREE within quantitative plan caps
 * (`assertCanCreateActiveEvent` in planLimits). `send_broadcast` still requires PRO+.
 */
export async function requireBillingCapability(
  orgId: string,
  capability: BillingCapability
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getOrgBillingAccess(orgId);
  if (!access) return { ok: false, error: "Workspace not found." };

  if (!access.canLogin) {
    return {
      ok: false,
      error:
        "This workspace is suspended for non-payment. An admin must renew billing before anyone can sign in or make changes."
    };
  }

  if (await orgCan(orgId, capability)) {
    return { ok: true };
  }

  if (access.status === SubscriptionStatus.PAST_DUE) {
    return {
      ok: false,
      error:
        "Payment is past due. Creating new events and broadcasts is paused until billing is updated in Settings → Billing."
    };
  }

  if (capability === "send_broadcast" || capability === "export_feedback_pdf_unwatermarked") {
    return {
      ok: false,
      error: "This action requires an active PRO subscription. Open Settings → Billing to renew."
    };
  }

  return { ok: false, error: "Your current plan does not allow this action." };
}

/** Load org plan for quantitative limit checks. */
export async function getOrgPlanForLimits(
  orgId: string
): Promise<{ id: string; plan: OrgPlan } | null> {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, plan: true }
  });
}

export type ApplySubscriptionEntitlementsInput = {
  orgId: string;
  status?: SubscriptionStatus;
  preserveEnterprise?: boolean;
};

/**
 * Single write path for automated plan changes from webhooks/crons.
 */
export async function applySubscriptionEntitlements(
  input: ApplySubscriptionEntitlementsInput,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<{ plan: OrgPlan; status: SubscriptionStatus }> {
  const org = await db.organization.findUnique({
    where: { id: input.orgId },
    select: {
      id: true,
      plan: true,
      subscription: {
        select: {
          id: true,
          status: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          compEndsAt: true,
          compPlan: true
        }
      }
    }
  });
  if (!org) {
    throw new Error("Organization not found.");
  }

  const subscription = org.subscription;
  const nextStatus = input.status ?? subscription?.status ?? SubscriptionStatus.NONE;
  const nextPlan = resolveFeaturePlan({
    currentPlan: org.plan,
    status: nextStatus,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    preserveEnterprise: input.preserveEnterprise,
    compPlan: subscription?.compPlan ?? null,
    compEndsAt: subscription?.compEndsAt ?? null
  });

  if (nextPlan !== org.plan) {
    await db.organization.update({
      where: { id: org.id },
      data: { plan: nextPlan }
    });
  }

  if (subscription && subscription.status !== nextStatus) {
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: nextStatus }
    });
  }

  return { plan: nextPlan, status: nextStatus };
}

export async function ensureSubscriptionRow(
  orgId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  return db.subscription.upsert({
    where: { orgId },
    create: { orgId, status: SubscriptionStatus.NONE },
    update: {}
  });
}
