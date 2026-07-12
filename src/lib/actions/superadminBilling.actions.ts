"use server";

import {
  BillingInvoiceSource,
  BillingInvoiceStatus,
  OrgPlan,
  SubscriptionStatus,
  type Prisma
} from "@prisma/client";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  DEFAULT_BILLING_CURRENCY,
  TRIAL_DURATION_MS,
  isPaystackStatusResumable,
  periodExtensionBase
} from "@/lib/billing/constants";
import {
  clearEnterpriseCoverageTrackingData,
  enterpriseCoverageTrackingClearIfFuture
} from "@/lib/billing/clearEnterpriseCoverageTracking";
import {
  recordManualBillingAction,
  snapshotOrgBillingState
} from "@/lib/billing/manualBillingAudit";
import {
  createPaystackCustomer,
  createPaystackPaymentRequest,
  archivePaystackPaymentRequest,
  paystackPaymentRequestPageUrl,
  createPaystackSubscription,
  disablePaystackSubscription,
  enablePaystackSubscription,
  fetchPaystackPlan,
  fetchPaystackSubscription,
  PaystackApiError,
  type PaystackSubscriptionData
} from "@/lib/billing/paystackClient";
import { formatGhsFromPesewas } from "@/lib/billing/formatMoney";
import { maybeSendBillingReceiptEmail } from "@/lib/billing/sendBillingReceipt";
import { applyExclusiveVatPesewas, splitInclusiveVatPesewas } from "@/lib/billing/vatSplit";
import { applySubscriptionEntitlements, ensureSubscriptionRow } from "@/lib/db/billing";
import { sendBillingEnterprisePayableInvoiceEmail } from "@/lib/email/billingEmails";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Shared schemas & helpers
// ---------------------------------------------------------------------------

const orgIdSchema = z.string().trim().min(1, "Organization id is required.");
const reasonSchema = z
  .string()
  .trim()
  .min(10, "Reason must be at least 10 characters.");
const confirmTrueSchema = z.literal(true, {
  errorMap: () => ({ message: "Confirmation is required for this action." })
});
/** Accept ISO-8601 strings (with or without offset). */
const isoDateStringSchema = z
  .string()
  .trim()
  .min(1, "Date is required.")
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid ISO date string."
  });

function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
}

function revalidateSuperadminBilling(orgId: string) {
  revalidatePath("/superadmin");
  revalidatePath(`/superadmin/orgs/${orgId}/billing`);
  revalidatePath("/dashboard/settings/billing");
}

async function requirePlatformOwner(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!session.user.isPlatformOwner) {
    return { ok: false, error: "Only platform owners can manage billing operations." };
  }
  return { ok: true, userId: session.user.id };
}

async function resolveEmailToken(input: {
  subscriptionCode: string;
  storedToken: string | null | undefined;
}): Promise<string | null> {
  if (input.storedToken?.trim()) return input.storedToken.trim();
  try {
    const remote = await fetchPaystackSubscription(input.subscriptionCode);
    return remote.email_token ?? null;
  } catch {
    return null;
  }
}

async function resolvePlanCode(stored: string | null | undefined): Promise<string | null> {
  if (stored?.trim()) return stored.trim();
  return process.env.PAYSTACK_PRO_PLAN_CODE?.trim() || null;
}

type PaystackDisableResult = {
  attempted: boolean;
  ok: boolean;
  error?: string;
  emailToken?: string | null;
  paystackStatus?: string | null;
};

async function bestEffortDisablePaystack(input: {
  paystackSubscriptionCode: string | null | undefined;
  emailToken: string | null | undefined;
}): Promise<PaystackDisableResult> {
  if (!input.paystackSubscriptionCode) {
    return { attempted: false, ok: false, error: "No Paystack subscription code." };
  }

  const emailToken = await resolveEmailToken({
    subscriptionCode: input.paystackSubscriptionCode,
    storedToken: input.emailToken
  });
  if (!emailToken) {
    return {
      attempted: true,
      ok: false,
      error: "Unable to resolve Paystack email token.",
      emailToken: null
    };
  }

  try {
    await disablePaystackSubscription({
      subscriptionCode: input.paystackSubscriptionCode,
      emailToken
    });
  } catch (error) {
    const message =
      error instanceof PaystackApiError ? error.message : "Paystack disable failed.";
    return { attempted: true, ok: false, error: message, emailToken };
  }

  let paystackStatus: string | null = "non-renewing";
  try {
    const remote = await fetchPaystackSubscription(input.paystackSubscriptionCode);
    if (remote.status) paystackStatus = remote.status;
  } catch {
    /* keep default */
  }

  return { attempted: true, ok: true, emailToken, paystackStatus };
}

/**
 * When moving an org onto ENTERPRISE: stop Paystack PRO auto-charge and clear
 * leftover subscription period so Enterprise coverage starts from invoice pay,
 * not a prior PRO cycle.
 */
async function transitionOrgOntoEnterprise(orgId: string): Promise<{
  paystackDisable: PaystackDisableResult;
}> {
  await ensureSubscriptionRow(orgId);
  const subscription = await prisma.subscription.findUnique({
    where: { orgId },
    select: {
      paystackSubscriptionCode: true,
      emailToken: true
    }
  });

  const paystackDisable = await bestEffortDisablePaystack({
    paystackSubscriptionCode: subscription?.paystackSubscriptionCode,
    emailToken: subscription?.emailToken
  });

  await prisma.subscription.update({
    where: { orgId },
    data: {
      cancelAtPeriodEnd: true,
      /**
       * Clear PRO leftover period + subscription identity — Enterprise access
       * is granted only via payable invoice coverage (or explicit superadmin
       * period edits). Leaving a PRO currentPeriodEnd would incorrectly extend
       * the next Enterprise invoice from the old PRO cycle.
       */
      currentPeriodStart: null,
      currentPeriodEnd: null,
      paystackSubscriptionCode: null,
      paystackPlanCode: null,
      emailToken: null,
      paystackStatus: paystackDisable.ok
        ? (paystackDisable.paystackStatus ?? "non-renewing")
        : (paystackDisable.paystackStatus ?? "cancelled"),
      pastDueSince: null,
      dunningAttempt: 0,
      nextDunningAt: null,
      status: SubscriptionStatus.ACTIVE
    }
  });

  return { paystackDisable };
}

/**
 * Clear invoice-billed / paid-period leftovers when leaving ENTERPRISE (or
 * stripping a paid PRO relationship for FREE). Does not create a Paystack
 * subscription — the org must subscribe via Settings → Billing.
 */
async function clearPaidSubscriptionRelationship(orgId: string): Promise<void> {
  await ensureSubscriptionRow(orgId);
  await prisma.subscription.update({
    where: { orgId },
    data: {
      status: SubscriptionStatus.NONE,
      cancelAtPeriodEnd: false,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      paystackSubscriptionCode: null,
      paystackPlanCode: null,
      paystackStatus: null,
      emailToken: null,
      authorizationCode: null,
      cardLast4: null,
      cardExpMonth: null,
      cardExpYear: null,
      cardExpiringNotifiedAt: null,
      pastDueSince: null,
      dunningAttempt: 0,
      lastDunningAttemptAt: null,
      nextDunningAt: null,
      dunningPausedAt: null,
      suspendedAt: null,
      compPlan: null,
      compEndsAt: null,
      ...clearEnterpriseCoverageTrackingData
    }
  });
}

