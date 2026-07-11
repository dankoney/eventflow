-- CreateEnum
CREATE TYPE "AttendeeTheme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "bannerImageUrl" TEXT,
ADD COLUMN     "brandLogoUrl" TEXT,
ADD COLUMN     "attendeeTheme" "AttendeeTheme" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "brandPrimaryColor" TEXT;
