-- CreateEnum
CREATE TYPE "EmailMarketingConsentSource" AS ENUM ('PUBLIC_REGISTER', 'RSVP', 'PREFERENCE_CENTER', 'ADMIN_IMPORT');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "marketingEmailEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Organization" ADD COLUMN "marketingConsentCopy" TEXT;

ALTER TABLE "Organization" ADD COLUMN "marketingPrivacyPolicyUrl" TEXT;

-- AlterTable
ALTER TABLE "EmailContact" ADD COLUMN "consentSource" "EmailMarketingConsentSource";