/** ENTERPRISE → PRO: plan flip only (clear leftovers; self-serve subscribe). */
async function transitionOrgOntoProFromEnterprise(orgId: string): Promise<void> {
  await clearPaidSubscriptionRelationship(orgId);
}

/**
 * Silent re-establish (enable or create+start_date) — mirrors setAutoRenewalOnAction.
 */
async function reestablishAutoRenewal(input: {
  customerCode: string;
  planCode: string;
  authorizationCode: string;
  currentPeriodEnd: Date;
  paystackSubscriptionCode: string | null;
  emailToken: string | null;
  paystackStatus: string | null;
}): Promise<{
  subscriptionCode: string;
  emailToken: string;
  paystackStatus: string;
  method: "enable" | "create";
}> {
  const startDateIso = input.currentPeriodEnd.toISOString();

  if (input.paystackSubscriptionCode && isPaystackStatusResumable(input.paystackStatus)) {
    const emailToken = await resolveEmailToken({
      subscriptionCode: input.paystackSubscriptionCode,
      storedToken: input.emailToken
    });
    if (emailToken) {
      try {
        await enablePaystackSubscription({
          subscriptionCode: input.paystackSubscriptionCode,
          emailToken
        });
        return {
          subscriptionCode: input.paystackSubscriptionCode,
          emailToken,
          paystackStatus: "active",
          method: "enable"
        };
      } catch (error) {
        const message = error instanceof PaystackApiError ? error.message : "";
        const terminal =
          /cannot be reactivated/i.test(message) || /has been cancelled/i.test(message);
        if (!terminal) throw error;
      }
    }
  }

  if (input.paystackSubscriptionCode) {
    const emailToken = await resolveEmailToken({
      subscriptionCode: input.paystackSubscriptionCode,
      storedToken: input.emailToken
    });
    if (emailToken) {
      try {
        await disablePaystackSubscription({
          subscriptionCode: input.paystackSubscriptionCode,
          emailToken
        });
      } catch {
        /* already non-renewing / cancelled */
      }
    }
  }

  const created = await createPaystackSubscription({
    customerCode: input.customerCode,
    planCode: input.planCode,
    authorizationCode: input.authorizationCode,
    startDate: startDateIso
  });

  return {
    subscriptionCode: created.subscription_code,
    emailToken: created.email_token,
    paystackStatus: created.status || "active",
    method: "create"
  };
}

function mapPaystackStatusToLocal(remoteStatus: string): {
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
} {
  const normalized = remoteStatus.trim().toLowerCase();
  switch (normalized) {
    case "active":
      return { status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: false };
    case "non-renewing":
      return { status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: true };
    case "attention":
      return { status: SubscriptionStatus.PAST_DUE, cancelAtPeriodEnd: false };
    case "cancelled":
    case "complete":
      return { status: SubscriptionStatus.CANCELLED, cancelAtPeriodEnd: true };
    default:
      return { status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: false };
  }
}

type AuditBundle = {
  auditId: string;
  before: Awaited<ReturnType<typeof snapshotOrgBillingState>>;
  after: Awaited<ReturnType<typeof snapshotOrgBillingState>>;
};

async function commitAuditedMutation(input: {
  orgId: string;
  actorUserId: string;
  action: string;
  reason: string;
  metadata?: Prisma.InputJsonValue;
  mutate: () => Promise<void | Record<string, unknown>>;
}): Promise<AuditBundle & { extra?: Record<string, unknown> }> {
  const before = await snapshotOrgBillingState(input.orgId);
  const mutateResult = await input.mutate();
  const after = await snapshotOrgBillingState(input.orgId);
  const auditId = await recordManualBillingAction({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    action: input.action,
    reason: input.reason,
    beforeState: before,
    afterState: after,
    metadata: input.metadata
  });
  revalidateSuperadminBilling(input.orgId);
  return {
    auditId,
    before,
    after,
    extra: mutateResult && typeof mutateResult === "object" ? mutateResult : undefined
  };
}

async function loadLivePaystack(
  subscriptionCode: string | null | undefined
): Promise<{
  paystack: PaystackSubscriptionData | null;
  paystackError: string | null;
}> {
  if (!subscriptionCode) {
    return { paystack: null, paystackError: null };
  }
  try {
    const paystack = await fetchPaystackSubscription(subscriptionCode);
    return { paystack, paystackError: null };
  } catch (error) {
    const message =
      error instanceof PaystackApiError
        ? error.message
        : "Failed to fetch Paystack subscription.";
    return { paystack: null, paystackError: message };
  }
}

// ---------------------------------------------------------------------------
// 1. Pure read — live Paystack GET
// ---------------------------------------------------------------------------

/**
 * Pure read — GET only, no Paystack side effects.
 * Fetches the remote subscription when a local code exists; never POST/PUT/PATCH.
 */
export async function fetchPaystackLiveStateAction(input: {
  orgId: string;
}): Promise<
  ActionResult<{
    local: Awaited<ReturnType<typeof snapshotOrgBillingState>>;
    paystack: PaystackSubscriptionData | null;
    paystackError: string | null;
  }>
> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = z.object({ orgId: orgIdSchema }).safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const org = await prisma.organization.findUnique({
    where: { id: parsed.data.orgId },
    select: {
      id: true,
      subscription: { select: { paystackSubscriptionCode: true } }
    }
  });
  if (!org) return { success: false, error: "Organization not found." };

  const local = await snapshotOrgBillingState(parsed.data.orgId);
  const { paystack, paystackError } = await loadLivePaystack(
    org.subscription?.paystackSubscriptionCode
  );

  return {
    success: true,
    data: { local, paystack, paystackError }
  };
}

// ---------------------------------------------------------------------------
// 2. Org billing detail (local + optional live Paystack)
// ---------------------------------------------------------------------------

export async function getSuperadminOrgBillingDetailAction(input: {
  orgId: string;
  includeLivePaystack?: boolean;
}): Promise<
  ActionResult<{
    org: {
      id: string;
      name: string;
      slug: string;
      plan: OrgPlan;
      activatedAt: Date | null;
      createdAt: Date;
    };
    subscription: NonNullable<
      Awaited<ReturnType<typeof prisma.subscription.findUnique>>
    > | null;
    customer: NonNullable<
      Awaited<ReturnType<typeof prisma.billingCustomer.findUnique>>
    > | null;
    invoices: Awaited<ReturnType<typeof prisma.billingInvoice.findMany>>;
    manualActions: Array<{
      id: string;
      action: string;
      reason: string;
      createdAt: Date;
      actorUserId: string;
      actorEmail: string | null;
      actorName: string | null;
      metadata: unknown;
    }>;
    paystack: PaystackSubscriptionData | null;
    paystackError: string | null;
  }>
> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = z
    .object({
      orgId: orgIdSchema,
      includeLivePaystack: z.boolean().optional()
    })
    .safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, includeLivePaystack = true } = parsed.data;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      activatedAt: true,
      createdAt: true
    }
  });
  if (!org) return { success: false, error: "Organization not found." };

  const [subscription, customer, invoices, manualRows] = await Promise.all([
    prisma.subscription.findUnique({ where: { orgId } }),
    prisma.billingCustomer.findUnique({ where: { orgId } }),
    prisma.billingInvoice.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.manualBillingAction.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        reason: true,
        createdAt: true,
        actorUserId: true,
        metadata: true,
        actor: { select: { email: true, name: true } }
      }
    })
  ]);

  const live = includeLivePaystack
    ? await loadLivePaystack(subscription?.paystackSubscriptionCode)
    : { paystack: null, paystackError: null };

  return {
    success: true,
    data: {
      org,
      subscription,
      customer,
      invoices,
      manualActions: manualRows.map((row) => ({
        id: row.id,
        action: row.action,
        reason: row.reason,
        createdAt: row.createdAt,
        actorUserId: row.actorUserId,
        actorEmail: row.actor.email,
        actorName: row.actor.name,
        metadata: row.metadata
      })),
      paystack: live.paystack,
      paystackError: live.paystackError
    }
  };
}

// ---------------------------------------------------------------------------
// 3. Suspend
// ---------------------------------------------------------------------------

const suspendSchema = z.object({
  orgId: orgIdSchema,
  reason: reasonSchema,
  syncPaystack: z.boolean().optional(),
  confirm: confirmTrueSchema
});

export async function suspendOrgBillingAction(
  input: z.input<typeof suspendSchema>
): Promise<ActionResult<AuditBundle & { paystackDisable?: PaystackDisableResult }>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = suspendSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason, syncPaystack = false } = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  let paystackDisable: PaystackDisableResult | undefined;

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "suspend",
      reason,
      metadata: { syncPaystack },
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        const sub = await prisma.subscription.findUnique({
          where: { orgId },
          select: {
            paystackSubscriptionCode: true,
            emailToken: true
          }
        });

        if (syncPaystack && sub) {
          paystackDisable = await bestEffortDisablePaystack(sub);
        }

        const now = new Date();
        await prisma.subscription.update({
          where: { orgId },
          data: {
            status: SubscriptionStatus.SUSPENDED,
            suspendedAt: now,
            nextDunningAt: null,
            ...(paystackDisable?.emailToken
              ? { emailToken: paystackDisable.emailToken }
              : {}),
            ...(paystackDisable?.paystackStatus
              ? { paystackStatus: paystackDisable.paystackStatus }
              : {})
          }
        });
        // Do NOT clear Organization.activatedAt — onboarding only.
      }
    });

    return {
      success: true,
      data: { ...audited, paystackDisable }
    };
  } catch {
    return { success: false, error: "Unable to suspend organization billing." };
  }
}

// ---------------------------------------------------------------------------
// 4. Reinstate
// ---------------------------------------------------------------------------

const reinstateSchema = z.object({
  orgId: orgIdSchema,
  reason: reasonSchema,
  targetStatus: z.enum([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE])
});

export async function reinstateOrgBillingAction(
  input: z.input<typeof reinstateSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = reinstateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason, targetStatus } = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "reinstate",
      reason,
      metadata: { targetStatus },
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        await prisma.subscription.update({
          where: { orgId },
          data: {
            status: targetStatus,
            suspendedAt: null,
            ...(targetStatus === SubscriptionStatus.ACTIVE
              ? {
                  pastDueSince: null,
                  dunningAttempt: 0,
                  nextDunningAt: null,
                  lastDunningAttemptAt: null,
                  dunningPausedAt: null
                }
              : {})
          }
        });
        await applySubscriptionEntitlements({ orgId, status: targetStatus });
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to reinstate organization billing." };
  }
}

// ---------------------------------------------------------------------------
// 5. Force cancel
// ---------------------------------------------------------------------------

const forceCancelSchema = z.object({
  orgId: orgIdSchema,
  reason: reasonSchema,
  disableOnPaystack: z.boolean().optional(),
  confirm: confirmTrueSchema
});

export async function forceCancelOrgBillingAction(
  input: z.input<typeof forceCancelSchema>
): Promise<ActionResult<AuditBundle & { paystackDisable?: PaystackDisableResult }>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = forceCancelSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason, disableOnPaystack = false } = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  let paystackDisable: PaystackDisableResult | undefined;

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "force_cancel",
      reason,
      metadata: { disableOnPaystack },
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        const sub = await prisma.subscription.findUnique({
          where: { orgId },
          select: { paystackSubscriptionCode: true, emailToken: true }
        });

        if (disableOnPaystack && sub) {
          paystackDisable = await bestEffortDisablePaystack(sub);
        }

        const now = new Date();
        await prisma.subscription.update({
          where: { orgId },
          data: {
            status: SubscriptionStatus.CANCELLED,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: now,
            suspendedAt: null,
            ...(paystackDisable?.emailToken
              ? { emailToken: paystackDisable.emailToken }
              : {}),
            ...(paystackDisable?.paystackStatus
              ? { paystackStatus: paystackDisable.paystackStatus }
              : {})
          }
        });
        await applySubscriptionEntitlements({
          orgId,
          status: SubscriptionStatus.CANCELLED,
          preserveEnterprise: false
        });
      }
    });

    return { success: true, data: { ...audited, paystackDisable } };
  } catch {
    return { success: false, error: "Unable to force-cancel organization billing." };
  }
}

// ---------------------------------------------------------------------------
// 6. Plan override
// ---------------------------------------------------------------------------

const planOverrideSchema = z.object({
  orgId: orgIdSchema,
  plan: z.nativeEnum(OrgPlan),
  reason: reasonSchema
});

export async function setOrgPlanOverrideAction(
  input: z.input<typeof planOverrideSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = planOverrideSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, plan, reason } = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, plan: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "set_plan_override",
      reason,
      metadata: { plan, previousPlan: org.plan },
      mutate: async () => {
        await ensureSubscriptionRow(orgId);

        if (plan === OrgPlan.ENTERPRISE && org.plan !== OrgPlan.ENTERPRISE) {
          const { paystackDisable } = await transitionOrgOntoEnterprise(orgId);
          await prisma.organization.update({
            where: { id: orgId },
            data: { plan }
          });
          return { paystackDisable };
        }

        if (plan === OrgPlan.PRO && org.plan === OrgPlan.ENTERPRISE) {
          await transitionOrgOntoProFromEnterprise(orgId);
          await prisma.organization.update({
            where: { id: orgId },
            data: { plan }
          });
          return {
            note: "Plan set to PRO. No Paystack subscription was created — the org must subscribe via Settings → Billing."
          };
        }

        if (plan === OrgPlan.FREE && org.plan !== OrgPlan.FREE) {
          /**
           * Leaving ENTERPRISE/PRO must clear cancelAtPeriodEnd + coverage
           * window leftovers, or Billing still shows "Won't renew".
           */
          await clearPaidSubscriptionRelationship(orgId);
          await prisma.organization.update({
            where: { id: orgId },
            data: { plan }
          });
          return {
            note: "Plan set to FREE. Cleared paid/Enterprise subscription leftovers."
          };
        }

        await prisma.organization.update({
          where: { id: orgId },
          data: { plan }
        });
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to set plan override." };
  }
}

// ---------------------------------------------------------------------------
// 7. Grant comp access
// ---------------------------------------------------------------------------

const grantCompSchema = z.object({
  orgId: orgIdSchema,
  plan: z.enum([OrgPlan.PRO, OrgPlan.ENTERPRISE]),
  days: z.number().int().min(1).max(3650),
  reason: reasonSchema
});

