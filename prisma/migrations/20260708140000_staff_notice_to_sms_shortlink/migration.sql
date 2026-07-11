-- Memo TO override + short SMS links for internal staff notices

ALTER TABLE "Event"
  ADD COLUMN "internalStaffNoticeTo" TEXT;

ALTER TABLE "Guest"
  ADD COLUMN "staffNoticeSmsCode" TEXT;

CREATE UNIQUE INDEX "Guest_staffNoticeSmsCode_key" ON "Guest"("staffNoticeSmsCode");
