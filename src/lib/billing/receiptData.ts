import {
  BillingInvoiceSource,
  BillingInvoiceStatus,
  OrgPlan,
  type BillingInvoice,
  type Organization
} from "@prisma/client";

import { formatGhsFromPesewas } from "@/lib/billing/formatMoney";
import { resolvePublicAppBaseUrlFromEnv } from "@/lib/email/assetUrl";

export type BillingReceiptLine = {
  label: string;
  amountPesewas: number;
  amountLabel: string;
  muted?: boolean;
};

export type BillingReceiptData = {
  invoiceId: string;
  receiptNumber: string;
  title: "Tax Invoice / Receipt";
  status: BillingInvoiceStatus;
  currency: string;
  totalPesewas: number;
  totalLabel: string;
  paidAt: Date | null;
  createdAt: Date;
  dateLabel: string;
  periodLabel: string | null;
  planLabel: string;
  paymentMethodLabel: string;
  source: BillingInvoiceSource;
  reference: string;
  billedTo: {
    name: string;
    lines: string[];
    email: string | null;
  };
  from: {
    name: string;
    lines: string[];
    vatTin: string | null;
    vatTinIsPlaceholder: boolean;
  };
  lines: BillingReceiptLine[];
  billingUrl: string | null;
  subscriptionDescription: string;
  /** Public support contact from PlatformSettings (optional). */
  supportEmail: string | null;
};

export type OrgBillingDetailsForReceipt = Pick<
  Organization,
  | "name"
  | "plan"
  | "billingLegalName"
  | "billingAddressLine1"
  | "billingAddressLine2"
  | "billingCity"
  | "billingRegion"
  | "billingPostalCode"
  | "billingCountry"
> & {
  billingCustomer?: { billingEmail: string } | null;
};

function appBase(): string {
  return resolvePublicAppBaseUrlFromEnv()?.replace(/\/$/, "") ?? "https://eventflow.cosabonita.tech";
}

/**
 * Seller identity on receipts. Production must set EVENTFLOW_BILLING_VAT_TIN
 * before sending receipts to real customers.
 */
export function getEventflowSellerIdentity(): {
  legalName: string;
  productName: string;
  siteUrl: string;
  vatTin: string | null;
  vatTinIsPlaceholder: boolean;
} {
  const legalName =
    process.env.EVENTFLOW_BILLING_LEGAL_NAME?.trim() || "Cosabonita";
  const tin = process.env.EVENTFLOW_BILLING_VAT_TIN?.trim() || null;
  const isProd = process.env.NODE_ENV === "production";
  return {
    legalName,
    productName: "EventFlow",
    siteUrl: appBase(),
    vatTin: tin,
    vatTinIsPlaceholder: !tin && !isProd
  };
}

/** Block customer-facing receipt email/PDF in production until TIN is configured. */
export function assertReceiptSellerReadyForProduction():
  | { ok: true }
  | { ok: false; error: string } {
  const seller = getEventflowSellerIdentity();
  if (process.env.NODE_ENV === "production" && !seller.vatTin) {
    return {
      ok: false,
      error:
        "EVENTFLOW_BILLING_VAT_TIN is not set. Configure the GRA VAT registration / TIN before issuing customer receipts in production."
    };
  }
  return { ok: true };
}

export function receiptNumberForInvoice(
  invoice: Pick<BillingInvoice, "id" | "paystackInvoiceCode" | "paystackPaymentRequestCode">
): string {
  if (invoice.paystackPaymentRequestCode?.trim()) {
    return invoice.paystackPaymentRequestCode.trim();
  }
  if (invoice.paystackInvoiceCode?.trim()) return invoice.paystackInvoiceCode.trim();
  return `EF-${invoice.id.slice(-8).toUpperCase()}`;
}

function billedToBlock(org: OrgBillingDetailsForReceipt): BillingReceiptData["billedTo"] {
  const name = org.billingLegalName?.trim() || org.name;
  const lines: string[] = [];
  if (org.billingAddressLine1?.trim()) lines.push(org.billingAddressLine1.trim());
  if (org.billingAddressLine2?.trim()) lines.push(org.billingAddressLine2.trim());
  const cityRegion = [org.billingCity?.trim(), org.billingRegion?.trim()]
    .filter(Boolean)
    .join(", ");
  if (cityRegion) lines.push(cityRegion);
  if (org.billingPostalCode?.trim()) lines.push(org.billingPostalCode.trim());
  if (org.billingCountry?.trim()) lines.push(org.billingCountry.trim());

  return {
    name,
    lines,
    email: org.billingCustomer?.billingEmail?.trim() || null
  };
}

