-- Election & Polling Module — results publishing.
-- Tracks when the admin published results to attendees (email + SMS broadcast).
-- The presence of `resultsPublishedAt` gates the public `/events/[id]/poll/results`
-- page so the URL is safe to share BEFORE publishing (returns a "not yet" notice).

ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "resultsPublishedAt" TIMESTAMP(3);
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "resultsSummary" TEXT;