export async function grantCompAccessAction(
  input: z.input<typeof grantCompSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = grantCompSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, plan, days, reason } = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, plan: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "grant_comp",
      reason,
      metadata: { plan, days },
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        const now = new Date();
        const compEndsAt = new Date(now.getTime() + days * MS_PER_DAY);
        const existing = await prisma.subscription.findUnique({
          where: { orgId },
          select: { status: true }
        });

        const reinstateFromSuspend = existing?.status === SubscriptionStatus.SUSPENDED;

        if (plan === OrgPlan.ENTERPRISE && org.plan !== OrgPlan.ENTERPRISE) {
          await transitionOrgOntoEnterprise(orgId);
        }

        await prisma.subscription.update({
          where: { orgId },
          data: {
            compPlan: plan,
            compEndsAt,
            ...(reinstateFromSuspend
              ? {
                  status: SubscriptionStatus.ACTIVE,
                  suspendedAt: null
                }
              : {}),
            ...(plan === OrgPlan.ENTERPRISE
              ? {
                  // Comp ENTERPRISE still uses compEndsAt as access window.
                  currentPeriodEnd: compEndsAt,
                  currentPeriodStart: now,
                  cancelAtPeriodEnd: true,
                  ...clearEnterpriseCoverageTrackingData
                }
              : {})
          }
        });
        await prisma.organization.update({
          where: { id: orgId },
          data: { plan }
        });
        if (reinstateFromSuspend) {
          await applySubscriptionEntitlements({
            orgId,
            status: SubscriptionStatus.ACTIVE
          });
        }
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to grant comp access." };
  }
}

// ---------------------------------------------------------------------------
// 8. Revoke comp access
// ---------------------------------------------------------------------------

const revokeCompSchema = z.object({
  orgId: orgIdSchema,
  reason: reasonSchema
});

export async function revokeCompAccessAction(
  input: z.input<typeof revokeCompSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = revokeCompSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason } = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "revoke_comp",
      reason,
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        const sub = await prisma.subscription.findUnique({
          where: { orgId },
          select: { status: true }
        });
        await prisma.subscription.update({
          where: { orgId },
          data: { compPlan: null, compEndsAt: null }
        });
        await applySubscriptionEntitlements({
          orgId,
          status: sub?.status,
          preserveEnterprise: false
        });
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to revoke comp access." };
  }
}

// ---------------------------------------------------------------------------
// 9. Extend trial
// ---------------------------------------------------------------------------

const extendTrialSchema = z.object({
  orgId: orgIdSchema,
  addDays: z.number().int().min(1).max(3650),
  reason: reasonSchema
});

export async function extendTrialAction(
  input: z.input<typeof extendTrialSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = extendTrialSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, addDays, reason } = parsed.data;

  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    select: { status: true, trialEndsAt: true }
  });
  if (!sub) return { success: false, error: "No subscription row for this organization." };
  if (sub.status !== SubscriptionStatus.TRIALING) {
    return { success: false, error: "Organization is not currently on a trial." };
  }
  if (!sub.trialEndsAt) {
    return { success: false, error: "Trial end date is missing." };
  }

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "extend_trial",
      reason,
      metadata: { addDays },
      mutate: async () => {
        const base = periodExtensionBase(sub.trialEndsAt);
        await prisma.subscription.update({
          where: { orgId },
          data: {
            trialEndsAt: new Date(base.getTime() + addDays * MS_PER_DAY)
          }
        });
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to extend trial." };
  }
}

// ---------------------------------------------------------------------------
// 10. Set trialEndsAt
// ---------------------------------------------------------------------------

const setTrialEndsAtSchema = z.object({
  orgId: orgIdSchema,
  trialEndsAt: isoDateStringSchema,
  reason: reasonSchema
});

export async function setTrialEndsAtAction(
  input: z.input<typeof setTrialEndsAtSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = setTrialEndsAtSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason } = parsed.data;
  const trialEndsAt = new Date(parsed.data.trialEndsAt);
  if (Number.isNaN(trialEndsAt.getTime())) {
    return { success: false, error: "Invalid trialEndsAt timestamp." };
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "set_trial_ends_at",
      reason,
      metadata: { trialEndsAt: trialEndsAt.toISOString() },
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        await prisma.subscription.update({
          where: { orgId },
          data: { trialEndsAt }
        });
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to set trial end date." };
  }
}

// ---------------------------------------------------------------------------
// 11. Grant fresh trial
// ---------------------------------------------------------------------------

const grantFreshTrialSchema = z.object({
  orgId: orgIdSchema,
  days: z.number().int().min(1).max(3650).optional(),
  allowRepeat: z.boolean().optional(),
  reason: reasonSchema
});

export async function grantFreshTrialAction(
  input: z.input<typeof grantFreshTrialSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = grantFreshTrialSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason } = parsed.data;
  const days = parsed.data.days ?? Math.round(TRIAL_DURATION_MS / MS_PER_DAY);
  const allowRepeat = parsed.data.allowRepeat ?? false;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  await ensureSubscriptionRow(orgId);
  const existing = await prisma.subscription.findUnique({
    where: { orgId },
    select: { trialStartsAt: true }
  });
  if (existing?.trialStartsAt && !allowRepeat) {
    return {
      success: false,
      error:
        "This organization already had a trial. Pass allowRepeat: true to grant another."
    };
  }

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "grant_fresh_trial",
      reason,
      metadata: { days, allowRepeat },
      mutate: async () => {
        const now = new Date();
        const trialEndsAt = new Date(now.getTime() + days * MS_PER_DAY);
        await prisma.subscription.update({
          where: { orgId },
          data: {
            status: SubscriptionStatus.TRIALING,
            trialStartsAt: now,
            trialEndsAt,
            trialReminderDay60SentAt: null,
            trialReminderDay80SentAt: null,
            trialReminderDay89SentAt: null,
            /** Drop Enterprise/PRO leftovers so Billing does not show "Won't renew". */
            cancelAtPeriodEnd: false,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            paystackSubscriptionCode: null,
            paystackPlanCode: null,
            paystackStatus: null,
            emailToken: null,
            authorizationCode: null,
            cardLast4: null,
            cardExpMonth: null,
            cardExpYear: null,
            cardExpiringNotifiedAt: null,
            pastDueSince: null,
            dunningAttempt: 0,
            lastDunningAttemptAt: null,
            nextDunningAt: null,
            dunningPausedAt: null,
            suspendedAt: null,
            compPlan: null,
            compEndsAt: null,
            ...clearEnterpriseCoverageTrackingData
          }
        });
        await prisma.organization.update({
          where: { id: orgId },
          data: { plan: OrgPlan.PRO }
        });
        await applySubscriptionEntitlements({
          orgId,
          status: SubscriptionStatus.TRIALING,
          preserveEnterprise: false
        });
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to grant a fresh trial." };
  }
}

// ---------------------------------------------------------------------------
// 12. Force expire trial
// ---------------------------------------------------------------------------

const forceExpireTrialSchema = z.object({
  orgId: orgIdSchema,
  reason: reasonSchema,
  confirm: confirmTrueSchema
});

