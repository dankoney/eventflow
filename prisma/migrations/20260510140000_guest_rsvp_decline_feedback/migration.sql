-- AlterEnum
ALTER TYPE "GuestStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RsvpDeclineReason') THEN
    CREATE TYPE "RsvpDeclineReason" AS ENUM ('SCHEDULING_CONFLICT','NOT_RELEVANT','OUT_OF_OFFICE','PREFER_VIRTUAL_ONLY','OTHER');
  END IF;
END$$;

-- AlterTable
ALTER TABLE "Guest"
  ADD COLUMN IF NOT EXISTS "declineReason" "RsvpDeclineReason",
  ADD COLUMN IF NOT EXISTS "declineNote" TEXT,
  ADD COLUMN IF NOT EXISTS "declinedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notificationsSuppressedAt" TIMESTAMP(3);

-- Index for analytics queries on decline reason per event
CREATE INDEX IF NOT EXISTS "Guest_eventId_declineReason_idx" ON "Guest"("eventId","declineReason");
