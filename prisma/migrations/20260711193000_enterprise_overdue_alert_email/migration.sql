-- One-time Enterprise coverage-overdue alert email idempotency
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "enterpriseCoverageOverdueAlertSentAt" TIMESTAMP(3);
