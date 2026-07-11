-- Enterprise CRM fields on OrgContact + contact groups (segments).

CREATE TYPE "CrmContactKind" AS ENUM (
  'ATTENDEE',
  'EMPLOYEE',
  'STAKEHOLDER',
  'SPONSOR',
  'MEDIA_PRESS',
  'VIP',
  'VENDOR',
  'SPEAKER',
  'OTHER'
);

ALTER TABLE "OrgContact" ADD COLUMN "crmKind" "CrmContactKind" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "OrgContact" ADD COLUMN "lifecycleStage" VARCHAR(48);
ALTER TABLE "OrgContact" ADD COLUMN "notes" TEXT;
ALTER TABLE "OrgContact" ADD COLUMN "tags" JSONB;
ALTER TABLE "OrgContact" ADD COLUMN "linkedinUrl" VARCHAR(512);
ALTER TABLE "OrgContact" ADD COLUMN "website" VARCHAR(512);
ALTER TABLE "OrgContact" ADD COLUMN "source" VARCHAR(120);

-- Heuristic: rows that look like an internal directory skew employee.
UPDATE "OrgContact"
SET "crmKind" = 'EMPLOYEE'
WHERE "crmKind" = 'OTHER'
  AND (
    COALESCE(TRIM("staffEmployeeId"), '') <> ''
    OR COALESCE(TRIM("department"), '') <> ''
    OR COALESCE(TRIM("rank"), '') <> ''
  );

CREATE INDEX "OrgContact_orgId_crmKind_idx" ON "OrgContact"("orgId", "crmKind");

CREATE TABLE "OrgContactGroup" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" VARCHAR(7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgContactGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrgContactGroup_orgId_idx" ON "OrgContactGroup"("orgId");

ALTER TABLE "OrgContactGroup" ADD CONSTRAINT "OrgContactGroup_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OrgContactGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgContactGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgContactGroupMember_groupId_contactId_key" ON "OrgContactGroupMember"("groupId", "contactId");
CREATE INDEX "OrgContactGroupMember_contactId_idx" ON "OrgContactGroupMember"("contactId");

ALTER TABLE "OrgContactGroupMember" ADD CONSTRAINT "OrgContactGroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "OrgContactGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgContactGroupMember" ADD CONSTRAINT "OrgContactGroupMember_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "OrgContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
