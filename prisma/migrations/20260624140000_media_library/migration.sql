-- Central org-scoped media library for reusable assets across the platform.
CREATE TYPE "MediaAssetKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "title" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "kind" "MediaAssetKind" NOT NULL,
  "storagePath" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MediaAsset_orgId_createdAt_idx" ON "MediaAsset"("orgId", "createdAt");
CREATE INDEX "MediaAsset_orgId_kind_idx" ON "MediaAsset"("orgId", "kind");

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
