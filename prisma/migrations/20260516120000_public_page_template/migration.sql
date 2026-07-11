-- CreateEnum
CREATE TYPE "PublicPageTemplate" AS ENUM ('SUMMIT', 'NIGHT_EDITION');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "defaultEventPublicPageTemplate" "PublicPageTemplate" NOT NULL DEFAULT 'SUMMIT';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "publicPageTemplate" "PublicPageTemplate" NOT NULL DEFAULT 'SUMMIT';
