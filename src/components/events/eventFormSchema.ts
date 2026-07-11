import {
  AttendeeTheme,
  PublicPageTemplate,
  EventScheduleMode,
  EventType,
  ZoomSessionKind
} from "@prisma/client";
import { z } from "zod";

import { coerceDate } from "@/lib/utils";

import {
  CHECK_IN_POLICIES,
  isSameLocalCalendarDay,
  REGISTRATION_POLICIES,
  VIRTUAL_LINK_MODES
} from "@/lib/event-schedule/multiDayConfig";
import { validateZoomPasscode } from "@/lib/zoom/passcode";

export type EventLocationOption = {
  id: string;
  name: string;
  address: string;
  capacity: number;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  facilityImageUrl?: string | null;
  googlePlaceId?: string | null;
};

export function defaultStartDate(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  d.setMinutes(0, 0, 0);
  return d;
}

export function defaultEndFromStart(start: Date): Date {
  return new Date(start.getTime() + 2 * 60 * 60 * 1000);
}

const multiDayDayFormSchema = z.object({
  startsAt: z.date(),
  endsAt: z.date(),
  zoomJoinUrl: z.string().optional().nullable()
});

export const eventFormSchema = z
  .object({
    name: z.string().min(2, "Name is required"),
    description: z.string().trim().max(50000),
    date: z.date({ required_error: "Start date is required" }),
    endDate: z.date({ required_error: "End date is required" }),
    locationId: z.string().min(1, "Choose a venue"),
    capacity: z.coerce.number().int().min(1),
    enableVirtual: z.boolean(),
    virtualCapacity: z.coerce.number().int().min(0),
    type: z.nativeEnum(EventType),
    scheduleMode: z.nativeEnum(EventScheduleMode),
    multiDayDays: z.array(multiDayDayFormSchema),
    multiDayVirtualLinkMode: z.enum(VIRTUAL_LINK_MODES),
    multiDayRegistrationPolicy: z.enum(REGISTRATION_POLICIES),
    multiDayCheckInPolicy: z.enum(CHECK_IN_POLICIES),
    multiDayShowAgendaPublic: z.boolean(),
    multiDayAllowStaffCheckInOutsideSession: z.boolean(),
    historicalMode: z.boolean(),
    reminderPrimaryEnabled: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderPrimaryHoursBefore: z.coerce.number().refine((n) => [24, 48, 72].includes(n), "Pick 24, 48, or 72 hours"),
    reminderPrimaryEmail: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderPrimaryWhatsapp: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderPrimarySms: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderFinalEnabled: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderFinalHoursBefore: z.coerce.number().refine((n) => [1, 2, 5].includes(n), "Pick 1, 2, or 5 hours"),
    reminderFinalWhatsapp: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderFinalSms: z.preprocess((v) => v === true || v === "on", z.boolean()),
    zoomSessionKind: z.nativeEnum(ZoomSessionKind),
    zoomPasscodeMode: z.enum(["default", "custom"]).default("default"),
    zoomCustomPasscode: z.string().max(10).optional(),
    bannerImageUrl: z.string().optional(),
    brandLogoUrl: z.string().optional(),
    attendeeTheme: z.nativeEnum(AttendeeTheme),
    publicPageTemplate: z.nativeEnum(PublicPageTemplate),
    brandPrimaryColor: z.string().optional()
  })
  .superRefine((data, ctx) => {
    const requireHttps = (raw: string | undefined, path: "bannerImageUrl" | "brandLogoUrl") => {
      const t = raw?.trim();
      if (!t) return;
      if (path === "bannerImageUrl" && t.startsWith("/uploads/")) {
        if (t.includes("..") || t.length > 500) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "Invalid uploaded banner path" });
        }
        return;
      }
      if (path === "brandLogoUrl" && t.startsWith("/uploads/")) {
        if (t.includes("..") || t.length > 500) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "Invalid uploaded logo path" });
        }
        return;
      }
      try {
        const u = new URL(t);
        if (u.protocol !== "https:") {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "URL must use https://" });
        }
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "Enter a valid https URL" });
      }
    };
    requireHttps(data.bannerImageUrl, "bannerImageUrl");
    requireHttps(data.brandLogoUrl, "brandLogoUrl");
    const hex = data.brandPrimaryColor?.trim();
    if (hex && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["brandPrimaryColor"],
        message: "Use a hex color like #0f172a or #333"
      });
    }
    if (!data.historicalMode && data.date.getTime() < Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Event date must be in the future unless Historical mode is enabled.",
        path: ["date"]
      });
    }
    if (data.endDate.getTime() <= data.date.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Program end must be after program start.",
        path: ["endDate"]
      });
    }
    if (data.enableVirtual && data.virtualCapacity < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set virtual capacity to at least 1 or turn off virtual.",
        path: ["virtualCapacity"]
      });
    }
    if (data.scheduleMode === EventScheduleMode.MULTI_DAY) {
      if (data.multiDayDays.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Add at least two session rows (use Add day for weekly or skip patterns).",
          path: ["multiDayDays"]
        });
      }
      data.multiDayDays.forEach((d, i) => {
        if (d.endsAt.getTime() <= d.startsAt.getTime()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Session end must be after session start.",
            path: ["multiDayDays", i, "endsAt"]
          });
        }
        if (!isSameLocalCalendarDay(d.startsAt, d.endsAt)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each session must start and end on the same calendar day.",
            path: ["multiDayDays", i, "endsAt"]
          });
        }
      });
      const virtualRequired = data.type === EventType.VIRTUAL || data.type === EventType.HYBRID || data.enableVirtual;
      if (virtualRequired && data.multiDayVirtualLinkMode === "PER_DAY") {
        data.multiDayDays.forEach((d, i) => {
          const u = d.zoomJoinUrl?.trim();
          if (!u) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Join URL required for each day when using per-day Zoom.",
              path: ["multiDayDays", i, "zoomJoinUrl"]
            });
          } else {
            try {
              // eslint-disable-next-line no-new
              new URL(u);
            } catch {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Enter a valid URL.",
                path: ["multiDayDays", i, "zoomJoinUrl"]
              });
            }
          }
        });
      }
    }
    const virtualRequired = data.type === EventType.VIRTUAL || data.type === EventType.HYBRID || data.enableVirtual;
    if (virtualRequired && data.zoomPasscodeMode === "custom") {
      const check = validateZoomPasscode(data.zoomCustomPasscode ?? "");
      if (!check.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.message,
          path: ["zoomCustomPasscode"]
        });
      }
    }
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;

