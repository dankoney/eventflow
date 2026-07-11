-- Add a nullable `source` column to CheckIn for analytics on auto check-in triggers
-- (Phase 3): "open-zoom-redirect", "rsvp-presence-confirm", "rsvp-accept", etc.
ALTER TABLE "CheckIn" ADD COLUMN IF NOT EXISTS "source" TEXT;
