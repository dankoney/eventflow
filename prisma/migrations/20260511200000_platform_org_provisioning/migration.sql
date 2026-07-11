-- Platform Org Provisioning
--
-- 1) Subscription tier (FREE / PRO / ENTERPRISE)
DO $$ BEGIN
    CREATE TYPE "OrgPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Organization additions
ALTER TABLE "Organization"
    ADD COLUMN IF NOT EXISTS "plan" "OrgPlan" NOT NULL DEFAULT 'FREE';

ALTER TABLE "Organization"
    ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);

ALTER TABLE "Organization"
    ADD COLUMN IF NOT EXISTS "provisionedById" TEXT;

DO $$ BEGIN
    ALTER TABLE "Organization"
        ADD CONSTRAINT "Organization_provisionedById_fkey"
        FOREIGN KEY ("provisionedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing orgs are pre-existing tenants — mark them as activated so signup
-- continues working for everyone in the database today.
UPDATE "Organization" SET "activatedAt" = COALESCE("activatedAt", "createdAt");

-- 3) User additions
ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "isPlatformOwner" BOOLEAN NOT NULL DEFAULT false;

-- 4) Promote the very first User created during /setup to platform owner so the
--    existing operator can access /superadmin without DB surgery. Idempotent
--    via the WHERE filter on "isPlatformOwner".
WITH first_user AS (
    SELECT "id" FROM "User"
    WHERE "isPlatformOwner" = false
    ORDER BY "createdAt" ASC, "id" ASC
    LIMIT 1
)
UPDATE "User"
SET "isPlatformOwner" = true
WHERE "id" IN (SELECT "id" FROM first_user)
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "isPlatformOwner" = true);

-- 5) Activation token table
CREATE TABLE IF NOT EXISTS "OrgActivationToken" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgActivationToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrgActivationToken_orgId_userId_consumedAt_idx"
    ON "OrgActivationToken"("orgId", "userId", "consumedAt");

CREATE INDEX IF NOT EXISTS "OrgActivationToken_expiresAt_idx"
    ON "OrgActivationToken"("expiresAt");

DO $$ BEGIN
    ALTER TABLE "OrgActivationToken"
        ADD CONSTRAINT "OrgActivationToken_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "OrgActivationToken"
        ADD CONSTRAINT "OrgActivationToken_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
