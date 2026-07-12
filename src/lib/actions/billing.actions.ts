"use server";

import { BillingInvoiceStatus, Role, SubscriptionStatus } from "@prisma/client";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  billingIntervalFromPaystack,
  getPaystackPlanCodeForInterval,
  isPaystackStatusResumable,
  type BillingPlanInterval
} from "@/lib/billing/constants";
import { buildBillingReceiptPdf } from "@/lib/billing/buildBillingReceiptPdf";
import { formatGhsFromPesewas } from "@/lib/billing/formatMoney";
import { getPlatformBillingAlertSettings } from "@/lib/billing/platformSettings";
import {
  assertReceiptSellerReadyForProduction,
  buildBillingReceiptData
} from "@/lib/billing/receiptData";
import {
  createPaystackCustomer,
  createPaystackSubscription,
  disablePaystackSubscription,
  enablePaystackSubscription,
  fetchPaystackPlan,
  fetchPaystackSubscription,
  initializePaystackTransaction,
  PaystackApiError,
  verifyPaystackTransaction
} from "@/lib/billing/paystackClient";
import { splitInclusiveVatPesewas } from "@/lib/billing/vatSplit";
import { applySubscriptionEntitlements, getOrgBillingAccess } from "@/lib/db/billing";
import { prisma } from "@/lib/prisma";
import { resolvePublicBaseForLinks } from "@/lib/url";
import type { ActionResult } from "@/types";

export type InitiateSubscribeResult = ActionResult<{
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}>;

async function requireOrgAdmin(): Promise<
  | { ok: true; userId: string; orgId: string; email: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id || !session.user.orgId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (session.user.role !== Role.ADMIN) {
    return { ok: false, error: "Only workspace admins can manage billing." };
  }
  const email = session.user.email?.trim().toLowerCase();
  if (!email) return { ok: false, error: "Your account is missing an email address." };
  return { ok: true, userId: session.user.id, orgId: session.user.orgId, email };
}

function revalidateBilling() {
  revalidatePath("/dashboard/settings/billing");
  revalidatePath("/dashboard");
  revalidatePath("/billing/callback");
}

/** Opaque Paystack reference — org id lives in metadata only. */
function newPaystackReference(prefix: string): string {
  return `${prefix}-${randomBytes(12).toString("hex")}`;
}

