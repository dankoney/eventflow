-- AlterTable: optional guest email + event-level email mandatory toggle
ALTER TABLE "Event" ADD COLUMN "emailMandatoryForRegistration" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Guest" ALTER COLUMN "email" DROP NOT NULL;

CREATE INDEX "Guest_eventId_phone_idx" ON "Guest"("eventId", "phone");

-- System notification delivery audit log
CREATE TABLE "GuestNotificationLog" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuestNotificationLog_guestId_createdAt_idx" ON "GuestNotificationLog"("guestId", "createdAt");
CREATE INDEX "GuestNotificationLog_eventId_createdAt_idx" ON "GuestNotificationLog"("eventId", "createdAt");

ALTER TABLE "GuestNotificationLog" ADD CONSTRAINT "GuestNotificationLog_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
