-- Revert workspace sender approval tracking (keep manual mNotify settings only).
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "mnotifySenderApprovalCheckedAt";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "mnotifySenderApproval";
DROP TYPE IF EXISTS "MnotifySenderApproval";
