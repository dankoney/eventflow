-- Track which workspace user created each event (dashboard event cards).
ALTER TABLE "Event" ADD COLUMN "createdByUserId" TEXT;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Event_createdByUserId_idx" ON "Event"("createdByUserId");
