-- AlterTable Organization
ALTER TABLE "Organization" ADD COLUMN "zoomClientId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "zoomClientSecret" TEXT;
ALTER TABLE "Organization" ADD COLUMN "zoomAccountId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable Location
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Location" ADD CONSTRAINT "Location_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable VerificationToken
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- Event: add FK column (nullable during backfill)
ALTER TABLE "Event" ADD COLUMN "locationId" TEXT;

-- One Location per existing Event (migrate legacy string column)
INSERT INTO "Location" ("id", "name", "address", "capacity", "orgId", "createdAt")
SELECT
    'mig_' || "id",
    LEFT(COALESCE(NULLIF(TRIM("location"), ''), 'Venue'), 120),
    LEFT(COALESCE(NULLIF(TRIM("location"), ''), 'Address to be confirmed'), 500),
    GREATEST("capacity", 1),
    "orgId",
    CURRENT_TIMESTAMP
FROM "Event";

UPDATE "Event" SET "locationId" = 'mig_' || "id";

ALTER TABLE "Event" DROP COLUMN "location";

ALTER TABLE "Event" ALTER COLUMN "locationId" SET NOT NULL;

ALTER TABLE "Event" ADD CONSTRAINT "Event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Orgs with no migrated venues (e.g. zero events) still need at least one Location for the UI.
INSERT INTO "Location" ("id", "name", "address", "capacity", "orgId", "createdAt")
SELECT
    'orgdef_' || o."id",
    'Default venue',
    'Update this under Settings → Locations.',
    500,
    o."id",
    CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (SELECT 1 FROM "Location" l WHERE l."orgId" = o."id");