export async function forceExpireTrialAction(
  input: z.input<typeof forceExpireTrialSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = forceExpireTrialSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason } = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "force_expire_trial",
      reason,
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        const now = new Date();
        await prisma.subscription.update({
          where: { orgId },
          data: {
            trialEndsAt: now,
            status: SubscriptionStatus.TRIAL_EXPIRED
          }
        });
        await applySubscriptionEntitlements({
          orgId,
          status: SubscriptionStatus.TRIAL_EXPIRED,
          preserveEnterprise: false
        });
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to force-expire trial." };
  }
}

// ---------------------------------------------------------------------------
// 13. Set currentPeriodEnd
// ---------------------------------------------------------------------------

const setPeriodEndSchema = z.object({
  orgId: orgIdSchema,
  currentPeriodEnd: isoDateStringSchema,
  reason: reasonSchema
});

export async function setCurrentPeriodEndAction(
  input: z.input<typeof setPeriodEndSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = setPeriodEndSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason } = parsed.data;
  const currentPeriodEnd = new Date(parsed.data.currentPeriodEnd);
  if (Number.isNaN(currentPeriodEnd.getTime())) {
    return { success: false, error: "Invalid currentPeriodEnd timestamp." };
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "set_current_period_end",
      reason,
      metadata: { currentPeriodEnd: currentPeriodEnd.toISOString() },
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        await prisma.subscription.update({
          where: { orgId },
          data: {
            currentPeriodEnd,
            ...enterpriseCoverageTrackingClearIfFuture(currentPeriodEnd)
          }
        });
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to set current period end." };
  }
}

// ---------------------------------------------------------------------------
// 14. Resync from Paystack (GET only, then overwrite local)
// ---------------------------------------------------------------------------

const resyncSchema = z.object({
  orgId: orgIdSchema,
  reason: reasonSchema
});

export async function resyncSubscriptionFromPaystackAction(
  input: z.input<typeof resyncSchema>
): Promise<
  ActionResult<AuditBundle & { paystack: PaystackSubscriptionData }>
> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = resyncSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason } = parsed.data;

  await ensureSubscriptionRow(orgId);
  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    select: { paystackSubscriptionCode: true }
  });
  if (!sub?.paystackSubscriptionCode) {
    return { success: false, error: "No Paystack subscription code on file." };
  }

  let remote: PaystackSubscriptionData;
  try {
    remote = await fetchPaystackSubscription(sub.paystackSubscriptionCode);
  } catch (error) {
    const message =
      error instanceof PaystackApiError
        ? error.message
        : "Failed to fetch Paystack subscription.";
    return { success: false, error: message };
  }

  const mapped = mapPaystackStatusToLocal(remote.status);
  const nextPayment = remote.next_payment_date
    ? new Date(remote.next_payment_date)
    : null;

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "resync_paystack",
      reason,
      metadata: {
        paystackStatus: remote.status,
        subscriptionCode: remote.subscription_code
      },
      mutate: async () => {
        await prisma.subscription.update({
          where: { orgId },
          data: {
            paystackSubscriptionCode: remote.subscription_code,
            emailToken: remote.email_token,
            paystackPlanCode: remote.plan?.plan_code ?? undefined,
            paystackStatus: remote.status,
            status: mapped.status,
            cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
            ...(nextPayment && !Number.isNaN(nextPayment.getTime())
              ? { currentPeriodEnd: nextPayment }
              : {}),
            ...(mapped.status === SubscriptionStatus.ACTIVE && !mapped.cancelAtPeriodEnd
              ? { suspendedAt: null }
              : {})
          }
        });
        await applySubscriptionEntitlements({ orgId, status: mapped.status });
      }
    });
    return { success: true, data: { ...audited, paystack: remote } };
  } catch {
    return { success: false, error: "Unable to resync subscription from Paystack." };
  }
}

// ---------------------------------------------------------------------------
// 15. Mark invoice paid (manual)
// ---------------------------------------------------------------------------

const markInvoicePaidSchema = z.object({
  orgId: orgIdSchema,
  invoiceId: z.string().trim().min(1),
  reason: reasonSchema,
  paidAt: isoDateStringSchema.optional()
});

export async function markInvoicePaidManualAction(
  input: z.input<typeof markInvoicePaidSchema>
): Promise<ActionResult<AuditBundle & { invoiceId: string }>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = markInvoicePaidSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, invoiceId, reason } = parsed.data;
  const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    return { success: false, error: "Invalid paidAt timestamp." };
  }

  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: invoiceId, orgId },
    select: { id: true }
  });
  if (!invoice) return { success: false, error: "Invoice not found for this organization." };

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "mark_invoice_paid",
      reason,
      metadata: { invoiceId, paidAt: paidAt.toISOString() },
      mutate: async () => {
        await prisma.billingInvoice.update({
          where: { id: invoiceId },
          data: {
            status: BillingInvoiceStatus.PAID,
            paidAt
          }
        });
      }
    });
    try {
      await maybeSendBillingReceiptEmail(invoiceId);
    } catch (err) {
      console.error("[superadmin-billing] receipt email failed", err);
    }
    return { success: true, data: { ...audited, invoiceId } };
  } catch {
    return { success: false, error: "Unable to mark invoice as paid." };
  }
}

// ---------------------------------------------------------------------------
// 16. Create manual invoice
// ---------------------------------------------------------------------------

const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amountPesewas: z.number().int()
});

const createManualInvoiceSchema = z.object({
  orgId: orgIdSchema,
  reason: reasonSchema,
  amountPesewas: z.number().int().min(0),
  currency: z.string().trim().min(3).max(3).optional(),
  lineItems: z.array(lineItemSchema).min(1),
  markPaid: z.boolean().optional(),
  periodStart: isoDateStringSchema.optional(),
  periodEnd: isoDateStringSchema.optional()
});

export async function logOfflinePaymentAction(
  input: z.input<typeof createManualInvoiceSchema>
): Promise<ActionResult<AuditBundle & { invoiceId: string }>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = createManualInvoiceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const {
    orgId,
    reason,
    amountPesewas,
    lineItems,
    markPaid = false
  } = parsed.data;
  const currency = (parsed.data.currency ?? DEFAULT_BILLING_CURRENCY).toUpperCase();
  const periodStart = parsed.data.periodStart
    ? new Date(parsed.data.periodStart)
    : null;
  const periodEnd = parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : null;

  if (periodStart && Number.isNaN(periodStart.getTime())) {
    return { success: false, error: "Invalid periodStart timestamp." };
  }
  if (periodEnd && Number.isNaN(periodEnd.getTime())) {
    return { success: false, error: "Invalid periodEnd timestamp." };
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  let invoiceId = "";

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "log_offline_payment",
      reason,
      metadata: { amountPesewas, currency, markPaid },
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        const sub = await prisma.subscription.findUnique({
          where: { orgId },
          select: { id: true }
        });
        const paystackInvoiceCode = `manual-${randomBytes(12).toString("hex")}`;
        const now = new Date();
        const vat = splitInclusiveVatPesewas(amountPesewas);
        const created = await prisma.billingInvoice.create({
          data: {
            orgId,
            subscriptionId: sub?.id ?? null,
            paystackInvoiceCode,
            amountPesewas,
            ...vat,
            currency,
            status: markPaid ? BillingInvoiceStatus.PAID : BillingInvoiceStatus.PENDING,
            source: BillingInvoiceSource.MANUAL,
            lineItems,
            paidAt: markPaid ? now : null,
            periodStart,
            periodEnd
          },
          select: { id: true }
        });
        invoiceId = created.id;
        return { invoiceId };
      }
    });
    if (markPaid && invoiceId) {
      try {
        await maybeSendBillingReceiptEmail(invoiceId);
      } catch (err) {
        console.error("[superadmin-billing] receipt email failed", err);
      }
    }
    return { success: true, data: { ...audited, invoiceId } };
  } catch {
    return { success: false, error: "Unable to log offline payment." };
  }
}

