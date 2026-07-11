import { AttendeeTheme, EventScheduleMode, EventType, PublicPageTemplate, ZoomSessionKind } from "@prisma/client";

/** Shape produced by EventForm / wizard before server Zod validation. */
export type EventFormLikePayload = {
  name: string;
  description?: string;
  date: Date;
  endDate: Date;
  locationId: string;
  capacity: number;
  enableVirtual: boolean;
  virtualCapacity: number;
  type: EventType;
  scheduleMode: EventScheduleMode;
  multiDayDays: Array<{
    startsAt: Date;
    endsAt: Date;
    zoomJoinUrl?: string | null;
  }>;
  multiDayVirtualLinkMode: "SHARED" | "PER_DAY";
  multiDayRegistrationPolicy: "OPEN_UNTIL_EVENT_END" | "FIRST_DAY_ONLY";
  multiDayCheckInPolicy: "ONCE_FOR_EVENT" | "EACH_DAY";
  multiDayShowAgendaPublic: boolean;
  multiDayAllowStaffCheckInOutsideSession: boolean;
  reminderPrimaryEnabled: boolean;
  reminderPrimaryHoursBefore: number;
  reminderPrimaryEmail: boolean;
  reminderPrimaryWhatsapp: boolean;
  reminderPrimarySms: boolean;
  reminderFinalEnabled: boolean;
  reminderFinalHoursBefore: number;
  reminderFinalWhatsapp: boolean;
  reminderFinalSms: boolean;
  zoomSessionKind: ZoomSessionKind;
  zoomPasscodeMode?: "default" | "custom";
  zoomCustomPasscode?: string;
  bannerImageUrl?: string;
  brandLogoUrl?: string;
  attendeeTheme?: AttendeeTheme;
  publicPageTemplate?: PublicPageTemplate;
  brandPrimaryColor?: string;
};

/** Builds the payload expected by `createEvent` / `updateEvent` from form-like values. */
export function buildCreateEventPayload(values: EventFormLikePayload) {
  const virtualRequired = values.type === EventType.VIRTUAL || values.type === EventType.HYBRID;
  const effectiveEnableVirtual = virtualRequired ? true : values.enableVirtual;
  const virtualCapacity = effectiveEnableVirtual ? Math.max(1, values.virtualCapacity) : 0;

  const multiDayConfig =
    values.scheduleMode === EventScheduleMode.MULTI_DAY
      ? {
          version: 1 as const,
          days: values.multiDayDays.map((d, i) => ({
            dayIndex: i + 1,
            startsAt: d.startsAt,
            endsAt: d.endsAt,
            zoomJoinUrl: d.zoomJoinUrl?.trim() || null,
            zoomMeetingId: null,
            zoomPasscode: null
          })),
          virtualLinkMode: values.multiDayVirtualLinkMode,
          registrationPolicy: values.multiDayRegistrationPolicy,
          checkInPolicy: values.multiDayCheckInPolicy,
          showDayAgendaPublic: values.multiDayShowAgendaPublic,
          allowStaffCheckInOutsideSession: values.multiDayAllowStaffCheckInOutsideSession
        }
      : null;

  return {
    name: values.name,
    description: values.description || undefined,
    date: values.date,
    endDate: values.endDate,
    locationId: values.locationId,
    capacity: values.capacity,
    virtualCapacity,
    type: values.type,
    scheduleMode: values.scheduleMode,
    multiDayConfig,
    reminderPrimaryEnabled: values.reminderPrimaryEnabled,
    reminderPrimaryHoursBefore: values.reminderPrimaryHoursBefore as 24 | 48 | 72,
    reminderPrimaryEmail: values.reminderPrimaryEmail,
    reminderPrimaryWhatsapp: values.reminderPrimaryWhatsapp,
    reminderPrimarySms: values.reminderPrimarySms,
    reminderFinalEnabled: values.reminderFinalEnabled,
    reminderFinalHoursBefore: values.reminderFinalHoursBefore as 1 | 2 | 5,
    reminderFinalWhatsapp: values.reminderFinalWhatsapp,
    reminderFinalSms: values.reminderFinalSms,
    zoomSessionKind: values.zoomSessionKind,
    zoomPasscodeMode: values.zoomPasscodeMode ?? "default",
    zoomCustomPasscode:
      values.zoomPasscodeMode === "custom" ? values.zoomCustomPasscode?.trim() || null : null,
    bannerImageUrl: values.bannerImageUrl?.trim() || null,
    brandLogoUrl: values.brandLogoUrl?.trim() || null,
    attendeeTheme: values.attendeeTheme,
    publicPageTemplate: values.publicPageTemplate,
    brandPrimaryColor: values.brandPrimaryColor?.trim() || null
  };
}
