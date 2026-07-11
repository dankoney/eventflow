-- Admin-only Zoom host start URL (never exposed on public/guest routes).
ALTER TABLE "Event" ADD COLUMN "zoomStartUrl" TEXT;
