import { OrgPlan, SubscriptionStatus, type Organization, type Subscription } from "@prisma/client";

import { PAST_DUE_GRACE_MS } from "@/lib/billing/constants";
import { isFreeOrgPlan } from "@/lib/org/plan";

export type BillingCapability =
  | "create_event"
  | "send_broadcast"
  | "export_feedback_pdf_unwatermarked";

/**
 * Quantitative + module catalog per plan.
 * Active events = DRAFT | PUBLISHED | LIVE (not COMPLETED / CANCELLED).
 * Env `MODULE_*_ENABLED` still gates server features; plan modules are additive.
 */
export type PlanLimits = {
  maxActiveEvents: number | null;
  maxGuestsPerEvent: number | null;
  maxTeamSeats: number | null;
  /** Concurrent VIRTUAL + HYBRID among active events. null = unlimited. */
  maxConcurrentVirtualEvents: number | null;
  maxBroadcastCampaignsPerMonth: number | null;
  maxBroadcastRecipientsPerMonth: number | null;
  maxRegistrationFields: number | null;
  modules: string[];
};

export const PLAN_LIMITS: Record<OrgPlan, PlanLimits> = {
  FREE: {
    maxActiveEvents: 3,
    maxGuestsPerEvent: 100,
    maxTeamSeats: 2,
    maxConcurrentVirtualEvents: 1,
    maxBroadcastCampaignsPerMonth: 0,
    maxBroadcastRecipientsPerMonth: 0,
    maxRegistrationFields: 10,
    modules: ["checkin", "feedback", "analytics", "deliveries"]
  },
  PRO: {
    maxActiveEvents: 20,
    maxGuestsPerEvent: 2000,
    maxTeamSeats: 10,
    maxConcurrentVirtualEvents: null,
    maxBroadcastCampaignsPerMonth: 20,
    maxBroadcastRecipientsPerMonth: 10_000,
    maxRegistrationFields: 40,
    modules: [
      "checkin",
      "feedback",
      "analytics",
      "deliveries",
      "broadcast",
      "crm",
      "polling",
      "media"
    ]
  },
  ENTERPRISE: {
    maxActiveEvents: null,
    maxGuestsPerEvent: null,
    maxTeamSeats: null,
    maxConcurrentVirtualEvents: null,
    maxBroadcastCampaignsPerMonth: null,
    maxBroadcastRecipientsPerMonth: null,
    maxRegistrationFields: 80,
    modules: [
      "checkin",
      "feedback",
      "analytics",
      "deliveries",
      "broadcast",
      "crm",
      "polling",
      "media"
    ]
  }
};

export type OrgBillingAccess = {
  plan: OrgPlan;
  status: SubscriptionStatus;
  canLogin: boolean;
  canMutate: boolean;
  canCreateContent: boolean;
  graceEndsAt: Date | null;
  isPaying: boolean;
  /** Active superadmin comp (not a Paystack trial). */
  isComped: boolean;
  compEndsAt: Date | null;
};

/** Loaded org + optional subscription row — pass to {@link deriveOrgBillingAccess}. */
export type BillingContext = {
  org: Pick<Organization, "id" | "plan">;
  subscription: Pick<
    Subscription,
    | "status"
    | "trialEndsAt"
    | "currentPeriodEnd"
    | "cancelAtPeriodEnd"
    | "pastDueSince"
    | "compEndsAt"
    | "compPlan"
  > | null;
};

export function isCompAccessActive(
  subscription: Pick<Subscription, "compEndsAt" | "compPlan"> | null | undefined,
  now = new Date()
): boolean {
  if (!subscription?.compEndsAt || !subscription.compPlan) return false;
  if (subscription.compPlan === OrgPlan.FREE) return false;
  return subscription.compEndsAt.getTime() > now.getTime();
}

function hasProFeatureAccess(ctx: BillingContext): boolean {
  if (ctx.org.plan === OrgPlan.ENTERPRISE) return true;
  if (isCompAccessActive(ctx.subscription)) return true;

  const status = ctx.subscription?.status ?? SubscriptionStatus.NONE;

  if (status === SubscriptionStatus.TRIALING) return true;
  if (status === SubscriptionStatus.ACTIVE) return true;
  if (status === SubscriptionStatus.PAST_DUE) return true;
  if (status === SubscriptionStatus.SUSPENDED) return true;
  if (status === SubscriptionStatus.CANCELLED) {
    const periodEnd = ctx.subscription?.currentPeriodEnd;
    return Boolean(periodEnd && periodEnd.getTime() > Date.now());
  }

  /** Superadmin manual comp / grandfather: PRO plan with no Paystack row yet. */
  if (ctx.org.plan === OrgPlan.PRO && status === SubscriptionStatus.NONE) return true;

  return false;
}

