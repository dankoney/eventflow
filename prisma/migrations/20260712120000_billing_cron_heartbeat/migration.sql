-- Billing cron heartbeat + miss-alert idempotency on PlatformSettings
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "billingLifecycleCronLastOkAt" TIMESTAMP(3);
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "billingDunningCronLastOkAt" TIMESTAMP(3);
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "billingCronWatchStartedAt" TIMESTAMP(3);
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "billingLifecycleCronMissAlertSentAt" TIMESTAMP(3);
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "billingDunningCronMissAlertSentAt" TIMESTAMP(3);
