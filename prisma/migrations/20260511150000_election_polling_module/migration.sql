-- Election & Polling Module — Phase 1: data architecture.
-- See prisma/schema.prisma "Election & Polling Module" section for the architectural
-- contract. Critically: the Vote table carries NO column referencing Guest or User
-- (secret ballot). Guest.hasVoted is the only Guest-side trace of participation.

-- CreateEnum: VoteConfidenceChoice
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VoteConfidenceChoice') THEN
    CREATE TYPE "VoteConfidenceChoice" AS ENUM ('YES','NO','ABSTAIN');
  END IF;
END$$;

-- AlterTable: Guest.hasVoted flag (anonymized participation marker)
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "hasVoted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: Poll (1-1 with Event)
CREATE TABLE IF NOT EXISTS "Poll" (
  "id"          TEXT PRIMARY KEY,
  "eventId"     TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT false,
  "startTime"   TIMESTAMP(3) NOT NULL,
  "endTime"     TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Poll_eventId_key') THEN
    ALTER TABLE "Poll" ADD CONSTRAINT "Poll_eventId_key" UNIQUE ("eventId");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Poll_eventId_fkey') THEN
    ALTER TABLE "Poll"
      ADD CONSTRAINT "Poll_eventId_fkey" FOREIGN KEY ("eventId")
      REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "Poll_eventId_isActive_idx" ON "Poll"("eventId", "isActive");

-- CreateTable: PollPosition
CREATE TABLE IF NOT EXISTS "PollPosition" (
  "id"          TEXT PRIMARY KEY,
  "pollId"      TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PollPosition_pollId_fkey') THEN
    ALTER TABLE "PollPosition"
      ADD CONSTRAINT "PollPosition_pollId_fkey" FOREIGN KEY ("pollId")
      REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "PollPosition_pollId_sortOrder_idx" ON "PollPosition"("pollId", "sortOrder");

-- CreateTable: PollCandidate
CREATE TABLE IF NOT EXISTS "PollCandidate" (
  "id"         TEXT PRIMARY KEY,
  "positionId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "photoUrl"   TEXT,
  "bio"        TEXT,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PollCandidate_positionId_fkey') THEN
    ALTER TABLE "PollCandidate"
      ADD CONSTRAINT "PollCandidate_positionId_fkey" FOREIGN KEY ("positionId")
      REFERENCES "PollPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "PollCandidate_positionId_sortOrder_idx" ON "PollCandidate"("positionId", "sortOrder");

-- CreateTable: Vote — ANONYMIZED. NO guestId / userId column. Do not add one.
CREATE TABLE IF NOT EXISTS "Vote" (
  "id"               TEXT PRIMARY KEY,
  "pollId"           TEXT NOT NULL,
  "positionId"       TEXT NOT NULL,
  "candidateId"      TEXT,
  "confidenceChoice" "VoteConfidenceChoice",
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vote_pollId_fkey') THEN
    ALTER TABLE "Vote"
      ADD CONSTRAINT "Vote_pollId_fkey" FOREIGN KEY ("pollId")
      REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vote_positionId_fkey') THEN
    ALTER TABLE "Vote"
      ADD CONSTRAINT "Vote_positionId_fkey" FOREIGN KEY ("positionId")
      REFERENCES "PollPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vote_candidateId_fkey') THEN
    ALTER TABLE "Vote"
      ADD CONSTRAINT "Vote_candidateId_fkey" FOREIGN KEY ("candidateId")
      REFERENCES "PollCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "Vote_pollId_idx" ON "Vote"("pollId");
CREATE INDEX IF NOT EXISTS "Vote_positionId_idx" ON "Vote"("positionId");
CREATE INDEX IF NOT EXISTS "Vote_candidateId_idx" ON "Vote"("candidateId");

-- CreateTable: PollVerification (OTP gate). One row per request; consumed atomically.
CREATE TABLE IF NOT EXISTS "PollVerification" (
  "id"              TEXT PRIMARY KEY,
  "eventId"         TEXT NOT NULL,
  "guestId"         TEXT NOT NULL,
  "email"           TEXT NOT NULL,
  "codeHash"        TEXT NOT NULL,
  "deliveryChannel" VARCHAR(24),
  "expiresAt"       TIMESTAMP(3) NOT NULL,
  "isUsed"          BOOLEAN NOT NULL DEFAULT false,
  "attemptCount"    INTEGER NOT NULL DEFAULT 0,
  "consumedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PollVerification_eventId_fkey') THEN
    ALTER TABLE "PollVerification"
      ADD CONSTRAINT "PollVerification_eventId_fkey" FOREIGN KEY ("eventId")
      REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PollVerification_guestId_fkey') THEN
    ALTER TABLE "PollVerification"
      ADD CONSTRAINT "PollVerification_guestId_fkey" FOREIGN KEY ("guestId")
      REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "PollVerification_eventId_email_idx" ON "PollVerification"("eventId", "email");
CREATE INDEX IF NOT EXISTS "PollVerification_guestId_isUsed_idx" ON "PollVerification"("guestId", "isUsed");
CREATE INDEX IF NOT EXISTS "PollVerification_expiresAt_idx" ON "PollVerification"("expiresAt");
