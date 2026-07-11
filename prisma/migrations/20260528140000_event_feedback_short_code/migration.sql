-- Event-level short link for the public feedback portal (/fb/[code]).
ALTER TABLE "Event" ADD COLUMN "feedbackShortCode" TEXT;

CREATE UNIQUE INDEX "Event_feedbackShortCode_key" ON "Event"("feedbackShortCode");
