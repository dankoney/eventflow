-- Internal staff program notices (mandatory attendance — not RSVP invites).

CREATE TYPE "InternalStaffNoticeKind" AS ENUM ('MEETING', 'TRAINING', 'SENSITIZATION', 'BRIEFING');

ALTER TABLE "Event"
  ADD COLUMN "internalStaffNoticeKind" "InternalStaffNoticeKind" NOT NULL DEFAULT 'TRAINING',
  ADD COLUMN "internalStaffNoticeFrom" TEXT,
  ADD COLUMN "internalStaffNoticeCc" TEXT,
  ADD COLUMN "internalStaffNoticeContext" TEXT;

ALTER TABLE "Guest"
  ADD COLUMN "staffBriefingSentAt" TIMESTAMP(3),
  ADD COLUMN "staffBriefingSmsSentAt" TIMESTAMP(3);

-- New internal staff programs default to personal check-in links (notify on publish).
ALTER TABLE "Event" ALTER COLUMN "internalStaffCheckInMode" SET DEFAULT 'PERSONAL_LINK';
