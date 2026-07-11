-- Dedicated columns for internal staff notice meeting room and subject override.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "internalStaffMeetingRoom" VARCHAR(240);
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "internalStaffNoticeSubject" VARCHAR(500);
