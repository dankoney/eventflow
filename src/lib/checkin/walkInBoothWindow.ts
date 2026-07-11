import { EventStatus, EventType, type EventScheduleMode, type Prisma } from "@prisma/client";

import type { CheckInWindowResult } from "@/lib/event-schedule/multiDayConfig";
import { getParsedMultiDayOrNull } from "@/lib/event-schedule/multiDayConfig";
import { eventCompletionAt } from "@/lib/lifecycle/eventTiming";

/** Walk-in kiosk opens this many hours before program start. */
export const WALK_IN_BOOTH_OPEN_HOURS_BEFORE = 2;

export type WalkInBoothWindowEvent = {
  date: Date;
  endDate: Date;
  status: EventStatus;
  type: EventType;
};

export function walkInBoothOpensAt(event: Pick<WalkInBoothWindowEvent, "date">): Date {
  return new Date(event.date.getTime() - WALK_IN_BOOTH_OPEN_HOURS_BEFORE * 60 * 60 * 1000);
}

export function walkInBoothClosesAt(event: Pick<WalkInBoothWindowEvent, "endDate">): Date {
  return eventCompletionAt(event.endDate);
}

/**
 * Onsite walk-in kiosk is available from 2h before start until the post-event completion window.
 */
export function isWalkInBoothOpen(
  event: WalkInBoothWindowEvent,
  now = new Date()
): boolean {
  if (event.type === EventType.VIRTUAL) return false;
  if (event.status === EventStatus.DRAFT || event.status === EventStatus.CANCELLED) {
    return false;
  }
  if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.LIVE) {
    return false;
  }

  const t = now.getTime();
  return t >= walkInBoothOpensAt(event).getTime() && t < walkInBoothClosesAt(event).getTime();
}

export function walkInBoothStatusMessage(
  event: WalkInBoothWindowEvent,
  now = new Date()
): string {
  if (event.type === EventType.VIRTUAL) {
    return "Virtual-only events do not use an onsite check-in booth.";
  }
  if (event.status === EventStatus.DRAFT || event.status === EventStatus.CANCELLED) {
    return "Publish the event to enable the walk-in booth.";
  }
  if (event.status === EventStatus.COMPLETED) {
    return "The walk-in booth has closed for this event.";
  }

  const opens = walkInBoothOpensAt(event);
  const closes = walkInBoothClosesAt(event);
  const t = now.getTime();

  if (t < opens.getTime()) {
    return `Opens ${opens.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} (${WALK_IN_BOOTH_OPEN_HOURS_BEFORE}h before start).`;
  }
  if (t >= closes.getTime()) {
    return "The walk-in booth has closed for this event.";
  }
  return `Active until ${closes.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`;
}

const boothOpenBufferMs = () => WALK_IN_BOOTH_OPEN_HOURS_BEFORE * 60 * 60 * 1000;

/**
 * Walk-in kiosk check-in day — opens {@link WALK_IN_BOOTH_OPEN_HOURS_BEFORE}h before session start.
 */
export function resolveWalkInBoothCheckInDayIndex(
  scheduleMode: EventScheduleMode,
  multiDayConfig: Prisma.JsonValue | null | undefined,
  eventDate: Date,
  eventEndDate: Date,
  now = new Date()
): CheckInWindowResult {
  const t = now.getTime();
  const boothClose = walkInBoothClosesAt({ endDate: eventEndDate }).getTime();
  const cfg = getParsedMultiDayOrNull(scheduleMode, multiDayConfig);
  const buffer = boothOpenBufferMs();

  if (!cfg || cfg.checkInPolicy === "ONCE_FOR_EVENT") {
    const boothOpen = walkInBoothOpensAt({ date: eventDate }).getTime();
    if (t < boothOpen) {
      return {
        ok: false,
        error: `Check-in opens ${new Date(boothOpen).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} (${WALK_IN_BOOTH_OPEN_HOURS_BEFORE}h before start).`
      };
    }
    if (t >= boothClose) {
      return { ok: false, error: "The walk-in booth has closed for this event." };
    }
    return { ok: true, dayIndex: 1 };
  }

  const sorted = [...cfg.days].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (const day of sorted) {
    const windowStart = day.startsAt.getTime() - buffer;
    const windowEnd = day.endsAt.getTime();
    if (t >= windowStart && t <= windowEnd) {
      return { ok: true, dayIndex: day.dayIndex };
    }
  }

  if (cfg.allowStaffCheckInOutsideSession) {
    const spanStart = sorted[0].startsAt.getTime() - buffer;
    const spanEnd = sorted[sorted.length - 1].endsAt.getTime();
    if (t >= spanStart && t <= spanEnd) {
      let fallback = sorted[0].dayIndex;
      for (const day of sorted) {
        if (t >= day.startsAt.getTime() - buffer) fallback = day.dayIndex;
      }
      return { ok: true, dayIndex: fallback };
    }
  }

  return {
    ok: false,
    error: "Check-in for this event is only available from 2 hours before each scheduled session."
  };
}
