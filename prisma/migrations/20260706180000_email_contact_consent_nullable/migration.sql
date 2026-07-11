-- Align EmailContact consent columns with marketing-compliance rules:
-- no silent subscribe; consentRecordedAt set only on explicit opt-in.

ALTER TABLE "EmailContact" ALTER COLUMN "isSubscribed" SET DEFAULT false;

ALTER TABLE "EmailContact" ALTER COLUMN "consentRecordedAt" DROP NOT NULL;

-- Existing rows created before this fix should not be treated as opted-in without proof.
UPDATE "EmailContact"
SET "isSubscribed" = false
WHERE "consentRecordedAt" IS NULL AND "isSubscribed" = true;
