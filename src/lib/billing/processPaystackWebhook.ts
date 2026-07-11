import { getDunningRetryDueAt, PAST_DUE_GRACE_MS } from "@/lib/billing/constants";
import { applyEnterprisePayableCoverage } from "@/lib/billing/applyEnterprisePayableCoverage";
import {
  findEnterprisePayableInvoiceForCharge,
  markEnterprisePayableInvoicePaid
} from "@/lib/billing/enterprisePayableIdempotency";
import { computeRenewPeriodWindow } from "@/lib/billing/scheduleRenewSubscription";
import {
  maybeSendBillingReceiptByPaystackCode,
  maybeSendBillingReceiptEmail
} from "@/lib/billing/sendBillingReceipt";
import { splitInclusiveVatPesewas } from "@/lib/billing/vatSplit";
import { applySubscriptionEntitlements, ensureSubscriptionRow } from "@/lib/db/billing";
import { sendBillingCardExpiringEmail } from "@/lib/email/billingEmails";
import { prisma } from "@/lib/prisma";
import { resolvePublicBaseForLinks } from "@/lib/url";
import { BillingInvoiceStatus, OrgPlan, Prisma, SubscriptionStatus } from "@prisma/client";

import {
  buildPaystackEventId,
  resolveOrgIdFromPaystackPayload
} from "./parsePaystackOrgId";
import { schedulePaystackSubscriptionAfterRenew } from "./scheduleRenewSubscription";

export type PaystackWebhookEnvelope = {
  event: string;
  data?: Record<string, unknown>;
};