/** @deprecated Prefer {@link logOfflinePaymentAction} — same implementation. */
export const createManualInvoiceAction = logOfflinePaymentAction;

// ---------------------------------------------------------------------------
// 17. Dunning controls (counters only — do not change status)
// ---------------------------------------------------------------------------

const dunningOrgSchema = z.object({
  orgId: orgIdSchema,
  reason: reasonSchema
});

export async function pauseDunningAction(
  input: z.input<typeof dunningOrgSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = dunningOrgSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason } = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "pause_dunning",
      reason,
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        await prisma.subscription.update({
          where: { orgId },
          data: { dunningPausedAt: new Date(), nextDunningAt: null }
        });
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to pause dunning." };
  }
}

export async function resumeDunningAction(
  input: z.input<typeof dunningOrgSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = dunningOrgSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason } = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "resume_dunning",
      reason,
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        await prisma.subscription.update({
          where: { orgId },
          data: { dunningPausedAt: null }
        });
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to resume dunning." };
  }
}

export async function resetDunningAction(
  input: z.input<typeof dunningOrgSchema>
): Promise<ActionResult<AuditBundle>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = dunningOrgSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason } = parsed.data;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "reset_dunning",
      reason,
      mutate: async () => {
        await ensureSubscriptionRow(orgId);
        // Counters only — do NOT change status.
        await prisma.subscription.update({
          where: { orgId },
          data: {
            dunningAttempt: 0,
            pastDueSince: null,
            nextDunningAt: null,
            lastDunningAttemptAt: null
          }
        });
      }
    });
    return { success: true, data: audited };
  } catch {
    return { success: false, error: "Unable to reset dunning counters." };
  }
}

// ---------------------------------------------------------------------------
// 18. Auto-renewal on/off (Paystack enable/disable or create+start_date)
// ---------------------------------------------------------------------------

const autoRenewalSchema = z.object({
  orgId: orgIdSchema,
  enabled: z.boolean(),
  reason: reasonSchema
});

export async function setOrgAutoRenewalAction(
  input: z.input<typeof autoRenewalSchema>
): Promise<
  ActionResult<
    AuditBundle & {
      cancelAtPeriodEnd: boolean;
      method?: "enable" | "create" | "disable";
      paystackStatus?: string | null;
    }
  >
> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = autoRenewalSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, enabled, reason } = parsed.data;
  const now = new Date();

  const [subscription, customer] = await Promise.all([
    prisma.subscription.findUnique({
      where: { orgId },
      select: {
        status: true,
        cancelAtPeriodEnd: true,
        paystackSubscriptionCode: true,
        paystackPlanCode: true,
        authorizationCode: true,
        emailToken: true,
        currentPeriodEnd: true,
        paystackStatus: true
      }
    }),
    prisma.billingCustomer.findUnique({
      where: { orgId },
      select: { paystackCustomerCode: true }
    })
  ]);

  if (!subscription) {
    return { success: false, error: "No subscription row for this organization." };
  }

  if (!enabled) {
    if (!subscription.paystackSubscriptionCode) {
      return { success: false, error: "Missing Paystack subscription code." };
    }

    let method: "disable" = "disable";
    let paystackStatus: string | null = "non-renewing";

    try {
      const audited = await commitAuditedMutation({
        orgId,
        actorUserId: guard.userId,
        action: "set_auto_renewal_off",
        reason,
        mutate: async () => {
          const disableResult = await bestEffortDisablePaystack({
            paystackSubscriptionCode: subscription.paystackSubscriptionCode,
            emailToken: subscription.emailToken
          });
          if (!disableResult.ok) {
            throw new Error(disableResult.error ?? "Unable to disable Paystack subscription.");
          }
          paystackStatus = disableResult.paystackStatus ?? "non-renewing";
          await prisma.subscription.update({
            where: { orgId },
            data: {
              cancelAtPeriodEnd: true,
              emailToken: disableResult.emailToken ?? subscription.emailToken,
              paystackStatus,
              status:
                subscription.status === SubscriptionStatus.ACTIVE
                  ? SubscriptionStatus.ACTIVE
                  : subscription.status
            }
          });
          return { method, paystackStatus };
        }
      });
      return {
        success: true,
        data: {
          ...audited,
          cancelAtPeriodEnd: true,
          method,
          paystackStatus
        }
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to turn off auto-renewal.";
      return { success: false, error: message };
    }
  }

  // enabled === true
  if (!subscription.authorizationCode) {
    return {
      success: false,
      error: "No payment method on file (authorizationCode). Cannot re-enable auto-renewal."
    };
  }
  if (!subscription.currentPeriodEnd || subscription.currentPeriodEnd.getTime() <= now.getTime()) {
    return {
      success: false,
      error: "currentPeriodEnd must be in the future to schedule the next debit."
    };
  }
  if (!customer?.paystackCustomerCode) {
    return { success: false, error: "Missing Paystack customer code." };
  }

  const planCode = await resolvePlanCode(subscription.paystackPlanCode);
  if (!planCode) {
    return { success: false, error: "Billing plan code is not configured." };
  }

  // Warm the plan fetch so misconfigured codes fail before we mutate.
  try {
    await fetchPaystackPlan(planCode);
  } catch (error) {
    const message =
      error instanceof PaystackApiError ? error.message : "Unable to verify Paystack plan.";
    return { success: false, error: message };
  }

  let method: "enable" | "create" = "enable";
  let paystackStatus: string | null = "active";

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "set_auto_renewal_on",
      reason,
      mutate: async () => {
        const restored = await reestablishAutoRenewal({
          customerCode: customer.paystackCustomerCode,
          planCode,
          authorizationCode: subscription.authorizationCode!,
          currentPeriodEnd: subscription.currentPeriodEnd!,
          paystackSubscriptionCode: subscription.paystackSubscriptionCode,
          emailToken: subscription.emailToken,
          paystackStatus: subscription.paystackStatus
        });
        method = restored.method;
        paystackStatus = restored.paystackStatus;

        await prisma.subscription.update({
          where: { orgId },
          data: {
            cancelAtPeriodEnd: false,
            paystackSubscriptionCode: restored.subscriptionCode,
            emailToken: restored.emailToken,
            paystackStatus: restored.paystackStatus,
            paystackPlanCode: planCode,
            status: SubscriptionStatus.ACTIVE,
            suspendedAt: null
          }
        });
        await applySubscriptionEntitlements({
          orgId,
          status: SubscriptionStatus.ACTIVE
        });
        return { method, paystackStatus };
      }
    });

    return {
      success: true,
      data: {
        ...audited,
        cancelAtPeriodEnd: false,
        method,
        paystackStatus
      }
    };
  } catch (error) {
    const message =
      error instanceof PaystackApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unable to turn on auto-renewal.";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Enterprise payable invoice (Paystack Payment Request)
// ---------------------------------------------------------------------------

const enterpriseLineItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amountPesewas: z.number().int().positive("Line amount must be greater than zero.")
});

