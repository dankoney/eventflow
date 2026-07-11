-- CreateEnum
CREATE TYPE "InternalStaffCheckInMode" AS ENUM ('SHARED_CREDENTIAL', 'PERSONAL_LINK');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "internalStaffCheckInMode" "InternalStaffCheckInMode" NOT NULL DEFAULT 'SHARED_CREDENTIAL';

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN "internalCheckInToken" VARCHAR(128);

-- CreateIndex
CREATE UNIQUE INDEX "Guest_internalCheckInToken_key" ON "Guest"("internalCheckInToken");
