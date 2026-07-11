-- Short public code for feedback SMS links (`/f/[code]` → full magic link).
ALTER TABLE "Guest" ADD COLUMN "feedbackSmsCode" TEXT;

CREATE UNIQUE INDEX "Guest_feedbackSmsCode_key" ON "Guest"("feedbackSmsCode");
