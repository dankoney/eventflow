-- Org-wide contact list (replaces OrgStaff). Guest.contactId links optional snapshot rows to canonical contacts.
-- Drops legacy event email-domain allowlist and org internal meeting domain preset.

CREATE TABLE "OrgContact" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "staffEmployeeId" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "branch" TEXT,
    "category" TEXT,
    "rank" TEXT,
    "employmentStatus" "StaffEmploymentStatus" NOT NULL DEFAULT 'PERMANENT',
    "hasWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "dateJoined" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgContact_pkey" PRIMARY KEY ("id")
);

INSERT INTO "OrgContact" (
    "id", "orgId", "name", "email", "phone", "staffEmployeeId",
    "company", "jobTitle", "department", "branch", "category", "rank",
    "employmentStatus", "hasWhatsapp", "userId", "dateJoined", "createdAt", "updatedAt"
)
SELECT
    s."id",
    s."orgId",
    s."name",
    lower(trim(s."email")),
    CASE
        WHEN NULLIF(trim(s."phone"), '') IS NOT NULL
             AND length(regexp_replace(trim(s."phone"), '[^0-9]', '', 'g')) >= 10
            THEN trim(s."phone")
        ELSE '+1999' || lpad((row_number() OVER (PARTITION BY s."orgId" ORDER BY s."id"))::text, 10, '0')
    END,
    s."staffId",
    NULL,
    NULL,
    s."department",
    s."branch",
    s."category",
    s."rank",
    s."employmentStatus",
    s."hasWhatsapp",
    s."userId",
    s."dateJoined",
    s."createdAt",
    s."updatedAt"
FROM "OrgStaff" s;

CREATE UNIQUE INDEX "OrgContact_orgId_email_key" ON "OrgContact"("orgId", "email");
CREATE UNIQUE INDEX "OrgContact_orgId_phone_key" ON "OrgContact"("orgId", "phone");
CREATE UNIQUE INDEX "OrgContact_userId_key" ON "OrgContact"("userId");
CREATE INDEX "OrgContact_orgId_idx" ON "OrgContact"("orgId");

ALTER TABLE "OrgContact" ADD CONSTRAINT "OrgContact_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgContact" ADD CONSTRAINT "OrgContact_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Guest" ADD COLUMN "contactId" TEXT;

-- PostgreSQL: the updated table alias (g) must not appear inside JOIN ... ON of the FROM list;
-- correlate via WHERE instead.
UPDATE "Guest" g
SET "contactId" = c."id"
FROM "Event" e,
     "OrgContact" c
WHERE e."id" = g."eventId"
  AND c."orgId" = e."orgId"
  AND c."email" = lower(trim(g."email"));

ALTER TABLE "Guest" ADD CONSTRAINT "Guest_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "OrgContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remove duplicate guests per event (keep oldest id) before unique index
DELETE FROM "Guest" g1
USING "Guest" g2
WHERE g1."eventId" = g2."eventId"
  AND lower(g1."email") = lower(g2."email")
  AND g1."id" > g2."id";

CREATE UNIQUE INDEX "Guest_eventId_email_key" ON "Guest"("eventId", "email");

ALTER TABLE "OrgStaff" DROP CONSTRAINT IF EXISTS "OrgStaff_userId_fkey";
ALTER TABLE "OrgStaff" DROP CONSTRAINT IF EXISTS "OrgStaff_orgId_fkey";
DROP TABLE IF EXISTS "OrgStaff";

ALTER TABLE "Organization" DROP COLUMN IF EXISTS "internalMeetingEmailDomain";
ALTER TABLE "Organization" RENAME COLUMN "staffCategoryLabels" TO "contactCategoryLabels";

ALTER TABLE "Event" DROP COLUMN IF EXISTS "internalRegistrationDomains";
