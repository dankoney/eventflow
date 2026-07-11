-- Internal staff notice email + SMS templates

CREATE TYPE "InternalStaffEmailTemplateKind" AS ENUM ('MEMORANDUM', 'NOTICE', 'BLANK');
CREATE TYPE "InternalStaffSmsTemplateKind" AS ENUM ('STANDARD', 'SHORT', 'BLANK');

ALTER TABLE "Event"
  ADD COLUMN "internalStaffEmailTemplateKind" "InternalStaffEmailTemplateKind" NOT NULL DEFAULT 'MEMORANDUM',
  ADD COLUMN "internalStaffSmsTemplateKind" "InternalStaffSmsTemplateKind" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "internalStaffSmsCustomText" TEXT;