const createEnterprisePayableSchema = z.object({
  orgId: orgIdSchema,
  reason: reasonSchema,
  dueDate: isoDateStringSchema,
  applyVat: z.boolean().optional().default(true),
  notes: z.string().trim().max(1000).optional().nullable(),
  lineItems: z.array(enterpriseLineItemSchema).min(1).max(40),
  billingEmailOverride: z.string().trim().email().optional().nullable(),
  /** Months of Enterprise access granted when paid. Required unless coverageEndsAt is set. */
  coverageMonths: z.number().int().min(1).max(120).optional().nullable(),
  coverageEndsAt: isoDateStringSchema.optional().nullable(),
  /**
   * Extend from existing Enterprise currentPeriodEnd when it is still in the future.
   * Ignored (forced false) when there is no genuine future Enterprise period.
   */
  extendFromPriorCoverage: z.boolean().optional().default(true)
}).superRefine((val, ctx) => {
  if (!val.coverageMonths && !val.coverageEndsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Set coverage duration (months) or an explicit coverage end date.",
      path: ["coverageMonths"]
    });
  }
});

async function buildEnterprisePayableEmailPayload(invoiceId: string) {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: {
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
  if (!invoice?.paymentPageUrl || !invoice.paystackPaymentRequestCode) return null;

  const to =
    invoice.org.billingCustomer?.billingEmail?.trim() ||
    invoice.org.users[0]?.email?.trim() ||
    null;
  if (!to) return null;

  const currency = invoice.currency || DEFAULT_BILLING_CURRENCY;
  const customLines = Array.isArray(invoice.lineItems)
    ? (invoice.lineItems as Array<{ description?: string; amountPesewas?: number }>)
    : [];

  const lines = [
    ...customLines
      .filter((l) => typeof l.description === "string")
      .map((l) => ({
        label: String(l.description),
        amountLabel: formatGhsFromPesewas(
          typeof l.amountPesewas === "number" ? l.amountPesewas : 0,
          currency
        )
      })),
    ...(invoice.nhilAmountPesewas > 0
      ? [
          {
            label: "NHIL (2.5%)",
            amountLabel: formatGhsFromPesewas(invoice.nhilAmountPesewas, currency),
            muted: true as const
          }
        ]
      : []),
    ...(invoice.getfundAmountPesewas > 0
      ? [
          {
            label: "GETFund levy (2.5%)",
            amountLabel: formatGhsFromPesewas(invoice.getfundAmountPesewas, currency),
            muted: true as const
          }
        ]
      : []),
    ...(invoice.vatAmountPesewas > 0
      ? [
          {
            label: "VAT (15%)",
            amountLabel: formatGhsFromPesewas(invoice.vatAmountPesewas, currency),
            muted: true as const
          }
        ]
      : [])
  ];

  const due = invoice.dueDate ?? invoice.createdAt;
  const dueDateLabel = due.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return {
    to,
    adminName: invoice.org.users[0]?.name ?? null,
    orgName: invoice.org.name,
    totalLabel: formatGhsFromPesewas(invoice.amountPesewas, currency),
    dueDateLabel,
    reference: invoice.paystackPaymentRequestCode,
    paymentPageUrl: invoice.paymentPageUrl,
    lines
  };
}

export async function createEnterprisePayableInvoiceAction(
  input: z.input<typeof createEnterprisePayableSchema>
): Promise<ActionResult<AuditBundle & { invoiceId: string; paymentPageUrl: string }>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = createEnterprisePayableSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, reason, lineItems, applyVat } = parsed.data;
  const dueDate = new Date(parsed.data.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return { success: false, error: "Invalid due date." };
  }
  const coverageEndsAt = parsed.data.coverageEndsAt
    ? new Date(parsed.data.coverageEndsAt)
    : null;
  if (coverageEndsAt && Number.isNaN(coverageEndsAt.getTime())) {
    return { success: false, error: "Invalid coverage end date." };
  }
  const coverageMonths = coverageEndsAt ? null : (parsed.data.coverageMonths ?? null);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      plan: true,
      billingCustomer: true,
      subscription: { select: { currentPeriodEnd: true } },
      users: {
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { email: true, name: true }
      }
    }
  });
  if (!org) return { success: false, error: "Organization not found." };
  if (org.plan !== OrgPlan.ENTERPRISE) {
    return {
      success: false,
      error: "Payable Payment Requests are for ENTERPRISE workspaces only."
    };
  }

  /**
   * Only extend from a genuine future Enterprise period. Leftover PRO dates are
   * cleared on ENTERPRISE upgrade, so a future currentPeriodEnd here means prior
   * Enterprise coverage (invoice or comp).
   */
  const priorEnterpriseEnd = org.subscription?.currentPeriodEnd ?? null;
  const hasGenuinePriorEnterpriseCoverage = Boolean(
    priorEnterpriseEnd && priorEnterpriseEnd.getTime() > Date.now()
  );
  const extendFromPriorCoverage =
    Boolean(parsed.data.extendFromPriorCoverage) && hasGenuinePriorEnterpriseCoverage;

  const billingEmail =
    parsed.data.billingEmailOverride?.trim() ||
    org.billingCustomer?.billingEmail?.trim() ||
    org.users[0]?.email?.trim() ||
    null;
  if (!billingEmail) {
    return { success: false, error: "No billing email available for this organization." };
  }

  const exclusiveBase = lineItems.reduce((sum, item) => sum + item.amountPesewas, 0);
  const vatSplit = applyVat
    ? applyExclusiveVatPesewas(exclusiveBase)
    : {
        baseAmountPesewas: exclusiveBase,
        nhilAmountPesewas: 0,
        getfundAmountPesewas: 0,
        vatAmountPesewas: 0,
        totalPesewas: exclusiveBase
      };

  let customerCode = org.billingCustomer?.paystackCustomerCode ?? null;
  if (!customerCode) {
    try {
      const created = await createPaystackCustomer({
        email: billingEmail,
        metadata: { orgId: org.id, purpose: "enterprise_payable" }
      });
      customerCode = created.customer_code;
      await prisma.billingCustomer.upsert({
        where: { orgId: org.id },
        create: {
          orgId: org.id,
          paystackCustomerCode: customerCode,
          billingEmail
        },
        update: {
          paystackCustomerCode: customerCode,
          billingEmail
        }
      });
    } catch (error) {
      const message =
        error instanceof PaystackApiError
          ? error.message
          : "Unable to create Paystack customer.";
      return { success: false, error: message };
    }
  }

  const dueDateIso = dueDate.toISOString().slice(0, 10);
  const notes = parsed.data.notes?.trim() || null;

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "create_enterprise_payable_invoice",
      reason,
      metadata: {
        applyVat,
        exclusiveBase,
        totalPesewas: vatSplit.totalPesewas,
        dueDate: dueDateIso,
        lineItemCount: lineItems.length,
        coverageMonths,
        coverageEndsAt: coverageEndsAt?.toISOString() ?? null,
        extendFromPriorCoverage
      },
      mutate: async () => {
        const draft = await prisma.billingInvoice.create({
          data: {
            orgId,
            amountPesewas: vatSplit.totalPesewas,
            baseAmountPesewas: vatSplit.baseAmountPesewas,
            nhilAmountPesewas: vatSplit.nhilAmountPesewas,
            getfundAmountPesewas: vatSplit.getfundAmountPesewas,
            vatAmountPesewas: vatSplit.vatAmountPesewas,
            currency: DEFAULT_BILLING_CURRENCY,
            status: BillingInvoiceStatus.PENDING,
            source: BillingInvoiceSource.ENTERPRISE_PAYABLE,
            lineItems,
            dueDate,
            coverageMonths,
            coverageEndsAt,
            extendFromPriorCoverage,
            periodStart: null,
            periodEnd: null
          },
          select: { id: true }
        });

        const description = [
          `EventFlow ENTERPRISE invoice for ${org.name}`,
          notes ? notes.slice(0, 200) : null,
          `EF:${draft.id}`
        ]
          .filter(Boolean)
          .join(" — ");

        const taxTotalPesewas =
          vatSplit.nhilAmountPesewas +
          vatSplit.getfundAmountPesewas +
          vatSplit.vatAmountPesewas;
        /**
         * Paystack hosted UI derives the Tax % label from the tax[] payload.
         * Multiple rows collapsed to "2.5%"; omitting tax[] showed "0%".
         * Send ONE combined entry with the 20% label and the summed amount.
         * EventFlow email/PDF still itemize NHIL / GETFund / VAT separately.
         */
        const tax =
          applyVat && taxTotalPesewas > 0
            ? [{ name: "VAT, NHIL & GETFund (20%)", amount: taxTotalPesewas }]
            : undefined;

        const paystackLineItems = lineItems.map((item) => ({
          name: item.description,
          amount: item.amountPesewas,
          quantity: 1
        }));

        let prq;
        try {
          prq = await createPaystackPaymentRequest({
            customerCode: customerCode!,
            dueDate: dueDateIso,
            description,
            lineItems: paystackLineItems,
            tax,
            sendNotification: false,
            metadata: {
              eventflow_invoice_id: draft.id,
              eventflow_org_id: orgId,
              eventflow_purpose: "enterprise_payable"
            }
          });
        } catch (firstError) {
          // Some Paystack accounts reject metadata on paymentrequest — retry bare.
          if (!(firstError instanceof PaystackApiError)) throw firstError;
          prq = await createPaystackPaymentRequest({
            customerCode: customerCode!,
            dueDate: dueDateIso,
            description,
            lineItems: paystackLineItems,
            tax,
            sendNotification: false
          });
        }

        const paymentPageUrl = paystackPaymentRequestPageUrl(prq.request_code);
        const invoice = await prisma.billingInvoice.update({
          where: { id: draft.id },
          data: {
            paystackPaymentRequestCode: prq.request_code,
            paymentPageUrl
          },
          select: { id: true, paymentPageUrl: true }
        });

        const emailPayload = await buildEnterprisePayableEmailPayload(invoice.id);
        if (emailPayload) {
          await sendBillingEnterprisePayableInvoiceEmail(emailPayload);
          await prisma.billingInvoice.update({
            where: { id: invoice.id },
            data: { invoiceEmailSentAt: new Date() }
          });
        }

        return {
          invoiceId: invoice.id,
          paymentPageUrl: invoice.paymentPageUrl!
        };
      }
    });

    const invoiceId =
      typeof audited.extra?.invoiceId === "string" ? audited.extra.invoiceId : "";
    const paymentPageUrl =
      typeof audited.extra?.paymentPageUrl === "string"
        ? audited.extra.paymentPageUrl
        : "";
    if (!invoiceId || !paymentPageUrl) {
      return { success: false, error: "Invoice created but response incomplete." };
    }

    return {
      success: true,
      data: { ...audited, invoiceId, paymentPageUrl }
    };
  } catch (error) {
    const message =
      error instanceof PaystackApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unable to create Enterprise payable invoice.";
    return { success: false, error: message };
  }
}

