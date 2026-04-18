-- Organization: WhatsApp + Resend overrides
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "whatsappAccessToken" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "whatsappPhoneNumberId" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "resendApiKey" TEXT;

-- Event: smart reminder preferences
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "reminderPrimaryEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "reminderPrimaryHoursBefore" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "reminderPrimaryEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "reminderPrimaryWhatsapp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "reminderFinalEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "reminderFinalHoursBefore" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "reminderFinalWhatsapp" BOOLEAN NOT NULL DEFAULT true;

-- Reminder dispatch log (dedupe)
CREATE TABLE "EventReminderLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "anchorAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventReminderLog_eventId_kind_anchorAt_key" ON "EventReminderLog"("eventId", "kind", "anchorAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EventReminderLog_eventId_fkey'
  ) THEN
    ALTER TABLE "EventReminderLog" ADD CONSTRAINT "EventReminderLog_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Role enum: replace with ADMIN, MARKETING, STAFF, SALES_REF
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'MARKETING', 'STAFF', 'SALES_REF');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'ADMIN' THEN 'ADMIN'::"Role_new"
    WHEN 'MARKETING' THEN 'MARKETING'::"Role_new"
    WHEN 'SALES_REP' THEN 'SALES_REF'::"Role_new"
    ELSE 'STAFF'::"Role_new"
  END
);

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STAFF'::"Role_new";

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
