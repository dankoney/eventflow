import { EventScheduleMode, type Prisma } from "@prisma/client";
import { z } from "zod";

export const VIRTUAL_LINK_MODES = ["SHARED", "PER_DAY"] as const;
export type VirtualLinkMode = (typeof VIRTUAL_LINK_MODES)[number];

export const REGISTRATION_POLICIES = ["OPEN_UNTIL_EVENT_END", "FIRST_DAY_ONLY"] as const;
export type RegistrationPolicy = (typeof REGISTRATION_POLICIES)[number];

export const CHECK_IN_POLICIES = ["ONCE_FOR_EVENT", "EACH_DAY"] as const;
export type CheckInPolicy = (typeof CHECK_IN_POLICIES)[number];

/** Same local calendar date (session must not span midnight into another day). */
export function isSameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const dayRowSchema = z.object({
  dayIndex: z.number().int().min(1).max(31),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  zoomJoinUrl: z.string().url().optional().nullable(),
  zoomMeetingId: z.string().optional().nullable(),
  zoomPasscode: z.string().optional().nullable()
});

export const multiDayConfigSchema = z
  .object({
    version: z.literal(1),
    days: z.array(dayRowSchema).min(2).max(14),
    virtualLinkMode: z.enum(VIRTUAL_LINK_MODES),
    registrationPolicy: z.enum(REGISTRATION_POLICIES),
    checkInPolicy: z.enum(CHECK_IN_POLICIES),
    /** Show full day-by-day agenda on public registration page. */
    showDayAgendaPublic: z.boolean().optional().default(true),
    /** Allow staff check-in outside the active daily session window (multi-day only). */
    allowStaffCheckInOutsideSession: z.boolean().optional().default(false)
  })
  .superRefine((cfg, ctx) => {
    const seen = new Set<number>();
    for (const d of cfg.days) {
      if (seen.has(d.dayIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each day must have a unique day number.",
          path: ["days"]
        });
        break;
      }
      seen.add(d.dayIndex);
    }
    const sorted = [...cfg.days].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].endsAt.getTime() <= sorted[i].startsAt.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Day ${sorted[i].dayIndex}: end must be after start.`,
          path: ["days"]
        });
      }
      if (!isSameLocalCalendarDay(sorted[i].startsAt, sorted[i].endsAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Day ${sorted[i].dayIndex}: each session must start and end on the same calendar day (no multi-day slice).`,
          path: ["days"]
        });
      }
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startsAt.getTime() < sorted[i - 1].endsAt.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each day must start on or after the previous day ends (no overlapping sessions).",
          path: ["days"]
        });
        break;
      }
    }
  });

export type MultiDayConfig = z.infer<typeof multiDayConfigSchema>;

