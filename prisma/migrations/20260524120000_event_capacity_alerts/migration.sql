-- Track capacity threshold alerts sent to org admins (per event session day).
CREATE TABLE "EventCapacityAlert" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventCapacityAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventCapacityAlert_eventId_dayIndex_threshold_key" ON "EventCapacityAlert"("eventId", "dayIndex", "threshold");

ALTER TABLE "EventCapacityAlert" ADD CONSTRAINT "EventCapacityAlert_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
