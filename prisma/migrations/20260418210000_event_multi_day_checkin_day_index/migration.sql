-- Multi-day schedule + per-session check-in rows
CREATE TYPE "EventScheduleMode" AS ENUM ('SINGLE_BLOCK', 'MULTI_DAY');

ALTER TABLE "Event" ADD COLUMN "scheduleMode" "EventScheduleMode" NOT NULL DEFAULT 'SINGLE_BLOCK';
ALTER TABLE "Event" ADD COLUMN "multiDayConfig" JSONB;

ALTER TABLE "CheckIn" DROP CONSTRAINT IF EXISTS "CheckIn_guestId_key";

ALTER TABLE "CheckIn" ADD COLUMN "dayIndex" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "CheckIn_guestId_dayIndex_key" ON "CheckIn"("guestId", "dayIndex");

CREATE INDEX "CheckIn_guestId_idx" ON "CheckIn"("guestId");