/** Organization-level defaults for new events (Settings → General). */
export type OrgEventFormDefaults = {
  defaultBannerImageUrl?: string | null;
  defaultBrandLogoUrl?: string | null;
  defaultAttendeeTheme?: AttendeeTheme;
  defaultPublicPageTemplate?: PublicPageTemplate;
  defaultBrandPrimaryColor?: string | null;
  defaultVirtualCapacity?: number;
  defaultZoomSessionKind?: ZoomSessionKind;
};

export function orgRecordToEventFormDefaults(
  org: {
    defaultEventBannerImageUrl: string | null;
    defaultEventBrandLogoUrl: string | null;
    defaultEventAttendeeTheme: AttendeeTheme;
    defaultEventPublicPageTemplate: PublicPageTemplate;
    defaultEventBrandPrimaryColor: string | null;
    defaultEventVirtualCapacity: number;
    defaultZoomSessionKind: ZoomSessionKind;
  } | null
): OrgEventFormDefaults | null {
  if (!org) return null;
  return {
    defaultBannerImageUrl: org.defaultEventBannerImageUrl,
    defaultBrandLogoUrl: org.defaultEventBrandLogoUrl,
    defaultAttendeeTheme: org.defaultEventAttendeeTheme,
    defaultPublicPageTemplate: org.defaultEventPublicPageTemplate,
    defaultBrandPrimaryColor: org.defaultEventBrandPrimaryColor,
    defaultVirtualCapacity: org.defaultEventVirtualCapacity,
    defaultZoomSessionKind: org.defaultZoomSessionKind
  };
}

