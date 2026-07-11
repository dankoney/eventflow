-- Default event branding: secondary + tertiary colors for memo headers and attendee touchpoints.

ALTER TABLE "Organization"
  ADD COLUMN "defaultEventBrandSecondaryColor" TEXT,
  ADD COLUMN "defaultEventBrandTertiaryColor" TEXT;
