-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "internalStaffMealMenuEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "internalStaffMealMenuItems" JSONB;

-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "mealChoice" TEXT;
