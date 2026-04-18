CREATE TYPE "ZoomSessionKind" AS ENUM ('WEBINAR', 'MEETING');

ALTER TABLE "Event" ADD COLUMN "zoomSessionKind" "ZoomSessionKind" NOT NULL DEFAULT 'WEBINAR';
