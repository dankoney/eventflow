-- Organization-level branding for broadcast email templates.
ALTER TABLE "Organization" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#4F46E5';
ALTER TABLE "Organization" ADD COLUMN "accentColor" TEXT;

-- Backfill from existing org fields where possible.
UPDATE "Organization"
SET "logoUrl" = "logo"
WHERE "logoUrl" IS NULL AND "logo" IS NOT NULL;

UPDATE "Organization"
SET "primaryColor" = COALESCE(NULLIF(TRIM("defaultEventBrandPrimaryColor"), ''), '#4F46E5');
