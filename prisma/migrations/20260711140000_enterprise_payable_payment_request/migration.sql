-- AlterEnum BillingInvoiceStatus: CANCELLED
ALTER TYPE "BillingInvoiceStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterEnum BillingInvoiceSource: ENTERPRISE_PAYABLE
ALTER TYPE "BillingInvoiceSource" ADD VALUE IF NOT EXISTS 'ENTERPRISE_PAYABLE';

-- AlterTable BillingInvoice: Payment Request fields
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "paystackPaymentRequestCode" TEXT;
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "paymentPageUrl" TEXT;
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "invoiceEmailSentAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingInvoice_paystackPaymentRequestCode_key"
  ON "BillingInvoice"("paystackPaymentRequestCode");

CREATE INDEX IF NOT EXISTS "BillingInvoice_orgId_status_idx"
  ON "BillingInvoice"("orgId", "status");
