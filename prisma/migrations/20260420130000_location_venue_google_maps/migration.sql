-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "googleMapsApiKey" TEXT;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN "city" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "googlePlaceId" TEXT,
ADD COLUMN "facilityImageUrl" TEXT;
