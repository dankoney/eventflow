-- Campaign send preparation: resumable contact sync before Resend broadcast.
ALTER TYPE "EmailCampaignStatus" ADD VALUE 'PREPARING' BEFORE 'SCHEDULED';

ALTER TABLE "EmailCampaign" ADD COLUMN "sendError" TEXT;

ALTER TABLE "EmailCampaignRecipient" ADD COLUMN "resendSegmentSyncedAt" TIMESTAMP(3);
