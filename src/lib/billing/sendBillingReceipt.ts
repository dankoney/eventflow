import { BillingInvoiceStatus } from "@prisma/client";

import { buildBillingReceiptPdf } from "@/lib/billing/buildBillingReceiptPdf";
import { getPlatformBillingAlertSettings } from "@/lib/billing/platformSettings";
import {
  assertReceiptSellerReadyForProduction,
  buildBillingReceiptData
} from "@/lib/billing/receiptData";
import { splitInclusiveVatPesewas } from "@/lib/billing/vatSplit";
import { sendBillingPaymentReceiptEmail } from "@/lib/email/billingEmails";
import { prisma } from "@/lib/prisma";

/**
 * Send EventFlow Tax Invoice / Receipt email (with PDF) for a PAID invoice.
 * Idempotent via receiptEmailSentAt. Skips in production when TIN is unset.
 */
export async function maybeSendBillingReceiptEmail(
  invoiceId: string
): Promise<{ sent: boolean; reason?: string }> {
  const ready = assertReceiptSellerReadyForProduction();
  if (!ready.ok) {
    console.error("[billing-receipt]", ready.error, { invoiceId });
    return { sent: false, reason: ready.error };
  }

  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      org: {
        select: {
          name: true,
          plan: true,
          billingLegalName: true,
          billingAddressLine1: true,
          billingAddressLine2: true,
          billingCity: true,
          billingRegion: true,
          billingPostalCode: true,
          billingCountry: true,
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

  if (!invoice) return { sent: false, reason: "invoice_not_found" };
  if (invoice.status !== BillingInvoiceStatus.PAID) {
    return { sent: false, reason: "not_paid" };
  }
  if (invoice.receiptEmailSentAt) {
    return { sent: false, reason: "already_sent" };
  }

  const admin = invoice.org.users[0];
  const to =
    invoice.org.billingCustomer?.billingEmail?.trim() || admin?.email?.trim() || null;
  if (!to) return { sent: false, reason: "no_recipient" };

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
            name: true,
            plan: true,
            billingLegalName: true,
            billingAddressLine1: true,
            billingAddressLine2: true,
            billingCity: true,
            billingRegion: true,
            billingPostalCode: true,
            billingCountry: true,
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
  const filename = `eventflow-receipt-${safeRef || invoice.id.slice(-8)}.pdf`;

  await sendBillingPaymentReceiptEmail({
    to,
    adminName: admin?.name ?? null,
    receipt,
    pdfAttachment: { filename, contentBase64: pdfBase64 }
  });

  await prisma.billingInvoice.update({
    where: { id: invoiceId },
    data: { receiptEmailSentAt: new Date() }
  });

  return { sent: true };
}

export async function maybeSendBillingReceiptByPaystackCode(
  paystackInvoiceCode: string
): Promise<{ sent: boolean; reason?: string }> {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { paystackInvoiceCode },
    select: { id: true }
  });
  if (!invoice) return { sent: false, reason: "invoice_not_found" };
  return maybeSendBillingReceiptEmail(invoice.id);
}
