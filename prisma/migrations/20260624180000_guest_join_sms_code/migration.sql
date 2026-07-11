-- AlterTable
ALTER TABLE "Guest" ADD COLUMN "joinSmsCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Guest_joinSmsCode_key" ON "Guest"("joinSmsCode");