export function parseMultiDayConfig(raw: unknown): MultiDayConfig | null {
  const r = multiDayConfigSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export function isMultiDaySchedule(
  scheduleMode: EventScheduleMode,
  multiDayConfig: Prisma.JsonValue | null | undefined
): boolean {
  return scheduleMode === "MULTI_DAY" && multiDayConfig != null;
}

export function getParsedMultiDayOrNull(
  scheduleMode: EventScheduleMode,
  multiDayConfig: Prisma.JsonValue | null | undefined
): MultiDayConfig | null {
  if (!isMultiDaySchedule(scheduleMode, multiDayConfig)) return null;
  return parseMultiDayConfig(multiDayConfig);
}

/** First / last session bounds (same as event.date / event.endDate when saved correctly). */
export function multiDaySpan(cfg: MultiDayConfig): { startsAt: Date; endsAt: Date } {
  const sorted = [...cfg.days].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return { startsAt: sorted[0].startsAt, endsAt: sorted[sorted.length - 1].endsAt };
}

export function isNowWithinAnySessionDay(cfg: MultiDayConfig, now = new Date()): boolean {
  const t = now.getTime();
  for (const d of cfg.days) {
    if (t >= d.startsAt.getTime() && t <= d.endsAt.getTime()) return true;
  }
  return false;
}

/** Active session day index (1-based), or null if in a gap or before/after the conference. */
export function resolveActiveSessionDayIndex(cfg: MultiDayConfig, now = new Date()): number | null {
  const t = now.getTime();
  for (const d of cfg.days) {
    if (t >= d.startsAt.getTime() && t <= d.endsAt.getTime()) return d.dayIndex;
  }
  return null;
}

export function isPublicSelfRegistrationOpen(
  scheduleMode: EventScheduleMode,
  multiDayConfig: Prisma.JsonValue | null | undefined,
  now = new Date()
): boolean {
  const cfg = getParsedMultiDayOrNull(scheduleMode, multiDayConfig);
  if (!cfg) return true;
  if (cfg.registrationPolicy === "OPEN_UNTIL_EVENT_END") return true;
  const sorted = [...cfg.days].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const first = sorted[0];
  return now.getTime() <= first.endsAt.getTime();
}

export type CheckInWindowResult =
  | { ok: true; dayIndex: number }
  | { ok: false; error: string };

export function resolveCheckInDayIndexForEvent(
  scheduleMode: EventScheduleMode,
  multiDayConfig: Prisma.JsonValue | null | undefined,
  now = new Date()
): CheckInWindowResult {
  const cfg = getParsedMultiDayOrNull(scheduleMode, multiDayConfig);
  if (!cfg) {
    return { ok: true, dayIndex: 1 };
  }
  if (cfg.checkInPolicy === "ONCE_FOR_EVENT") {
    return { ok: true, dayIndex: 1 };
  }
  const active = resolveActiveSessionDayIndex(cfg, now);
  if (active != null) {
    return { ok: true, dayIndex: active };
  }
  if (cfg.allowStaffCheckInOutsideSession) {
    const sorted = [...cfg.days].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const spanStart = sorted[0].startsAt.getTime();
    const spanEnd = sorted[sorted.length - 1].endsAt.getTime();
    const t = now.getTime();
    if (t >= spanStart && t <= spanEnd) {
      let fallback = 1;
      for (const d of sorted) {
        if (t >= d.startsAt.getTime()) fallback = d.dayIndex;
      }
      return { ok: true, dayIndex: fallback };
    }
  }
  return {
    ok: false,
    error: "Check-in for this event is only available during scheduled daily session hours."
  };
}

export function getPerDayZoomJoinUrl(cfg: MultiDayConfig, dayIndex: number): string | null {
  const row = cfg.days.find((d) => d.dayIndex === dayIndex);
  const u = row?.zoomJoinUrl?.trim();
  return u || null;
}

export function eventHasVirtualJoinFromConfig(params: {
  virtualCapacity: number;
  scheduleMode: EventScheduleMode;
  multiDayConfig: Prisma.JsonValue | null | undefined;
  zoomJoinUrl: string | null;
  zoomMeetingId: string | null;
}): boolean {
  if (params.virtualCapacity <= 0) return false;
  const cfg = getParsedMultiDayOrNull(params.scheduleMode, params.multiDayConfig);
  if (!cfg) {
    return Boolean(params.zoomMeetingId || params.zoomJoinUrl?.trim());
  }
  if (cfg.virtualLinkMode === "SHARED") {
    return Boolean(params.zoomJoinUrl?.trim() || params.zoomMeetingId);
  }
  return cfg.days.every((d) => Boolean(d.zoomJoinUrl?.trim()));
}

export function initialGuestVirtualJoinUrl(params: {
  scheduleMode: EventScheduleMode;
  multiDayConfig: Prisma.JsonValue | null | undefined;
  eventZoomJoinUrl: string | null;
}): string | null {
  const cfg = getParsedMultiDayOrNull(params.scheduleMode, params.multiDayConfig);
  if (!cfg || cfg.virtualLinkMode === "SHARED") {
    return params.eventZoomJoinUrl?.trim() || null;
  }
  const sorted = [...cfg.days].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return sorted[0]?.zoomJoinUrl?.trim() || null;
}
