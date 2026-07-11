-- CreateEnum
CREATE TYPE "EmailUnsubscribeSource" AS ENUM ('EMAIL_LINK', 'ADMIN_IMPORT', 'PREFERENCE_CENTER');

-- CreateEnum
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailCampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'OPENED', 'CLICKED', 'SKIPPED_UNSUBSCRIBED');

-- CreateTable
CREATE TABLE "EmailContact" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribedAt" TIMESTAMP(3),
    "unsubscribeSource" "EmailUnsubscribeSource",
    "resendContactId" TEXT,
    "consentRecordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "editorState" JSONB NOT NULL,
    "compiledHtml" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "isPrebuilt" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "segmentDefinition" JSONB NOT NULL,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "resendBroadcastId" TEXT,
    "resendAudienceId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "emailContactId" TEXT NOT NULL,
    "status" "EmailCampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "firstClickedAt" TIMESTAMP(3),
    "resendEmailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "resendEmailId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailContact_guestId_key" ON "EmailContact"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailContact_email_key" ON "EmailContact"("email");

-- CreateIndex
CREATE INDEX "EmailContact_isSubscribed_idx" ON "EmailContact"("isSubscribed");

-- CreateIndex
CREATE INDEX "EmailTemplate_orgId_updatedAt_idx" ON "EmailTemplate"("orgId", "updatedAt");

-- CreateIndex
CREATE INDEX "EmailTemplate_orgId_isPrebuilt_idx" ON "EmailTemplate"("orgId", "isPrebuilt");

-- CreateIndex
CREATE INDEX "EmailCampaign_orgId_status_updatedAt_idx" ON "EmailCampaign"("orgId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "EmailCampaign_templateId_idx" ON "EmailCampaign"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCampaignRecipient_campaignId_emailContactId_key" ON "EmailCampaignRecipient"("campaignId", "emailContactId");

-- CreateIndex
CREATE INDEX "EmailCampaignRecipient_campaignId_idx" ON "EmailCampaignRecipient"("campaignId");

-- CreateIndex
CREATE INDEX "EmailCampaignRecipient_emailContactId_idx" ON "EmailCampaignRecipient"("emailContactId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCampaignRecipient_resendEmailId_key" ON "EmailCampaignRecipient"("resendEmailId");

-- CreateIndex
CREATE INDEX "EmailEvent_resendEmailId_idx" ON "EmailEvent"("resendEmailId");

-- CreateIndex
CREATE INDEX "EmailEvent_receivedAt_idx" ON "EmailEvent"("receivedAt");

-- AddForeignKey
ALTER TABLE "EmailContact" ADD CONSTRAINT "EmailContact_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_emailContactId_fkey" FOREIGN KEY ("emailContactId") REFERENCES "EmailContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
