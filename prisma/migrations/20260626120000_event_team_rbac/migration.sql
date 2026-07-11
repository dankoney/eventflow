-- Rename sales rep role value for clarity
ALTER TYPE "Role" RENAME VALUE 'SALES_REF' TO 'SALES_REP';

-- Event team layout (event-linked access)
CREATE TABLE "EventTeamMember" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "dataAccessOverride" BOOLEAN NOT NULL DEFAULT false,
    "toggleEnabledAt" TIMESTAMP(3),
    "toggleExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventTeamMember_eventId_userId_key" ON "EventTeamMember"("eventId", "userId");
CREATE INDEX "EventTeamMember_userId_idx" ON "EventTeamMember"("userId");
CREATE INDEX "EventTeamMember_eventId_idx" ON "EventTeamMember"("eventId");

ALTER TABLE "EventTeamMember" ADD CONSTRAINT "EventTeamMember_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventTeamMember" ADD CONSTRAINT "EventTeamMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Staff walk-in session scoping
ALTER TABLE "Guest" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Guest" ADD COLUMN "staffVisibleSessionId" TEXT;

CREATE INDEX "Guest_createdByUserId_idx" ON "Guest"("createdByUserId");

ALTER TABLE "Guest" ADD CONSTRAINT "Guest_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
