-- CreateEnum
CREATE TYPE "EventBlueprintTemplate" AS ENUM ('BLANK', 'CONFERENCE', 'INTERNAL_STAFF', 'TRAINING_WORKSHOP');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "blueprintTemplate" "EventBlueprintTemplate" NOT NULL DEFAULT 'BLANK',
ADD COLUMN     "allowPublicRegistration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "registrationProfile" JSONB,
ADD COLUMN     "accommodationTravelNotes" TEXT,
ADD COLUMN     "resourceLinks" JSONB,
ADD COLUMN     "internalRegistrationDomains" JSONB;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN "staffEmployeeId" TEXT,
ADD COLUMN     "department" TEXT;