const enterpriseInvoiceIdSchema = z.object({
  orgId: orgIdSchema,
  invoiceId: z.string().trim().min(1),
  reason: reasonSchema
});

export async function resendEnterprisePayableInvoiceAction(
  input: z.input<typeof enterpriseInvoiceIdSchema>
): Promise<ActionResult<AuditBundle & { invoiceId: string }>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = enterpriseInvoiceIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, invoiceId, reason } = parsed.data;
  const invoice = await prisma.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      orgId,
      source: BillingInvoiceSource.ENTERPRISE_PAYABLE
    },
    select: { id: true, status: true, paymentPageUrl: true }
  });
  if (!invoice) return { success: false, error: "Enterprise invoice not found." };
  if (invoice.status !== BillingInvoiceStatus.PENDING) {
    return { success: false, error: "Only pending invoices can be resent." };
  }
  if (!invoice.paymentPageUrl) {
    return { success: false, error: "Invoice has no Paystack payment link." };
  }

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "resend_enterprise_payable_invoice",
      reason,
      metadata: { invoiceId },
      mutate: async () => {
        const emailPayload = await buildEnterprisePayableEmailPayload(invoiceId);
        if (!emailPayload) {
          throw new Error("Unable to resolve invoice email recipient.");
        }
        await sendBillingEnterprisePayableInvoiceEmail(emailPayload);
        await prisma.billingInvoice.update({
          where: { id: invoiceId },
          data: { invoiceEmailSentAt: new Date() }
        });
        return { invoiceId };
      }
    });
    return { success: true, data: { ...audited, invoiceId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to resend invoice."
    };
  }
}

export async function cancelEnterprisePayableInvoiceAction(
  input: z.input<typeof enterpriseInvoiceIdSchema>
): Promise<ActionResult<AuditBundle & { invoiceId: string }>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = enterpriseInvoiceIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { orgId, invoiceId, reason } = parsed.data;
  const invoice = await prisma.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      orgId,
      source: BillingInvoiceSource.ENTERPRISE_PAYABLE
    },
    select: {
      id: true,
      status: true,
      paystackPaymentRequestCode: true
    }
  });
  if (!invoice) return { success: false, error: "Enterprise invoice not found." };
  if (invoice.status !== BillingInvoiceStatus.PENDING) {
    return { success: false, error: "Only pending invoices can be cancelled." };
  }

  try {
    const audited = await commitAuditedMutation({
      orgId,
      actorUserId: guard.userId,
      action: "cancel_enterprise_payable_invoice",
      reason,
      metadata: { invoiceId, requestCode: invoice.paystackPaymentRequestCode },
      mutate: async () => {
        if (invoice.paystackPaymentRequestCode) {
          try {
            await archivePaystackPaymentRequest(invoice.paystackPaymentRequestCode);
          } catch (error) {
            // Still cancel locally if Paystack archive fails (already archived, etc.)
            console.error("[enterprise-payable] archive failed", error);
          }
        }
        await prisma.billingInvoice.update({
          where: { id: invoiceId },
          data: { status: BillingInvoiceStatus.CANCELLED }
        });
        return { invoiceId };
      }
    });
    return { success: true, data: { ...audited, invoiceId } };
  } catch {
    return { success: false, error: "Unable to cancel Enterprise invoice." };
  }
}
