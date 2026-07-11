-- Store snapshot of message body / email subject for delivery audit & preview.
ALTER TABLE "GuestNotificationLog" ADD COLUMN "messagePreview" TEXT;
