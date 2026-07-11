-- Enterprise payable coverage fields
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "coverageMonths" INTEGER;
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "coverageEndsAt" TIMESTAMP(3);
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "extendFromPriorCoverage" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "coverageAppliedAt" TIMESTAMP(3);