/**
 * Pure entitlement derivation when org + subscription are already loaded.
 * Use in batch paths and tests. Server actions should call `getOrgBillingAccess`
 * in `@/lib/db/billing` instead (loads from DB).
 *
 * Safe when `subscription` is null (pre-billing orgs): status becomes `NONE`,
 * FREE-tier orgs get no PRO capabilities without throwing.
 */
export function deriveOrgBillingAccess(ctx: BillingContext): OrgBillingAccess {
  const status = ctx.subscription?.status ?? SubscriptionStatus.NONE;
  const graceEndsAt =
    status === SubscriptionStatus.PAST_DUE && ctx.subscription?.pastDueSince
      ? new Date(ctx.subscription.pastDueSince.getTime() + PAST_DUE_GRACE_MS)
      : null;

  const isComped = isCompAccessActive(ctx.subscription);
  const isSuspended = status === SubscriptionStatus.SUSPENDED && !isComped;
  const isPastDue = status === SubscriptionStatus.PAST_DUE && !isComped;
  const pastGraceExpired =
    isPastDue && graceEndsAt !== null && graceEndsAt.getTime() <= Date.now();

  return {
    plan: ctx.org.plan,
    status,
    canLogin: !isSuspended,
    canMutate: !isSuspended && !pastGraceExpired,
    canCreateContent: !isSuspended && !isPastDue,
    graceEndsAt,
    isPaying: status === SubscriptionStatus.ACTIVE,
    isComped,
    compEndsAt: isComped ? (ctx.subscription?.compEndsAt ?? null) : null
  };
}

/** @deprecated Use {@link deriveOrgBillingAccess} — kept for transitional imports. */
export const getOrgBillingAccessFromContext = deriveOrgBillingAccess;

export function orgCanFromContext(ctx: BillingContext, capability: BillingCapability): boolean {
  const access = deriveOrgBillingAccess(ctx);

  if (!access.canMutate && capability !== "export_feedback_pdf_unwatermarked") {
    return false;
  }

  switch (capability) {
    case "export_feedback_pdf_unwatermarked":
      return hasProFeatureAccess(ctx) && !isFreeOrgPlan(ctx.org.plan);
    /** FREE may create events within plan caps — quantitative limits are separate. */
    case "create_event":
      return access.canCreateContent;
    case "send_broadcast":
      return access.canCreateContent && hasProFeatureAccess(ctx);
    default:
      return false;
  }
}

/**
 * Maps subscription lifecycle to Organization.plan. Enterprise manual overrides
 * and active comps are preserved unless explicitly forced.
 */
export function resolveFeaturePlan(input: {
  currentPlan: OrgPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  preserveEnterprise?: boolean;
  compPlan?: OrgPlan | null;
  compEndsAt?: Date | null;
}): OrgPlan {
  if (
    isCompAccessActive({
      compPlan: input.compPlan ?? null,
      compEndsAt: input.compEndsAt ?? null
    })
  ) {
    return input.compPlan === OrgPlan.ENTERPRISE ? OrgPlan.ENTERPRISE : OrgPlan.PRO;
  }

  if (input.preserveEnterprise !== false && input.currentPlan === OrgPlan.ENTERPRISE) {
    return OrgPlan.ENTERPRISE;
  }

  switch (input.status) {
    case SubscriptionStatus.TRIALING:
    case SubscriptionStatus.ACTIVE:
    case SubscriptionStatus.PAST_DUE:
    case SubscriptionStatus.SUSPENDED:
      return OrgPlan.PRO;
    case SubscriptionStatus.CANCELLED:
      if (
        input.cancelAtPeriodEnd &&
        input.currentPeriodEnd &&
        input.currentPeriodEnd.getTime() > Date.now()
      ) {
        return OrgPlan.PRO;
      }
      return OrgPlan.FREE;
    case SubscriptionStatus.TRIAL_EXPIRED:
    case SubscriptionStatus.NONE:
    default:
      return OrgPlan.FREE;
  }
}
