-- Require endDate on every event; backfill invalid or missing values.
UPDATE "Event"
SET "endDate" = "date" + interval '2 hours'
WHERE "endDate" IS NULL;

UPDATE "Event"
SET "endDate" = "date" + interval '1 hour'
WHERE "endDate" <= "date";

ALTER TABLE "Event" ALTER COLUMN "endDate" SET NOT NULL;