/** Events that must resolve an org to apply billing state — unresolved org is alerted. */
export const PAYSTACK_ORG_REQUIRED_EVENTS = new Set([
  "charge.success",
  "charge.failed",
  "subscription.create",
  "subscription.disable",
  "subscription.not_renew",
  "subscription.expiring_cards",
  "invoice.create",
  "invoice.update",
  "invoice.payment_failed",
  "paymentrequest.success"
]);

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  const text = asString(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function nextDunningAtFromAttempt(pastDueSince: Date, retryIndex: number): Date | null {
  return getDunningRetryDueAt(pastDueSince, retryIndex);
}

async function upsertBillingInvoice(
  tx: Prisma.TransactionClient,
  input: {
    orgId: string;
    subscriptionId?: string | null;
    paystackInvoiceCode?: string | null;
    amountPesewas: number;
    currency?: string | null;
    status: BillingInvoiceStatus;
    paidAt?: Date | null;
    periodStart?: Date | null;
    periodEnd?: Date | null;
  }
) {
  const paystackInvoiceCode = input.paystackInvoiceCode ?? undefined;
  if (!paystackInvoiceCode) return null;

  const vat = splitInclusiveVatPesewas(input.amountPesewas);

  return tx.billingInvoice.upsert({
    where: { paystackInvoiceCode },
    create: {
      orgId: input.orgId,
      subscriptionId: input.subscriptionId ?? null,
      paystackInvoiceCode,
      amountPesewas: input.amountPesewas,
      ...vat,
      currency: input.currency ?? "GHS",
      status: input.status,
      paidAt: input.paidAt ?? null,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null
    },
    update: {
      subscriptionId: input.subscriptionId ?? null,
      amountPesewas: input.amountPesewas,
      ...vat,
      currency: input.currency ?? "GHS",
      status: input.status,
      paidAt: input.paidAt ?? null,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null
    }
  });
}

async function syncSubscriptionFromPaystackData(
  tx: Prisma.TransactionClient,
  orgId: string,
  data: Record<string, unknown>,
  statusOverride?: SubscriptionStatus
) {
  const planObject =
    data.plan && typeof data.plan === "object"
      ? (data.plan as Record<string, unknown>)
      : null;
  const customerObject =
    data.customer && typeof data.customer === "object"
      ? (data.customer as Record<string, unknown>)
      : null;
  const authorizationObject =
    data.authorization && typeof data.authorization === "object"
      ? (data.authorization as Record<string, unknown>)
      : null;

  const subscriptionCode =
    asString(data.subscription_code) ?? asString(data.code);
  const planCode =
    asString(planObject?.plan_code) ?? asString(data.plan_code);
  const authorizationCode = asString(authorizationObject?.authorization_code);
  const customerCode = asString(customerObject?.customer_code);
  const currency = asString(data.currency) ?? asString(planObject?.currency) ?? "GHS";
  const emailToken = asString(data.email_token) ?? asString(data.emailToken);
  const cardLast4 = asString(authorizationObject?.last4);
  const cardExpMonth = asNumber(authorizationObject?.exp_month);
  const cardExpYear = asNumber(authorizationObject?.exp_year);
  const paystackStatus = asString(data.status);

  await ensureSubscriptionRow(orgId, tx);

  const updateData: Prisma.SubscriptionUpdateInput = {
    paystackSubscriptionCode: subscriptionCode ?? undefined,
    paystackPlanCode: planCode ?? undefined,
    authorizationCode: authorizationCode ?? undefined,
    emailToken: emailToken ?? undefined,
    paystackStatus: paystackStatus ?? undefined,
    currency
  };

  if (cardLast4) updateData.cardLast4 = cardLast4;
  if (cardExpMonth !== null) updateData.cardExpMonth = cardExpMonth;
  if (cardExpYear !== null) updateData.cardExpYear = cardExpYear;
  if (authorizationCode) {
    updateData.cardExpiringNotifiedAt = null;
  }

  if (statusOverride) {
    updateData.status = statusOverride;
    if (statusOverride === SubscriptionStatus.ACTIVE) {
      updateData.cancelAtPeriodEnd = false;
      updateData.pastDueSince = null;
      updateData.dunningAttempt = 0;
      updateData.nextDunningAt = null;
      updateData.suspendedAt = null;
    }
  }

  const nextPayment = parseDate(data.next_payment_date);
  if (nextPayment) {
    updateData.currentPeriodEnd = nextPayment;
  }

  const subscription = await tx.subscription.update({
    where: { orgId },
    data: updateData
  });

  if (customerCode) {
    const billingEmail =
      asString(customerObject?.email) ?? asString(data.customer_email) ?? asString(data.email);
    if (billingEmail) {
      await tx.billingCustomer.upsert({
        where: { orgId },
        create: {
          orgId,
          paystackCustomerCode: customerCode,
          billingEmail
        },
        update: {
          paystackCustomerCode: customerCode,
          billingEmail
        }
      });
    }
  }

  if (statusOverride) {
    await applySubscriptionEntitlements({ orgId, status: statusOverride }, tx);
  }

  return subscription;
}

async function dispatchPaystackEvent(
  tx: Prisma.TransactionClient,
  envelope: PaystackWebhookEnvelope,
  orgId: string | null
) {
  const data = envelope.data ?? {};
  const resolvedOrgId = orgId ?? (await resolveOrgIdFromPaystackPayload(data));
  if (!resolvedOrgId) {
    return {
      handled: false as const,
      orgUnresolved: PAYSTACK_ORG_REQUIRED_EVENTS.has(envelope.event)
    };
  }

  switch (envelope.event) {
    case "charge.success": {
      const metadata =
        data.metadata && typeof data.metadata === "object"
          ? (data.metadata as Record<string, unknown>)
          : {};
      const purpose = asString(metadata.purpose) ?? asString(metadata.eventflow_purpose);
      const planObject =
        data.plan_object && typeof data.plan_object === "object"
          ? (data.plan_object as Record<string, unknown>)
          : null;
      const status =
        purpose === "renew_now" ||
        asString(planObject?.plan_code) ||
        asString(data.plan) ||
        asString(metadata.planCode)
          ? SubscriptionStatus.ACTIVE
          : undefined;

      const existingBefore = await tx.subscription.findUnique({
        where: { orgId: resolvedOrgId },
        select: {
          id: true,
          currentPeriodEnd: true,
          paystackSubscriptionCode: true,
          emailToken: true,
          authorizationCode: true
        }
      });

      const amount = asNumber(data.amount);
      const reference = asString(data.reference) ?? asString(data.id);

      /**
       * Enterprise Payment Request dual-webhook guard:
       * If this charge is paying an ENTERPRISE_PAYABLE invoice, mark that row
       * PAID and skip upsertBillingInvoice (avoids a second PAYSTACK row).
       */
      const enterpriseMatch = await findEnterprisePayableInvoiceForCharge(tx, {
        orgId: resolvedOrgId,
        amountPesewas: amount,
        chargeReference: reference,
        data
      });
      if (enterpriseMatch) {
        const paidAt = parseDate(data.paid_at) ?? new Date();
        const paid = await markEnterprisePayableInvoicePaid(tx, {
          invoiceId: enterpriseMatch.id,
          chargeReference: reference,
          paidAt
        });
        const invoiceId = paid?.invoiceId ?? enterpriseMatch.id;
        await applyEnterprisePayableCoverage(tx, invoiceId);
        return {
          handled: true as const,
          orgId: resolvedOrgId,
          receiptInvoiceId: invoiceId
        };
      }

      /** ENTERPRISE orgs are invoice-billed — never mirror a stray charge as a PRO invoice. */
      const orgPlan = await tx.organization.findUnique({
        where: { id: resolvedOrgId },
        select: { plan: true }
      });
      if (orgPlan?.plan === OrgPlan.ENTERPRISE && purpose !== "renew_now") {
        return { handled: true as const, orgId: resolvedOrgId };
      }

      const subscription = await syncSubscriptionFromPaystackData(
        tx,
        resolvedOrgId,
        data,
        status
      );

      let renewSchedule: {
        orgId: string;
        planCode: string;
        periodEnd: Date;
        authorizationCode: string;
        customerCode: string;
        previousSubscriptionCode: string | null;
        previousEmailToken: string | null;
      } | null = null;

      if (purpose === "renew_now") {
        const planCode =
          asString(metadata.planCode) ??
          asString(planObject?.plan_code) ??
          asString(data.plan);
        const planInterval =
          asString(metadata.planInterval) ??
          asString(planObject?.interval) ??
          "monthly";
        const { periodStart, periodEnd } = computeRenewPeriodWindow({
          currentPeriodEnd: existingBefore?.currentPeriodEnd ?? null,
          planInterval
        });

        const authObject =
          data.authorization && typeof data.authorization === "object"
            ? (data.authorization as Record<string, unknown>)
            : null;
        const authorizationCode =
          asString(authObject?.authorization_code) ??
          existingBefore?.authorizationCode ??
          null;
        const customerObject =
          data.customer && typeof data.customer === "object"
            ? (data.customer as Record<string, unknown>)
            : null;
        const customerCode =
          asString(customerObject?.customer_code) ??
          asString(metadata.customer_code);

        await tx.subscription.update({
          where: { orgId: resolvedOrgId },
          data: {
            status: SubscriptionStatus.ACTIVE,
            cancelAtPeriodEnd: false,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            paystackPlanCode: planCode ?? undefined,
            pastDueSince: null,
            dunningAttempt: 0,
            nextDunningAt: null,
            suspendedAt: null
          }
        });
        await applySubscriptionEntitlements(
          { orgId: resolvedOrgId, status: SubscriptionStatus.ACTIVE },
          tx
        );

        if (amount !== null && reference) {
          await upsertBillingInvoice(tx, {
            orgId: resolvedOrgId,
            subscriptionId: subscription.id,
            paystackInvoiceCode: reference,
            amountPesewas: amount,
            currency: asString(data.currency),
            status: BillingInvoiceStatus.PAID,
            paidAt: parseDate(data.paid_at) ?? new Date(),
            periodStart,
            periodEnd
          });
        }

        if (planCode && authorizationCode && customerCode) {
          renewSchedule = {
            orgId: resolvedOrgId,
            planCode,
            periodEnd,
            authorizationCode,
            customerCode,
            previousSubscriptionCode: existingBefore?.paystackSubscriptionCode ?? null,
            previousEmailToken: existingBefore?.emailToken ?? null
          };
        }

        return {
          handled: true as const,
          orgId: resolvedOrgId,
          renewSchedule,
          receiptPaystackCode: amount !== null && reference ? reference : null
        };
      }

      if (amount !== null && reference) {
        await upsertBillingInvoice(tx, {
          orgId: resolvedOrgId,
          subscriptionId: subscription.id,
          paystackInvoiceCode: reference,
          amountPesewas: amount,
          currency: asString(data.currency),
          status: BillingInvoiceStatus.PAID,
          paidAt: parseDate(data.paid_at) ?? new Date()
        });
      }
      return {
        handled: true as const,
        orgId: resolvedOrgId,
        receiptPaystackCode: amount !== null && reference ? reference : null
      };
    }
    case "charge.failed":
      return { handled: true as const, orgId: resolvedOrgId };
    case "subscription.create": {
      const createOrg = await tx.organization.findUnique({
        where: { id: resolvedOrgId },
        select: { plan: true }
      });
      /** ENTERPRISE is invoice-billed — never re-attach a Paystack PRO subscription. */
      if (createOrg?.plan === OrgPlan.ENTERPRISE) {
        return { handled: true as const, orgId: resolvedOrgId };
      }
      await syncSubscriptionFromPaystackData(tx, resolvedOrgId, data, SubscriptionStatus.ACTIVE);
      return { handled: true as const, orgId: resolvedOrgId };
    }
    case "subscription.disable": {
      await ensureSubscriptionRow(resolvedOrgId, tx);
      const disabledCode = asString(data.subscription_code) ?? asString(data.code);
      const current = await tx.subscription.findUnique({
        where: { orgId: resolvedOrgId },
        select: { paystackSubscriptionCode: true, currentPeriodEnd: true }
      });
      /**
       * Ignore disable for an old Paystack sub after we replaced it (re-enable /
       * renew-now create a new subscription_code), or after ENTERPRISE upgrade
       * cleared the local code (disable webhook must not resurrect it).
       */
      if (
        !current?.paystackSubscriptionCode ||
        (disabledCode &&
          current.paystackSubscriptionCode &&
          disabledCode !== current.paystackSubscriptionCode)
      ) {
        return { handled: true as const, orgId: resolvedOrgId };
      }

      const stillInPeriod = Boolean(
        current?.currentPeriodEnd && current.currentPeriodEnd.getTime() > Date.now()
      );
      await tx.subscription.update({
        where: { orgId: resolvedOrgId },
        data: {
          /**
           * Terminal disable at period end → CANCELLED.
           * Mid-period disable (auto-renewal off) keeps ACTIVE + cancelAtPeriodEnd.
           */
          status: stillInPeriod ? SubscriptionStatus.ACTIVE : SubscriptionStatus.CANCELLED,
          cancelAtPeriodEnd: true,
          paystackStatus: asString(data.status) ?? "cancelled"
        }
      });
      if (!stillInPeriod) {
        await applySubscriptionEntitlements(
          { orgId: resolvedOrgId, status: SubscriptionStatus.CANCELLED },
          tx
        );
      }
      return { handled: true as const, orgId: resolvedOrgId };
    }
    case "subscription.not_renew": {
      await ensureSubscriptionRow(resolvedOrgId, tx);
      const notRenewCode = asString(data.subscription_code) ?? asString(data.code);
      const current = await tx.subscription.findUnique({
        where: { orgId: resolvedOrgId },
        select: { paystackSubscriptionCode: true }
      });
      /**
       * If local code is already cleared (ENTERPRISE upgrade / detach), do not
       * re-write paystackSubscriptionCode from this webhook.
       */
      if (!current?.paystackSubscriptionCode) {
        return { handled: true as const, orgId: resolvedOrgId };
      }
      if (notRenewCode && notRenewCode !== current.paystackSubscriptionCode) {
        return { handled: true as const, orgId: resolvedOrgId };
      }
      await tx.subscription.update({
        where: { orgId: resolvedOrgId },
        data: {
          cancelAtPeriodEnd: true,
          /** Keep local ACTIVE — access continues until period end; Paystack is non-renewing. */
          status: SubscriptionStatus.ACTIVE,
          paystackStatus: asString(data.status) ?? "non-renewing",
          emailToken: asString(data.email_token) ?? undefined
        }
      });
      return { handled: true as const, orgId: resolvedOrgId };
    }
    case "subscription.expiring_cards": {
      await ensureSubscriptionRow(resolvedOrgId, tx);
      const auth =
        data.authorization && typeof data.authorization === "object"
          ? (data.authorization as Record<string, unknown>)
          : null;
      await tx.subscription.update({
        where: { orgId: resolvedOrgId },
        data: {
          cardExpiringNotifiedAt: new Date(),
          cardLast4: asString(auth?.last4) ?? undefined,
          cardExpMonth: asNumber(auth?.exp_month) ?? undefined,
          cardExpYear: asNumber(auth?.exp_year) ?? undefined
        }
      });
      return { handled: true as const, orgId: resolvedOrgId };
    }
    case "invoice.create":
    case "invoice.update": {
      const subscription = await tx.subscription.findUnique({
        where: { orgId: resolvedOrgId },
        select: { id: true }
      });
      const amount = asNumber(data.amount) ?? 0;
      const paidAt = parseDate(data.paid_at);
      const statusText = asString(data.status)?.toLowerCase();
      const status =
        statusText === "success" || statusText === "paid"
          ? BillingInvoiceStatus.PAID
          : statusText === "failed"
            ? BillingInvoiceStatus.FAILED
            : BillingInvoiceStatus.PENDING;

      const paystackInvoiceCode =
        asString(data.invoice_code) ?? asString(data.reference);
      await upsertBillingInvoice(tx, {
        orgId: resolvedOrgId,
        subscriptionId: subscription?.id ?? null,
        paystackInvoiceCode,
        amountPesewas: amount,
        currency: asString(data.currency),
        status,
        paidAt,
        periodStart: parseDate(data.period_start),
        periodEnd: parseDate(data.period_end)
      });
      return {
        handled: true as const,
        orgId: resolvedOrgId,
        receiptPaystackCode:
          status === BillingInvoiceStatus.PAID ? paystackInvoiceCode : null
      };
    }
    case "invoice.payment_failed": {
      const now = new Date();
      await ensureSubscriptionRow(resolvedOrgId, tx);
      await tx.subscription.update({
        where: { orgId: resolvedOrgId },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          pastDueSince: now,
          dunningAttempt: 0,
          nextDunningAt: nextDunningAtFromAttempt(now, 0)
        }
      });
      await applySubscriptionEntitlements(
        { orgId: resolvedOrgId, status: SubscriptionStatus.PAST_DUE },
        tx
      );
      return { handled: true as const, orgId: resolvedOrgId };
    }
    case "paymentrequest.success": {
      const requestCode = asString(data.request_code);
      if (!requestCode) {
        return { handled: true as const, orgId: resolvedOrgId };
      }
      const paid = await markEnterprisePayableInvoicePaid(tx, {
        paystackPaymentRequestCode: requestCode,
        chargeReference: asString(data.reference),
        paidAt: parseDate(data.paid_at) ?? new Date()
      });
      if (paid?.invoiceId) {
        await applyEnterprisePayableCoverage(tx, paid.invoiceId);
      }
      return {
        handled: true as const,
        orgId: resolvedOrgId,
        receiptInvoiceId: paid?.invoiceId ?? null
      };
    }
    case "paymentrequest.pending":
      return { handled: true as const, orgId: resolvedOrgId };
    default:
      return { handled: false as const, orgId: resolvedOrgId };
  }
}