async function resolveEmailToken(input: {
  subscriptionCode: string;
  storedToken: string | null;
}): Promise<string | null> {
  if (input.storedToken) return input.storedToken;
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

/**
 * Turn auto-renewal back on without charging now.
 * 1) Try Paystack /subscription/enable when remote status is non-renewing.
 * 2) If enable is refused, create a new subscription with start_date = currentPeriodEnd.
 */
async function reestablishAutoRenewal(input: {
  orgId: string;
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

export type BillingRenewPlanOption = {
  interval: BillingPlanInterval;
  planCode: string;
  amountPesewas: number;
  amountLabel: string;
  intervalLabel: string;
};

/** Plans + saved payment hint for the Renew checkout UI. */
export async function getBillingRenewOptionsAction(): Promise<
  ActionResult<{
    options: BillingRenewPlanOption[];
    defaultInterval: BillingPlanInterval;
    savedCardLast4: string | null;
    billingEmail: string | null;
  }>
> {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const [subscription, customer] = await Promise.all([
    prisma.subscription.findUnique({
      where: { orgId: guard.orgId },
      select: { paystackPlanCode: true, cardLast4: true }
    }),
    prisma.billingCustomer.findUnique({
      where: { orgId: guard.orgId },
      select: { billingEmail: true }
    })
  ]);

  const intervals: BillingPlanInterval[] = ["monthly", "yearly"];
  const options: BillingRenewPlanOption[] = [];

  for (const interval of intervals) {
    const planCode = getPaystackPlanCodeForInterval(interval);
    if (!planCode) continue;
    try {
      const plan = await fetchPaystackPlan(planCode);
      options.push({
        interval,
        planCode,
        amountPesewas: plan.amount,
        amountLabel: formatGhsFromPesewas(plan.amount, plan.currency),
        intervalLabel: interval === "yearly" ? "Yearly" : "Monthly"
      });
    } catch (error) {
      const message = error instanceof PaystackApiError ? error.message : "Unable to load plan.";
      return { success: false, error: message };
    }
  }

  if (options.length === 0) {
    return { success: false, error: "Billing plans are not configured yet. Contact support." };
  }

  let defaultInterval: BillingPlanInterval = "monthly";
  if (subscription?.paystackPlanCode) {
    try {
      const current = await fetchPaystackPlan(subscription.paystackPlanCode);
      defaultInterval = billingIntervalFromPaystack(current.interval);
    } catch {
      const yearlyCode = getPaystackPlanCodeForInterval("yearly");
      if (yearlyCode && subscription.paystackPlanCode === yearlyCode) {
        defaultInterval = "yearly";
      }
    }
  }
  if (!options.some((o) => o.interval === defaultInterval)) {
    defaultInterval = options[0]!.interval;
  }

  return {
    success: true,
    data: {
      options,
      defaultInterval,
      savedCardLast4: subscription?.cardLast4 ?? null,
      billingEmail: customer?.billingEmail ?? guard.email
    }
  };
}

/**
 * Full Paystack checkout for renew / extend / monthly↔yearly switch.
 * Does not silently charge the saved card — user confirms on Paystack and may
 * change method. Same customer email so the saved card is available as default.
 */
export async function initiateRenewCheckoutAction(input: {
  interval: BillingPlanInterval;
}): Promise<InitiateSubscribeResult> {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const interval = input.interval === "yearly" ? "yearly" : "monthly";
  const planCode = getPaystackPlanCodeForInterval(interval);
  if (!planCode) {
    return {
      success: false,
      error:
        interval === "yearly"
          ? "Yearly plan is not configured (PAYSTACK_PRO_YEARLY_PLAN_CODE)."
          : "Monthly plan is not configured (PAYSTACK_PRO_PLAN_CODE)."
    };
  }

  let planAmount: number;
  let planInterval: string;
  try {
    const plan = await fetchPaystackPlan(planCode);
    planAmount = plan.amount;
    planInterval = plan.interval;
  } catch (error) {
    const message = error instanceof PaystackApiError ? error.message : "Unable to load plan pricing.";
    return { success: false, error: message };
  }

  const org = await prisma.organization.findUnique({
    where: { id: guard.orgId },
    select: {
      id: true,
      billingCustomer: true,
      subscription: {
        select: {
          currentPeriodEnd: true,
          cardLast4: true,
          authorizationCode: true
        }
      }
    }
  });
  if (!org) return { success: false, error: "Workspace not found." };

  let customerCode = org.billingCustomer?.paystackCustomerCode ?? null;
  const billingEmail = org.billingCustomer?.billingEmail ?? guard.email;

  if (!customerCode) {
    try {
      const created = await createPaystackCustomer({
        email: billingEmail,
        metadata: { orgId: org.id }
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
        error instanceof PaystackApiError ? error.message : "Unable to create billing customer.";
      return { success: false, error: message };
    }
  }

  const base = resolvePublicBaseForLinks();
  const reference = newPaystackReference("renew");
  const periodEndHint = org.subscription?.currentPeriodEnd?.toISOString() ?? null;

  try {
    /**
     * No `plan` on initialize — user completes full checkout (card / MoMo / etc.).
     * Webhook extends access from currentPeriodEnd and schedules the next cycle.
     */
    const initialized = await initializePaystackTransaction({
      email: billingEmail,
      amountPesewas: planAmount,
      reference,
      callbackUrl: base ? `${base}/billing/callback` : undefined,
      metadata: {
        orgId: org.id,
        customer_code: customerCode,
        purpose: "renew_now",
        planCode,
        planInterval,
        billingInterval: interval,
        extendFromPeriodEnd: true,
        previousPeriodEnd: periodEndHint,
        preferredAuthorization: org.subscription?.authorizationCode ?? null,
        preferredCardLast4: org.subscription?.cardLast4 ?? null
      }
    });

    return {
      success: true,
      data: {
        authorizationUrl: initialized.authorization_url,
        accessCode: initialized.access_code,
        reference: initialized.reference
      }
    };
  } catch (error) {
    const message =
      error instanceof PaystackApiError ? error.message : "Unable to start renew checkout.";
    return { success: false, error: message };
  }
}

/**
 * Authorization-first PRO subscribe / trial conversion (checkout redirect).
 */
export async function initiateSubscribeAction(input?: {
  interval?: BillingPlanInterval;
}): Promise<InitiateSubscribeResult> {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const interval: BillingPlanInterval =
    input?.interval === "yearly" ? "yearly" : "monthly";
  const planCode = getPaystackPlanCodeForInterval(interval);
  if (!planCode) {
    return {
      success: false,
      error:
        interval === "yearly"
          ? "Yearly plan is not configured (PAYSTACK_PRO_YEARLY_PLAN_CODE)."
          : "Monthly plan is not configured (PAYSTACK_PRO_PLAN_CODE)."
    };
  }

  const access = await getOrgBillingAccess(guard.orgId);
  if (!access) return { success: false, error: "Workspace not found." };

  const subscription = await prisma.subscription.findUnique({
    where: { orgId: guard.orgId },
    select: {
      status: true,
      cancelAtPeriodEnd: true,
      paystackStatus: true,
      authorizationCode: true,
      currentPeriodEnd: true
    }
  });

  const now = new Date();
  const stillInPaidPeriod = Boolean(
    subscription?.currentPeriodEnd && subscription.currentPeriodEnd.getTime() > now.getTime()
  );

  if (
    subscription?.status === SubscriptionStatus.ACTIVE &&
    !subscription.cancelAtPeriodEnd &&
    (subscription.paystackStatus ?? "active").toLowerCase() === "active"
  ) {
    return { success: false, error: "This workspace already has an active subscription." };
  }

  if (
    stillInPaidPeriod &&
    subscription?.authorizationCode &&
    subscription.status !== SubscriptionStatus.PAST_DUE
  ) {
    return {
      success: false,
      error:
        subscription.cancelAtPeriodEnd
          ? "Turn auto-renewal back on to resume billing at period end — no checkout needed."
          : "You already have a payment method on file. Use Renew now to prepay or switch plan, or manage auto-renewal below."
    };
  }

  let planAmount: number;
  let planInterval: string;
  try {
    const plan = await fetchPaystackPlan(planCode);
    planAmount = plan.amount;
    planInterval = plan.interval;
  } catch (error) {
    const message = error instanceof PaystackApiError ? error.message : "Unable to load plan pricing.";
    return { success: false, error: message };
  }

  const org = await prisma.organization.findUnique({
    where: { id: guard.orgId },
    select: { id: true, name: true, billingCustomer: true }
  });
  if (!org) return { success: false, error: "Workspace not found." };

  let customerCode = org.billingCustomer?.paystackCustomerCode ?? null;
  if (!customerCode) {
    try {
      const created = await createPaystackCustomer({
        email: guard.email,
        metadata: { orgId: org.id }
      });
      customerCode = created.customer_code;
      await prisma.billingCustomer.upsert({
        where: { orgId: org.id },
        create: {
          orgId: org.id,
          paystackCustomerCode: customerCode,
          billingEmail: guard.email
        },
        update: {
          paystackCustomerCode: customerCode,
          billingEmail: guard.email
        }
      });
    } catch (error) {
      const message =
        error instanceof PaystackApiError ? error.message : "Unable to create billing customer.";
      return { success: false, error: message };
    }
  }

  const base = resolvePublicBaseForLinks();
  const reference = newPaystackReference("ef");

  try {
    /**
     * No `plan` on initialize — same as renew: full checkout (card / MoMo /
     * bank / USSD). Webhook activates PRO and schedules the Paystack
     * subscription from metadata.planCode.
     */
    const initialized = await initializePaystackTransaction({
      email: guard.email,
      amountPesewas: planAmount,
      reference,
      callbackUrl: base ? `${base}/billing/callback` : undefined,
      metadata: {
        orgId: org.id,
        customer_code: customerCode,
        purpose: "subscribe",
        planCode,
        planInterval,
        billingInterval: interval
      }
    });

    return {
      success: true,
      data: {
        authorizationUrl: initialized.authorization_url,
        accessCode: initialized.access_code,
        reference: initialized.reference
      }
    };
  } catch (error) {
    const message =
      error instanceof PaystackApiError ? error.message : "Unable to start checkout.";
    return { success: false, error: message };
  }
}

/** Auto-renewal Off — Paystack disable; access until currentPeriodEnd. */
export async function setAutoRenewalOffAction(): Promise<
  ActionResult<{ cancelAtPeriodEnd: true; paystackStatus: string }>
> {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const subscription = await prisma.subscription.findUnique({
    where: { orgId: guard.orgId },
    select: {
      status: true,
      cancelAtPeriodEnd: true,
      paystackSubscriptionCode: true,
      emailToken: true,
      paystackStatus: true
    }
  });

  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return { success: false, error: "No active subscription to update." };
  }
  if (subscription.cancelAtPeriodEnd) {
    return {
      success: true,
      data: {
        cancelAtPeriodEnd: true,
        paystackStatus: subscription.paystackStatus ?? "non-renewing"
      }
    };
  }
  if (!subscription.paystackSubscriptionCode) {
    return { success: false, error: "Missing Paystack subscription. Contact support." };
  }

  const emailToken = await resolveEmailToken({
    subscriptionCode: subscription.paystackSubscriptionCode,
    storedToken: subscription.emailToken
  });
  if (!emailToken) {
    return {
      success: false,
      error: "Unable to update auto-renewal with Paystack (missing email token). Contact support."
    };
  }

  try {
    await disablePaystackSubscription({
      subscriptionCode: subscription.paystackSubscriptionCode,
      emailToken
    });
  } catch (error) {
    const message =
      error instanceof PaystackApiError ? error.message : "Unable to turn off auto-renewal.";
    return { success: false, error: message };
  }

  let paystackStatus = "non-renewing";
  try {
    const remote = await fetchPaystackSubscription(subscription.paystackSubscriptionCode);
    if (remote.status) paystackStatus = remote.status;
  } catch {
    /* keep default */
  }

  await prisma.subscription.update({
    where: { orgId: guard.orgId },
    data: {
      cancelAtPeriodEnd: true,
      emailToken,
      paystackStatus,
      status: SubscriptionStatus.ACTIVE
    }
  });

  revalidateBilling();
  return { success: true, data: { cancelAtPeriodEnd: true, paystackStatus } };
}

/** Auto-renewal On — silent re-establish (enable or create+start_date). No charge now. */
export async function setAutoRenewalOnAction(): Promise<
  ActionResult<{ cancelAtPeriodEnd: false; method: "enable" | "create" }>
> {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const now = new Date();
  const [subscription, customer] = await Promise.all([
    prisma.subscription.findUnique({
      where: { orgId: guard.orgId },
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
      where: { orgId: guard.orgId },
      select: { paystackCustomerCode: true, billingEmail: true }
    })
  ]);

  if (!subscription?.cancelAtPeriodEnd) {
    return { success: false, error: "Auto-renewal is already on." };
  }
  if (!subscription.authorizationCode) {
    return {
      success: false,
      error: "No payment method on file. Subscribe via checkout to add one."
    };
  }
  if (!subscription.currentPeriodEnd || subscription.currentPeriodEnd.getTime() <= now.getTime()) {
    return {
      success: false,
      error: "This period has ended. Use Renew now to pay and restore access."
    };
  }
  if (!customer?.paystackCustomerCode) {
    return { success: false, error: "Missing Paystack customer. Contact support." };
  }

  const planCode = await resolvePlanCode(subscription.paystackPlanCode);
  if (!planCode) {
    return { success: false, error: "Billing is not configured yet. Contact support." };
  }

  try {
    const restored = await reestablishAutoRenewal({
      orgId: guard.orgId,
      customerCode: customer.paystackCustomerCode,
      planCode,
      authorizationCode: subscription.authorizationCode,
      currentPeriodEnd: subscription.currentPeriodEnd,
      paystackSubscriptionCode: subscription.paystackSubscriptionCode,
      emailToken: subscription.emailToken,
      paystackStatus: subscription.paystackStatus
    });

    await prisma.subscription.update({
      where: { orgId: guard.orgId },
      data: {
        cancelAtPeriodEnd: false,
        paystackSubscriptionCode: restored.subscriptionCode,
        emailToken: restored.emailToken,
        paystackStatus: restored.paystackStatus,
        paystackPlanCode: planCode,
        status: SubscriptionStatus.ACTIVE
      }
    });
    await applySubscriptionEntitlements({
      orgId: guard.orgId,
      status: SubscriptionStatus.ACTIVE
    });

    revalidateBilling();
    return { success: true, data: { cancelAtPeriodEnd: false, method: restored.method } };
  } catch (error) {
    const message =
      error instanceof PaystackApiError ? error.message : "Unable to turn on auto-renewal.";
    return { success: false, error: message };
  }
}

/**
 * Poll after Paystack checkout redirect — when a reference is present, wait for
 * that invoice (so renew while already ACTIVE does not false-positive).
 */
export async function getBillingCheckoutStatusAction(input?: {
  reference?: string | null;
}): Promise<
  ActionResult<{
    phase: "pending" | "active" | "failed";
    status: SubscriptionStatus;
    message: string;
  }>
> {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const access = await getOrgBillingAccess(guard.orgId);
  if (!access) return { success: false, error: "Workspace not found." };

  const reference = input?.reference?.trim();

  if (reference) {
    const invoice = await prisma.billingInvoice.findUnique({
      where: { paystackInvoiceCode: reference },
      select: { status: true }
    });
    if (invoice?.status === "PAID") {
      return {
        success: true,
        data: {
          phase: "active",
          status: SubscriptionStatus.ACTIVE,
          message: "Your subscription is active!"
        }
      };
    }

    try {
      const verified = await verifyPaystackTransaction(reference);
      const remoteStatus = verified.status.toLowerCase();
      if (remoteStatus === "success") {
        return {
          success: true,
          data: {
            phase: "pending",
            status: access.status,
            message: "Payment confirmed — activating your subscription…"
          }
        };
      }
      if (
        remoteStatus === "failed" ||
        remoteStatus === "abandoned" ||
        remoteStatus === "reversed"
      ) {
        return {
          success: true,
          data: {
            phase: "failed",
            status: access.status,
            message:
              verified.gateway_response?.trim() ||
              `Payment ${remoteStatus}. Return to Billing to try again.`
          }
        };
      }
    } catch {
      /* verify may 404 briefly — keep pending */
    }

    return {
      success: true,
      data: {
        phase: "pending",
        status: access.status,
        message: "Confirming your payment with Paystack…"
      }
    };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { orgId: guard.orgId },
    select: {
      status: true,
      authorizationCode: true,
      paystackSubscriptionCode: true,
      cancelAtPeriodEnd: true
    }
  });

  const activated =
    subscription?.status === SubscriptionStatus.ACTIVE &&
    Boolean(subscription.authorizationCode || subscription.paystackSubscriptionCode) &&
    !subscription.cancelAtPeriodEnd;

  if (activated || (access.status === SubscriptionStatus.ACTIVE && access.isPaying)) {
    return {
      success: true,
      data: {
        phase: "active",
        status: SubscriptionStatus.ACTIVE,
        message: "Your subscription is active!"
      }
    };
  }

  return {
    success: true,
    data: {
      phase: "pending",
      status: access.status,
      message: "Confirming your payment with Paystack…"
    }
  };
}

/** @deprecated Prefer setAutoRenewalOffAction */
export async function cancelSubscriptionAtPeriodEndAction() {
  return setAutoRenewalOffAction();
}

/** @deprecated Prefer setAutoRenewalOnAction */
export async function resumeSubscriptionAction() {
  return setAutoRenewalOnAction();
}

const billingDetailsSchema = z.object({
  billingLegalName: z.string().trim().max(200).optional().nullable(),
  billingAddressLine1: z.string().trim().max(200).optional().nullable(),
  billingAddressLine2: z.string().trim().max(200).optional().nullable(),
  billingCity: z.string().trim().max(100).optional().nullable(),
  billingRegion: z.string().trim().max(100).optional().nullable(),
  billingPostalCode: z.string().trim().max(20).optional().nullable(),
  billingCountry: z.string().trim().max(100).optional().nullable()
});

function emptyToNull(value: string | null | undefined): string | null {
  const t = value?.trim() ?? "";
  return t.length > 0 ? t : null;
}

export async function updateOrgBillingDetailsAction(
  input: z.input<typeof billingDetailsSchema>
): Promise<ActionResult<{ saved: true }>> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const parsed = billingDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join("; ")
    };
  }

  try {
    await prisma.organization.update({
      where: { id: gate.orgId },
      data: {
        billingLegalName: emptyToNull(parsed.data.billingLegalName),
        billingAddressLine1: emptyToNull(parsed.data.billingAddressLine1),
        billingAddressLine2: emptyToNull(parsed.data.billingAddressLine2),
        billingCity: emptyToNull(parsed.data.billingCity),
        billingRegion: emptyToNull(parsed.data.billingRegion),
        billingPostalCode: emptyToNull(parsed.data.billingPostalCode),
        billingCountry: emptyToNull(parsed.data.billingCountry)
      }
    });
    revalidatePath("/dashboard/settings/billing");
    return { success: true, data: { saved: true } };
  } catch {
    return { success: false, error: "Could not save billing details." };
  }
}

