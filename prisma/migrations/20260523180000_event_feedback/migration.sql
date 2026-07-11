-- CreateEnum
CREATE TYPE "EventFeedbackRating" AS ENUM ('VERY_UNSATISFIED', 'UNSATISFIED', 'NEUTRAL', 'SATISFIED', 'VERY_SATISFIED');

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN "feedbackToken" TEXT,
ADD COLUMN "feedbackRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EventFeedbackCampaign" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventFeedbackCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventFeedbackResponse" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "campaignId" TEXT,
    "rating" "EventFeedbackRating" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventFeedbackResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guest_feedbackToken_key" ON "Guest"("feedbackToken");

-- CreateIndex
CREATE INDEX "EventFeedbackCampaign_eventId_createdAt_idx" ON "EventFeedbackCampaign"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "EventFeedbackResponse_eventId_rating_idx" ON "EventFeedbackResponse"("eventId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "EventFeedbackResponse_eventId_guestId_key" ON "EventFeedbackResponse"("eventId", "guestId");

-- AddForeignKey
ALTER TABLE "EventFeedbackCampaign" ADD CONSTRAINT "EventFeedbackCampaign_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFeedbackCampaign" ADD CONSTRAINT "EventFeedbackCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFeedbackResponse" ADD CONSTRAINT "EventFeedbackResponse_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFeedbackResponse" ADD CONSTRAINT "EventFeedbackResponse_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFeedbackResponse" ADD CONSTRAINT "EventFeedbackResponse_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EventFeedbackCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
