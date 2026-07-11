import {
  BillingInvoiceSource,
  BillingInvoiceStatus,
  OrgPlan,
  type Prisma
} from "@prisma/client";

/**
 * Dual-webhook idempotency for Enterprise Payment Requests.
 *
 * Paystack can fire BOTH `paymentrequest.success` and `charge.success` for the
 * same customer payment. We must never create a second BillingInvoice row from
 * the charge, and we must only transition PENDING → PAID once.
 *
 * Resolution order when a charge arrives:
 *  1. metadata.eventflow_invoice_id
 *  2. metadata / payload request_code → paystackPaymentRequestCode
 *  3. ENTERPRISE orgs only: PENDING ENTERPRISE_PAYABLE with matching amount
 *     (or recently PAID without this charge reference) — safe because ENTERPRISE
 *     orgs do not run Paystack PRO subscriptions after upgrade.
 *
 * paymentrequest.success resolves solely by request_code.
 */

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function extractPaymentRequestCodeFromPayload(
  data: Record<string, unknown>
): string | null {
  const direct = asString(data.request_code);
  if (direct?.startsWith("PRQ_")) return direct;

  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};

  for (const key of [
    "request_code",
    "payment_request_code",
    "paymentrequest_code",
    "paymentRequestCode"
  ] as const) {
    const value = asString(metadata[key]);
    if (value?.startsWith("PRQ_")) return value;
  }

  return null;
}

export function extractEventflowInvoiceIdFromPayload(
  data: Record<string, unknown>
): string | null {
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};
  return (
    asString(metadata.eventflow_invoice_id) ??
    asString(metadata.eventflowInvoiceId) ??
    null
  );
}

const RECENT_PAID_WINDOW_MS = 15 * 60 * 1000;

export async function findEnterprisePayableInvoiceForCharge(
  tx: Prisma.TransactionClient,
  input: {
    orgId: string;
    amountPesewas?: number | null;
    chargeReference?: string | null;
    data: Record<string, unknown>;
  }
): Promise<{ id: string; status: BillingInvoiceStatus; paystackInvoiceCode: string | null } | null> {
  const invoiceId = extractEventflowInvoiceIdFromPayload(input.data);
  if (invoiceId) {
    const byId = await tx.billingInvoice.findFirst({
      where: {
        id: invoiceId,
        orgId: input.orgId,
        source: BillingInvoiceSource.ENTERPRISE_PAYABLE
      },
      select: { id: true, status: true, paystackInvoiceCode: true }
    });
    if (byId) return byId;
  }

  const requestCode = extractPaymentRequestCodeFromPayload(input.data);
  if (requestCode) {
    const byCode = await tx.billingInvoice.findFirst({
      where: {
        orgId: input.orgId,
        paystackPaymentRequestCode: requestCode,
        source: BillingInvoiceSource.ENTERPRISE_PAYABLE
      },
      select: { id: true, status: true, paystackInvoiceCode: true }
    });
    if (byCode) return byCode;
  }

  const org = await tx.organization.findUnique({
    where: { id: input.orgId },
    select: { plan: true }
  });
  if (org?.plan !== OrgPlan.ENTERPRISE) return null;
  if (input.amountPesewas == null) return null;

  const pending = await tx.billingInvoice.findMany({
    where: {
      orgId: input.orgId,
      source: BillingInvoiceSource.ENTERPRISE_PAYABLE,
      status: BillingInvoiceStatus.PENDING,
      amountPesewas: input.amountPesewas
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: 2,
    select: { id: true, status: true, paystackInvoiceCode: true }
  });
  if (pending.length === 1) return pending[0]!;

  const since = new Date(Date.now() - RECENT_PAID_WINDOW_MS);
  const recentPaid = await tx.billingInvoice.findMany({
    where: {
      orgId: input.orgId,
      source: BillingInvoiceSource.ENTERPRISE_PAYABLE,
      status: BillingInvoiceStatus.PAID,
      amountPesewas: input.amountPesewas,
      paidAt: { gte: since }
    },
    orderBy: { paidAt: "desc" },
    take: 5,
    select: { id: true, status: true, paystackInvoiceCode: true }
  });

  const chargeRef = input.chargeReference?.trim() || null;
  const attachable = recentPaid.find(
    (row) => !row.paystackInvoiceCode || (chargeRef && row.paystackInvoiceCode === chargeRef)
  );
  if (attachable) return attachable;
  if (recentPaid.length === 1) return recentPaid[0]!;

  return null;
}

/**
 * Conditionally mark an ENTERPRISE_PAYABLE invoice PAID.
 * Returns newlyPaid=false if already PAID / CANCELLED / not found.
 */
export async function markEnterprisePayableInvoicePaid(
  tx: Prisma.TransactionClient,
  input: {
    invoiceId?: string;
    paystackPaymentRequestCode?: string;
    chargeReference?: string | null;
    paidAt: Date;
  }
): Promise<{ invoiceId: string; newlyPaid: boolean } | null> {
  const invoice = input.invoiceId
    ? await tx.billingInvoice.findFirst({
        where: {
          id: input.invoiceId,
          source: BillingInvoiceSource.ENTERPRISE_PAYABLE
        },
        select: {
          id: true,
          status: true,
          paystackInvoiceCode: true
        }
      })
    : input.paystackPaymentRequestCode
      ? await tx.billingInvoice.findFirst({
          where: {
            paystackPaymentRequestCode: input.paystackPaymentRequestCode,
            source: BillingInvoiceSource.ENTERPRISE_PAYABLE
          },
          select: {
            id: true,
            status: true,
            paystackInvoiceCode: true
          }
        })
      : null;

  if (!invoice) return null;
  if (invoice.status === BillingInvoiceStatus.CANCELLED) {
    return { invoiceId: invoice.id, newlyPaid: false };
  }
  if (invoice.status === BillingInvoiceStatus.PAID) {
    if (input.chargeReference && !invoice.paystackInvoiceCode) {
      await tx.billingInvoice.update({
        where: { id: invoice.id },
        data: { paystackInvoiceCode: input.chargeReference }
      });
    }
    return { invoiceId: invoice.id, newlyPaid: false };
  }

  const data: Prisma.BillingInvoiceUpdateManyMutationInput = {
    status: BillingInvoiceStatus.PAID,
    paidAt: input.paidAt
  };
  if (input.chargeReference && !invoice.paystackInvoiceCode) {
    data.paystackInvoiceCode = input.chargeReference;
  }

  const result = await tx.billingInvoice.updateMany({
    where: {
      id: invoice.id,
      status: BillingInvoiceStatus.PENDING
    },
    data
  });

  return {
    invoiceId: invoice.id,
    newlyPaid: result.count > 0
  };
}
