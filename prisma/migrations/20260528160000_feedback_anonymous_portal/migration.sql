-- Anonymous portal submissions (no guest record).
ALTER TABLE "EventFeedbackResponse" ALTER COLUMN "guestId" DROP NOT NULL;

ALTER TABLE "EventFeedbackResponse" ADD COLUMN "portalAnonymousToken" TEXT;

CREATE UNIQUE INDEX "EventFeedbackResponse_portalAnonymousToken_key" ON "EventFeedbackResponse"("portalAnonymousToken");
