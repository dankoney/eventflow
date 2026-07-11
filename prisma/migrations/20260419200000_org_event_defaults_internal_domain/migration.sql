-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "defaultEventBannerImageUrl" TEXT,
ADD COLUMN     "defaultEventBrandLogoUrl" TEXT,
ADD COLUMN     "defaultEventAttendeeTheme" "AttendeeTheme" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "defaultEventBrandPrimaryColor" TEXT,
ADD COLUMN     "defaultEventVirtualCapacity" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "defaultZoomSessionKind" "ZoomSessionKind" NOT NULL DEFAULT 'MEETING',
ADD COLUMN     "internalMeetingEmailDomain" TEXT;
