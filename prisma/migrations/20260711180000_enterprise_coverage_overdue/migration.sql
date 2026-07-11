-- Enterprise coverage overdue flag + pre-expiry reminder idempotency
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "coverageOverdueSince" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "enterpriseCoverageReminderDay30SentAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "enterpriseCoverageReminderDay14SentAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "enterpriseCoverageReminderDay7SentAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "enterpriseCoverageReminderDay3SentAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "enterpriseCoverageReminderDay1SentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Subscription_coverageOverdueSince_idx" ON "Subscription"("coverageOverdueSince");
