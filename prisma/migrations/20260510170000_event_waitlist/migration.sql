-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WaitlistStatus') THEN
    CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING','PROMOTED','EXPIRED','REMOVED');
  END IF;
END$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventWaitlistEntry" (
  "id"                TEXT PRIMARY KEY,
  "eventId"           TEXT NOT NULL,
  "email"             TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "phone"             TEXT,
  "company"           TEXT,
  "preferredMode"     "AttendMode",
  "position"          INTEGER NOT NULL,
  "status"            "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
  "notifiedAt"        TIMESTAMP(3),
  "promotedToGuestId" TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventWaitlistEntry_eventId_email_key') THEN
    ALTER TABLE "EventWaitlistEntry" ADD CONSTRAINT "EventWaitlistEntry_eventId_email_key" UNIQUE ("eventId", "email");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventWaitlistEntry_promotedToGuestId_key') THEN
    ALTER TABLE "EventWaitlistEntry" ADD CONSTRAINT "EventWaitlistEntry_promotedToGuestId_key" UNIQUE ("promotedToGuestId");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventWaitlistEntry_eventId_fkey') THEN
    ALTER TABLE "EventWaitlistEntry"
      ADD CONSTRAINT "EventWaitlistEntry_eventId_fkey" FOREIGN KEY ("eventId")
      REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "EventWaitlistEntry_eventId_status_position_idx"
  ON "EventWaitlistEntry"("eventId","status","position");