export async function downloadBillingReceiptPdfAction(
  invoiceId: string
): Promise<ActionResult<{ pdfBase64: string; filename: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in." };
  }

  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          plan: true,
          billingLegalName: true,
          billingAddressLine1: true,
          billingAddressLine2: true,
          billingCity: true,
          billingRegion: true,
          billingPostalCode: true,
          billingCountry: true,
          billingCustomer: { select: { billingEmail: true } }
        }
      }
    }
  });
  if (!invoice) return { success: false, error: "Invoice not found." };

  const isOwner = Boolean(session.user.isPlatformOwner);
  const isOrgAdmin =
    session.user.role === Role.ADMIN && session.user.orgId === invoice.orgId;
  if (!isOwner && !isOrgAdmin) {
    return { success: false, error: "Unauthorized" };
  }

  if (invoice.status !== BillingInvoiceStatus.PAID) {
    return { success: false, error: "Receipts are available for paid invoices only." };
  }

  const ready = assertReceiptSellerReadyForProduction();
  if (!ready.ok) return { success: false, error: ready.error };

  // Backfill VAT split if an older row somehow missed migration defaults.
  let invoiceForReceipt = invoice;
  if (
    invoice.amountPesewas > 0 &&
    invoice.baseAmountPesewas === 0 &&
    invoice.vatAmountPesewas === 0
  ) {
    const vat = splitInclusiveVatPesewas(invoice.amountPesewas);
    invoiceForReceipt = await prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: vat,
      include: {
        org: {
          select: {
            id: true,
            name: true,
            plan: true,
            billingLegalName: true,
            billingAddressLine1: true,
            billingAddressLine2: true,
            billingCity: true,
            billingRegion: true,
            billingPostalCode: true,
            billingCountry: true,
            billingCustomer: { select: { billingEmail: true } }
          }
        }
      }
    });
  }

  const { supportEmail } = await getPlatformBillingAlertSettings();
  const receipt = buildBillingReceiptData({
    invoice: invoiceForReceipt,
    org: invoiceForReceipt.org,
    supportEmail
  });
  const pdfBytes = buildBillingReceiptPdf(receipt);
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
  const safeRef = receipt.receiptNumber.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40);
  return {
    success: true,
    data: {
      pdfBase64,
      filename: `eventflow-receipt-${safeRef || invoice.id.slice(-8)}.pdf`
    }
  };
}
