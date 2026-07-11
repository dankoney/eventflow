-- CreateEnum
CREATE TYPE "StaffEmploymentStatus" AS ENUM ('PERMANENT', 'CONTRACT');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "staffCategoryLabels" JSONB,
ADD COLUMN "internalStaffFooterContact" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "internalStaffAudience" JSONB;

-- CreateTable
CREATE TABLE "OrgStaff" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT,
    "phone" TEXT,
    "hasWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "branch" TEXT,
    "employmentStatus" "StaffEmploymentStatus" NOT NULL DEFAULT 'PERMANENT',
    "dateJoined" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rank" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgStaff_orgId_staffId_key" ON "OrgStaff"("orgId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgStaff_orgId_email_key" ON "OrgStaff"("orgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "OrgStaff_userId_key" ON "OrgStaff"("userId");

-- CreateIndex
CREATE INDEX "OrgStaff_orgId_idx" ON "OrgStaff"("orgId");

-- AddForeignKey
ALTER TABLE "OrgStaff" ADD CONSTRAINT "OrgStaff_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgStaff" ADD CONSTRAINT "OrgStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
