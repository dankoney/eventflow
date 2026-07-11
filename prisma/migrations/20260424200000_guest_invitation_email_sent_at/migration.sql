-- AlterTable
ALTER TABLE "Guest" ADD COLUMN "invitationEmailSentAt" TIMESTAMP(3);

CREATE INDEX "Guest_eventId_invitationEmailSentAt_idx" ON "Guest"("eventId", "invitationEmailSentAt");
