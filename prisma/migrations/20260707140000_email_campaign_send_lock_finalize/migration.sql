-- Cron worker lock + finalize retry tracking for broadcast sends.
ALTER TABLE "EmailCampaign" ADD COLUMN "sendProcessingStartedAt" TIMESTAMP(3);
ALTER TABLE "EmailCampaign" ADD COLUMN "finalizeAttemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailCampaign" ADD COLUMN "lastFinalizeAttemptAt" TIMESTAMP(3);

CREATE INDEX "EmailCampaign_status_sendProcessingStartedAt_idx"
  ON "EmailCampaign"("status", "sendProcessingStartedAt");
