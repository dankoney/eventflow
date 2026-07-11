-- CreateEnum
CREATE TYPE "InternalStaffMealMenuScope" AS ENUM ('ALL_STAFF', 'BY_BRANCH');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "internalStaffMealMenuScope" "InternalStaffMealMenuScope" NOT NULL DEFAULT 'ALL_STAFF',
ADD COLUMN     "internalStaffMealMenusByBranch" JSONB;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "branch" TEXT;
