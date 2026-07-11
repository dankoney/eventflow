-- GuestStatus: accepted invitation (RSVP yes) before check-in
ALTER TYPE "GuestStatus" ADD VALUE 'ACCEPTED';

-- Attendance mode unset until check-in (hybrid) or virtual join
ALTER TABLE "Guest" ALTER COLUMN "mode" DROP NOT NULL;

-- Invitation accept token (organizer-added guests)
ALTER TABLE "Guest" ADD COLUMN "invitationToken" TEXT;
CREATE UNIQUE INDEX "Guest_invitationToken_key" ON "Guest"("invitationToken");

-- Event guest segments
CREATE TABLE "EventGuestGroup" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventGuestGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventGuestGroup_eventId_idx" ON "EventGuestGroup"("eventId");
CREATE UNIQUE INDEX "EventGuestGroup_eventId_name_key" ON "EventGuestGroup"("eventId", "name");

ALTER TABLE "EventGuestGroup" ADD CONSTRAINT "EventGuestGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Guest" ADD COLUMN "eventGuestGroupId" TEXT;
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_eventGuestGroupId_fkey" FOREIGN KEY ("eventGuestGroupId") REFERENCES "EventGuestGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Guest_eventGuestGroupId_idx" ON "Guest"("eventGuestGroupId");