function periodLabel(start: Date | null, end: Date | null): string | null {
  if (!start || !end) return null;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function buildBillingReceiptData(input: {
  invoice: Pick<
    BillingInvoice,
    | "id"
    | "amountPesewas"
    | "baseAmountPesewas"
    | "nhilAmountPesewas"
    | "getfundAmountPesewas"
    | "vatAmountPesewas"
    | "currency"
    | "status"
    | "source"
    | "paystackInvoiceCode"
    | "paystackPaymentRequestCode"
    | "paidAt"
    | "createdAt"
    | "periodStart"
    | "periodEnd"
    | "lineItems"
  >;
  org: OrgBillingDetailsForReceipt;
  supportEmail?: string | null;
}): BillingReceiptData {
  const { invoice, org } = input;
  const currency = invoice.currency || "GHS";
  const seller = getEventflowSellerIdentity();
  const planLabel = org.plan;
  const subscriptionDescription =
    org.plan === OrgPlan.ENTERPRISE
      ? "EventFlow ENTERPRISE subscription"
      : org.plan === OrgPlan.PRO
        ? "EventFlow PRO subscription"
        : "EventFlow subscription";

  const customLines =
    Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
      ? (invoice.lineItems as Array<{ description?: string; amountPesewas?: number }>)
          .filter((l) => typeof l?.description === "string")
          .map((l) => ({
            label: String(l.description),
            amountPesewas: typeof l.amountPesewas === "number" ? l.amountPesewas : 0
          }))
      : null;

  const baseLabel =
    customLines && customLines.length === 1
      ? customLines[0]!.label
      : subscriptionDescription;

  const lines: BillingReceiptLine[] = [
    {
      label: baseLabel,
      amountPesewas: invoice.baseAmountPesewas,
      amountLabel: formatGhsFromPesewas(invoice.baseAmountPesewas, currency)
    },
    {
      label: "NHIL (2.5%)",
      amountPesewas: invoice.nhilAmountPesewas,
      amountLabel: formatGhsFromPesewas(invoice.nhilAmountPesewas, currency),
      muted: true
    },
    {
      label: "GETFund Levy (2.5%)",
      amountPesewas: invoice.getfundAmountPesewas,
      amountLabel: formatGhsFromPesewas(invoice.getfundAmountPesewas, currency),
      muted: true
    },
    {
      label: "VAT (15%)",
      amountPesewas: invoice.vatAmountPesewas,
      amountLabel: formatGhsFromPesewas(invoice.vatAmountPesewas, currency),
      muted: true
    }
  ];

  const date = invoice.paidAt ?? invoice.createdAt;
  const fromLines = [seller.legalName, seller.siteUrl.replace(/^https?:\/\//, "")];
  if (seller.vatTin) {
    fromLines.push(`VAT TIN: ${seller.vatTin}`);
  } else if (seller.vatTinIsPlaceholder) {
    fromLines.push("VAT TIN: (set EVENTFLOW_BILLING_VAT_TIN before go-live)");
  }

  return {
    invoiceId: invoice.id,
    receiptNumber: receiptNumberForInvoice(invoice),
    title: "Tax Invoice / Receipt",
    status: invoice.status,
    currency,
    totalPesewas: invoice.amountPesewas,
    totalLabel: formatGhsFromPesewas(invoice.amountPesewas, currency),
    paidAt: invoice.paidAt,
    createdAt: invoice.createdAt,
    dateLabel: date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }),
    periodLabel: periodLabel(invoice.periodStart, invoice.periodEnd),
    planLabel,
    paymentMethodLabel:
      invoice.source === BillingInvoiceSource.MANUAL
        ? "Offline / manual"
        : invoice.source === BillingInvoiceSource.ENTERPRISE_PAYABLE
          ? "Paystack payment request"
          : "Paystack",
    source: invoice.source,
    reference: receiptNumberForInvoice(invoice),
    billedTo: billedToBlock(org),
    from: {
      name: seller.productName,
      lines: fromLines,
      vatTin: seller.vatTin,
      vatTinIsPlaceholder: seller.vatTinIsPlaceholder
    },
    lines,
    billingUrl: `${appBase()}/dashboard/settings/billing`,
    subscriptionDescription,
    supportEmail: input.supportEmail?.trim() || null
  };
}
