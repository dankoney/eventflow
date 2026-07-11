import { EventScheduleMode, Prisma } from "@prisma/client";

import { getParsedMultiDayOrNull, multiDaySpan, type MultiDayConfig } from "./multiDayConfig";

/**
 * When cloning an event, move schedule dates to today while preserving clock times
 * and overall duration. Multi-day session rows shift by the same delta as day 1.
 */
export function shiftClonedEventSchedule(
  sourceDate: Date,
  sourceEndDate: Date,
  scheduleMode: EventScheduleMode,
  multiDayConfig: Prisma.JsonValue | null | undefined,
  now = new Date()
): {
  date: Date;
  endDate: Date;
  multiDayConfig: Prisma.InputJsonValue | typeof Prisma.JsonNull;
} {
  const targetStart = new Date(now);
  targetStart.setHours(
    sourceDate.getHours(),
    sourceDate.getMinutes(),
    sourceDate.getSeconds(),
    sourceDate.getMilliseconds()
  );

  const durationMs = Math.max(0, sourceEndDate.getTime() - sourceDate.getTime());
  const deltaMs = targetStart.getTime() - sourceDate.getTime();

  const cfg = getParsedMultiDayOrNull(scheduleMode, multiDayConfig);
  if (!cfg) {
    return {
      date: targetStart,
      endDate: new Date(targetStart.getTime() + durationMs),
      multiDayConfig: Prisma.JsonNull
    };
  }

  const shiftedDays = cfg.days.map((day) => ({
    ...day,
    startsAt: new Date(day.startsAt.getTime() + deltaMs),
    endsAt: new Date(day.endsAt.getTime() + deltaMs)
  }));

  const shiftedConfig: MultiDayConfig = { ...cfg, days: shiftedDays };
  const span = multiDaySpan(shiftedConfig);

  return {
    date: span.startsAt,
    endDate: span.endsAt,
    multiDayConfig: shiftedConfig as Prisma.InputJsonValue
  };
}
