-- CreateEnum
CREATE TYPE "BillingInvoiceSource" AS ENUM ('PAYSTACK', 'MANUAL');

-- AlterTable Subscription
ALTER TABLE "Subscription" ADD COLUMN "dunningPausedAt" TIMESTAMP(3),
ADD COLUMN "compPlan" "OrgPlan",
ADD COLUMN "compEndsAt" TIMESTAMP(3);

CREATE INDEX "Subscription_compEndsAt_idx" ON "Subscription"("compEndsAt");

-- AlterTable BillingInvoice
ALTER TABLE "BillingInvoice" ADD COLUMN "source" "BillingInvoiceSource" NOT NULL DEFAULT 'PAYSTACK',
ADD COLUMN "lineItems" JSONB;

CREATE INDEX "BillingInvoice_orgId_source_idx" ON "BillingInvoice"("orgId", "source");

-- CreateTable ManualBillingAction
CREATE TABLE "ManualBillingAction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "beforeState" JSONB NOT NULL,
    "afterState" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualBillingAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualBillingAction_orgId_createdAt_idx" ON "ManualBillingAction"("orgId", "createdAt");
CREATE INDEX "ManualBillingAction_actorUserId_createdAt_idx" ON "ManualBillingAction"("actorUserId", "createdAt");
CREATE INDEX "ManualBillingAction_action_createdAt_idx" ON "ManualBillingAction"("action", "createdAt");

ALTER TABLE "ManualBillingAction" ADD CONSTRAINT "ManualBillingAction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualBillingAction" ADD CONSTRAINT "ManualBillingAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
