-- AlterTable
ALTER TABLE "Guest"
  ADD COLUMN IF NOT EXISTS "rsvpConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "accommodationRequested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "accommodationDetails" TEXT;
