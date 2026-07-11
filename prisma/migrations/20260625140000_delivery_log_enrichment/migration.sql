-- Enrich guest notification delivery audit log
ALTER TABLE "GuestNotificationLog" ADD COLUMN "recipient" TEXT;
ALTER TABLE "GuestNotificationLog" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "GuestNotificationLog" ADD COLUMN "providerRef" TEXT;

CREATE INDEX "GuestNotificationLog_eventId_status_createdAt_idx" ON "GuestNotificationLog"("eventId", "status", "createdAt");