export async function processPaystackWebhook(envelope: PaystackWebhookEnvelope): Promise<{
  loggedEventId: string;
  duplicate: boolean;
  orgId: string | null;
  handled: boolean;
  orgUnresolved: boolean;
}> {
  const data = envelope.data ?? {};
  const paystackEventId = buildPaystackEventId(envelope.event, data);
  const orgId = await resolveOrgIdFromPaystackPayload(data);

  try {
    const created = await prisma.paymentEvent.create({
      data: {
        paystackEventId,
        eventType: envelope.event,
        orgId,
        payload: envelope as Prisma.InputJsonValue
      }
    });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const dispatch = await dispatchPaystackEvent(tx, envelope, orgId);
        const processingError =
          dispatch.orgUnresolved
            ? `org_unresolved: could not map Paystack payload to an organization (${envelope.event})`
            : undefined;

        await tx.paymentEvent.update({
          where: { id: created.id },
          data: {
            processedAt: new Date(),
            orgId: "orgId" in dispatch ? dispatch.orgId ?? orgId : orgId,
            processingError
          }
        });
        return dispatch;
      });

      if (result.orgUnresolved) {
        console.error(
          "[paystack-webhook] org unresolved — billing state not applied",
          JSON.stringify({
            event: envelope.event,
            paystackEventId,
            loggedEventId: created.id
          })
        );
      }

      if (
        "renewSchedule" in result &&
        result.renewSchedule &&
        typeof result.renewSchedule === "object"
      ) {
        await schedulePaystackSubscriptionAfterRenew(result.renewSchedule);
      }

      const resolvedOrgId = "orgId" in result ? result.orgId ?? orgId : orgId;
      if (
        envelope.event === "subscription.expiring_cards" &&
        result.handled &&
        resolvedOrgId
      ) {
        void notifyCardExpiring(resolvedOrgId).catch((err) => {
          console.error("[paystack-webhook] card expiring email failed", err);
        });
      }

      const receiptInvoiceId =
        "receiptInvoiceId" in result && typeof result.receiptInvoiceId === "string"
          ? result.receiptInvoiceId
          : null;
      const receiptCode =
        "receiptPaystackCode" in result && typeof result.receiptPaystackCode === "string"
          ? result.receiptPaystackCode
          : null;
      if (result.handled && (receiptInvoiceId || receiptCode)) {
        try {
          const receiptResult = receiptInvoiceId
            ? await maybeSendBillingReceiptEmail(receiptInvoiceId)
            : await maybeSendBillingReceiptByPaystackCode(receiptCode!);
          if (!receiptResult.sent && receiptResult.reason !== "already_sent") {
            console.error("[paystack-webhook] receipt email not sent", {
              invoiceId: receiptInvoiceId,
              code: receiptCode,
              reason: receiptResult.reason
            });
          }
        } catch (err) {
          console.error("[paystack-webhook] receipt email failed", err);
        }
      }

      return {
        loggedEventId: created.id,
        duplicate: false,
        orgId: resolvedOrgId,
        handled: result.handled,
        orgUnresolved: result.orgUnresolved ?? false
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook processing failed.";
      await prisma.paymentEvent.update({
        where: { id: created.id },
        data: { processingError: message }
      });
      throw error;
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.paymentEvent.findUnique({
        where: { paystackEventId },
        select: { id: true, orgId: true }
      });
      return {
        loggedEventId: existing?.id ?? "",
        duplicate: true,
        orgId: existing?.orgId ?? orgId,
        handled: false,
        orgUnresolved: false
      };
    }
    throw error;
  }
}

export { PAST_DUE_GRACE_MS };

async function notifyCardExpiring(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      subscription: { select: { cardLast4: true } },
      users: {
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { email: true, name: true }
      }
    }
  });
  const admin = org?.users[0];
  if (!org || !admin?.email) return;

  const base = resolvePublicBaseForLinks();
  await sendBillingCardExpiringEmail({
    to: admin.email,
    adminName: admin.name,
    orgName: org.name,
    cardLast4: org.subscription?.cardLast4 ?? null,
    billingUrl: base ? `${base}/dashboard/settings/billing` : null
  });
}
