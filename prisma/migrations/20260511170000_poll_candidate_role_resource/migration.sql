-- Election & Polling Module — candidate profile fields.
-- Adds the candidate's current role/title (distinct from the position they are
-- running for) and an optional supporting document (CV / manifesto PDF, etc.)
-- shown on the public election section of the registration page.

ALTER TABLE "PollCandidate" ADD COLUMN IF NOT EXISTS "role" TEXT;
ALTER TABLE "PollCandidate" ADD COLUMN IF NOT EXISTS "resourceUrl" TEXT;
ALTER TABLE "PollCandidate" ADD COLUMN IF NOT EXISTS "resourceName" TEXT;
