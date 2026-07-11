-- AlterTable Organization: optional billing details for receipts
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingLegalName" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingAddressLine1" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingAddressLine2" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingCity" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingRegion" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingPostalCode" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingCountry" TEXT;

-- AlterTable BillingInvoice: VAT-inclusive split + receipt email idempotency
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "baseAmountPesewas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "nhilAmountPesewas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "getfundAmountPesewas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "vatAmountPesewas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "receiptEmailSentAt" TIMESTAMP(3);

-- Backfill VAT split from inclusive total (absorb rounding into base)
UPDATE "BillingInvoice" AS inv
SET
  "nhilAmountPesewas" = sub.nhil,
  "getfundAmountPesewas" = sub.getfund,
  "vatAmountPesewas" = sub.vat,
  "baseAmountPesewas" = inv."amountPesewas" - sub.nhil - sub.getfund - sub.vat
FROM (
  SELECT
    id,
    ROUND(("amountPesewas"::numeric / 1.2) * 0.025)::int AS nhil,
    ROUND(("amountPesewas"::numeric / 1.2) * 0.025)::int AS getfund,
    ROUND(("amountPesewas"::numeric / 1.2) * 0.15)::int AS vat
  FROM "BillingInvoice"
) AS sub
WHERE inv.id = sub.id
  AND inv."baseAmountPesewas" = 0
  AND inv."amountPesewas" <> 0;
