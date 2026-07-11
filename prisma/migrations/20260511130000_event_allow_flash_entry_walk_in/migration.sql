-- Flash-entry Command Center: allow unknown emails to self-register as walk-ins (default on for most blueprints).
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "allowFlashEntry" BOOLEAN NOT NULL DEFAULT true;

-- Walk-ins created from the public org command center when email does not match CRM.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'GuestJoinSource' AND e.enumlabel = 'WALK_IN'
  ) THEN
    ALTER TYPE "GuestJoinSource" ADD VALUE 'WALK_IN';
  END IF;
END $$;