function capacityForLocation(locations: EventLocationOption[], locationId: string): number {
  const loc = locations.find((l) => l.id === locationId);
  return loc?.capacity ?? 50;
}

export function getEventFormDefaultValues(
  locations: EventLocationOption[],
  partial?: Partial<EventFormValues>,
  orgDefaults?: OrgEventFormDefaults | null
): EventFormValues {
  const initialStart = partial?.date ? coerceDate(partial.date) : defaultStartDate();
  const locationId = partial?.locationId ?? locations[0]?.id ?? "";
  const venueCap = capacityForLocation(locations, locationId);
  const virtualDefault = orgDefaults?.defaultVirtualCapacity ?? 100;
  const zoomDefault = orgDefaults?.defaultZoomSessionKind ?? ZoomSessionKind.MEETING;
  return {
    name: partial?.name ?? "",
    description: partial?.description ?? "",
    date: initialStart,
    endDate: partial?.endDate ? coerceDate(partial.endDate) : defaultEndFromStart(initialStart),
    locationId,
    capacity: partial?.capacity !== undefined ? partial.capacity : venueCap,
    enableVirtual: partial?.enableVirtual ?? false,
    virtualCapacity: partial?.virtualCapacity !== undefined ? partial.virtualCapacity : virtualDefault,
    type: partial?.type ?? EventType.IN_PERSON,
    scheduleMode: partial?.scheduleMode ?? EventScheduleMode.SINGLE_BLOCK,
    multiDayDays: (partial?.multiDayDays ?? []).map((day) => ({
      ...day,
      startsAt: coerceDate(day.startsAt),
      endsAt: coerceDate(day.endsAt)
    })),
    multiDayVirtualLinkMode: partial?.multiDayVirtualLinkMode ?? "SHARED",
    multiDayRegistrationPolicy: partial?.multiDayRegistrationPolicy ?? "OPEN_UNTIL_EVENT_END",
    multiDayCheckInPolicy: partial?.multiDayCheckInPolicy ?? "ONCE_FOR_EVENT",
    multiDayShowAgendaPublic: partial?.multiDayShowAgendaPublic ?? true,
    multiDayAllowStaffCheckInOutsideSession: partial?.multiDayAllowStaffCheckInOutsideSession ?? false,
    historicalMode: partial?.historicalMode ?? false,
    reminderPrimaryEnabled: partial?.reminderPrimaryEnabled ?? true,
    reminderPrimaryHoursBefore: partial?.reminderPrimaryHoursBefore ?? 24,
    reminderPrimaryEmail: partial?.reminderPrimaryEmail ?? true,
    reminderPrimaryWhatsapp: partial?.reminderPrimaryWhatsapp ?? false,
    reminderPrimarySms: partial?.reminderPrimarySms ?? false,
    reminderFinalEnabled: partial?.reminderFinalEnabled ?? true,
    reminderFinalHoursBefore: partial?.reminderFinalHoursBefore ?? 2,
    reminderFinalWhatsapp: partial?.reminderFinalWhatsapp ?? true,
    reminderFinalSms: partial?.reminderFinalSms ?? false,
    zoomSessionKind: partial?.zoomSessionKind ?? zoomDefault,
    zoomPasscodeMode: partial?.zoomPasscodeMode ?? "default",
    zoomCustomPasscode: partial?.zoomCustomPasscode ?? "",
    bannerImageUrl: partial?.bannerImageUrl ?? orgDefaults?.defaultBannerImageUrl?.trim() ?? "",
    brandLogoUrl: partial?.brandLogoUrl ?? orgDefaults?.defaultBrandLogoUrl?.trim() ?? "",
    attendeeTheme: partial?.attendeeTheme ?? orgDefaults?.defaultAttendeeTheme ?? AttendeeTheme.SYSTEM,
    publicPageTemplate:
      partial?.publicPageTemplate ??
      orgDefaults?.defaultPublicPageTemplate ??
      PublicPageTemplate.SUMMIT,
    brandPrimaryColor: partial?.brandPrimaryColor ?? orgDefaults?.defaultBrandPrimaryColor?.trim() ?? ""
  };
}
