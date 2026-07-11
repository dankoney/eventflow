-- CreateEnum
CREATE TYPE "GuestMessageChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "GuestMessageCampaignScope" AS ENUM ('SINGLE', 'BLAST');

-- CreateEnum
CREATE TYPE "GuestMessageDeliveryStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "GuestMessageCampaign" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "channel" "GuestMessageChannel" NOT NULL,
    "scope" "GuestMessageCampaignScope" NOT NULL DEFAULT 'SINGLE',
    "templateSubject" TEXT,
    "templateHeadline" TEXT,
    "templateBody" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "mnotifyCampaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestMessageCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestMessageDelivery" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" "GuestMessageDeliveryStatus" NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestMessageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestMessageCampaign_eventId_createdAt_idx" ON "GuestMessageCampaign"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "GuestMessageDelivery_campaignId_idx" ON "GuestMessageDelivery"("campaignId");

-- CreateIndex
CREATE INDEX "GuestMessageDelivery_guestId_idx" ON "GuestMessageDelivery"("guestId");

-- AddForeignKey
ALTER TABLE "GuestMessageCampaign" ADD CONSTRAINT "GuestMessageCampaign_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestMessageCampaign" ADD CONSTRAINT "GuestMessageCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestMessageDelivery" ADD CONSTRAINT "GuestMessageDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GuestMessageCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestMessageDelivery" ADD CONSTRAINT "GuestMessageDelivery_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
