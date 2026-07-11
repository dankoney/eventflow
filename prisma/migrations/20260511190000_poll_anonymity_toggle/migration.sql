-- Election & Polling Module — conditional anonymity.
--
-- 1) Per-poll switch. Default `true` keeps the original secret-ballot behaviour
--    for every existing poll.
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "isAnonymous" BOOLEAN NOT NULL DEFAULT true;

-- 2) Attributed ballot rows. Mirrors `Vote` 1-to-1 but adds the `guestId` link
--    and a shared per-submission `receiptRef`. Only written when the poll has
--    isAnonymous = false.
CREATE TABLE IF NOT EXISTS "BallotChoice" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "candidateId" TEXT,
    "confidenceChoice" "VoteConfidenceChoice",
    "guestId" TEXT NOT NULL,
    "receiptRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BallotChoice_pkey" PRIMARY KEY ("id")
);

-- One choice per voter per position, even if a network hiccup causes a retry.
CREATE UNIQUE INDEX IF NOT EXISTS "BallotChoice_pollId_positionId_guestId_key"
    ON "BallotChoice"("pollId", "positionId", "guestId");

CREATE INDEX IF NOT EXISTS "BallotChoice_pollId_guestId_idx"
    ON "BallotChoice"("pollId", "guestId");

CREATE INDEX IF NOT EXISTS "BallotChoice_guestId_idx"
    ON "BallotChoice"("guestId");

CREATE INDEX IF NOT EXISTS "BallotChoice_candidateId_idx"
    ON "BallotChoice"("candidateId");

CREATE INDEX IF NOT EXISTS "BallotChoice_receiptRef_idx"
    ON "BallotChoice"("receiptRef");

-- Foreign keys (idempotent via DO $$ blocks)
DO $$ BEGIN
    ALTER TABLE "BallotChoice"
        ADD CONSTRAINT "BallotChoice_pollId_fkey"
        FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "BallotChoice"
        ADD CONSTRAINT "BallotChoice_positionId_fkey"
        FOREIGN KEY ("positionId") REFERENCES "PollPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "BallotChoice"
        ADD CONSTRAINT "BallotChoice_candidateId_fkey"
        FOREIGN KEY ("candidateId") REFERENCES "PollCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "BallotChoice"
        ADD CONSTRAINT "BallotChoice_guestId_fkey"
        FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
