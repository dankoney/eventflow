-- AlterTable
ALTER TABLE "EventFeedbackResponse" ADD COLUMN "submittedAnonymously" BOOLEAN NOT NULL DEFAULT false;

-- AlterEnum
ALTER TYPE "EmailMarketingConsentSource" ADD VALUE 'FEEDBACK';
