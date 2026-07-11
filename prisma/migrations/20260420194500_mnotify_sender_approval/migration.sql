-- CreateEnum
CREATE TYPE "MnotifySenderApproval" AS ENUM ('UNKNOWN', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "mnotifySenderApproval" "MnotifySenderApproval" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Organization" ADD COLUMN "mnotifySenderApprovalCheckedAt" TIMESTAMP(3);
