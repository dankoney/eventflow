-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "mnotifyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "mnotifyApiKey" TEXT;
ALTER TABLE "Organization" ADD COLUMN "mnotifySenderId" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "reminderPrimarySms" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "reminderFinalSms" BOOLEAN NOT NULL DEFAULT false;
