-- Meeting SDK credentials (host launch in browser) — separate from Server-to-Server OAuth.
ALTER TABLE "Organization" ADD COLUMN "zoomMeetingSdkKey" TEXT;
ALTER TABLE "Organization" ADD COLUMN "zoomMeetingSdkSecret" TEXT;
