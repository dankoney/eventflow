"use server";

import {
  AttendeeTheme,
  EventBlueprintTemplate,
  EventScheduleMode,
  EventStatus,
  EventType,
  GuestStatus,
  InternalStaffCheckInMode,
  InternalStaffEmailTemplateKind,
  InternalStaffNoticeKind,
  InternalStaffMealMenuScope,
  InternalStaffSmsTemplateKind,
  Prisma,
  PublicPageTemplate,
  Role,
  ZoomSessionKind
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { sendEventReminderEmail } from "@/lib/email";
import {
  assertCanCreateActiveEvent,
  assertCanUseVirtualishEvent,
  VIRTUALISH_EVENT_TYPES
} from "@/lib/billing/planLimits";
import { getOrgPlanForLimits, requireBillingCapability } from "@/lib/db/billing";
import {
  compileStaffNoticeEmailTemplateHtml,
  renderStaffNoticeEmailFromTemplate
} from "@/lib/email/compileStaffNoticeEmail";
import {
  resolveStaffNoticeMergeValues,
  sampleStaffNoticeMergeValues
} from "@/lib/email/staffNoticeMergeValues";
import { prisma } from "@/lib/prisma";
import { kickReminderEvaluationForEvent } from "@/lib/reminders/dispatch";
import { formatDate, formatLocationLine } from "@/lib/utils";
import { phoneToMnotifyRecipient, sendOrgMnotifyQuickSms } from "@/lib/mnotify";
import { sendOrgWhatsAppText } from "@/lib/whatsapp";
import {
  getParsedMultiDayOrNull,
  multiDayConfigSchema,
  multiDaySpan,
  type MultiDayConfig
} from "@/lib/event-schedule/multiDayConfig";
import { shiftClonedEventSchedule } from "@/lib/event-schedule/cloneDates";
import { actionErrorForField } from "@/lib/errors/actionFieldError";
import { formatPrismaWriteError } from "@/lib/errors/prisma";
import { validateZoomPasscode, zoomPasscodeForApi } from "@/lib/zoom/passcode";
import { createZoomVirtualSession } from "@/lib/zoom";
import {
  parseRegistrationProfile,
  registrationProfileSchema
} from "@/lib/event-wizard/registrationProfile";
import { resourceLinksPayloadSchema } from "@/lib/event-wizard/resourceLinks";
import {
  internalStaffAudienceForPrisma,
  internalStaffAudienceSchema,
  normalizeAudienceJson
} from "@/lib/internalStaff/audience";
import {
  internalStaffMealMenusByBranchPayloadSchema,
  parseInternalStaffMealMenuItems,
  parseInternalStaffMealMenusByBranch
} from "@/lib/internalStaff/mealMenu";
import { insertContactGuestsFromDirectory } from "@/lib/internalStaff/bulkGuestsFromContacts";
import { sendPendingOrganizerInvitesForEvent } from "@/lib/actions/guest.actions";
import { listOrgContactsMatchingAudience } from "@/lib/internalStaff/resolveContactsForAudience";
import { dispatchInternalStaffRosterNotices } from "@/lib/internalStaff/dispatchPersonalCheckInLinks";
import { stripLegacyMeetingRoomMarkers } from "@/lib/internalStaff/noticeCopy";
import {
  resyncInternalStaffGuestsForEvent,
  type ResyncInternalStaffGuestsResult
} from "@/lib/internalStaff/resyncInternalStaffGuests";
import { ActionResult, Event } from "@/types";

async function revalidateOrgCommandCenterForOrgId(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { slug: true } });
  if (org?.slug) {
    revalidatePath(`/o/${org.slug}`);
  }
}

const primaryHoursSchema = z.union([z.literal(24), z.literal(48), z.literal(72)]);
const finalHoursSchema = z.union([z.literal(1), z.literal(2), z.literal(5)]);

const eventSchema = z
  .object({
    name: z.string().min(2),
    description: z.string().optional().nullable(),
    date: z.coerce.date(),
    endDate: z.coerce.date(),
    locationId: z.string().min(1, "Choose a venue"),
    capacity: z.coerce.number().int().min(1),
    virtualCapacity: z.coerce.number().int().min(0),
    type: z.nativeEnum(EventType),
    status: z.nativeEnum(EventStatus).optional(),
    scheduleMode: z.nativeEnum(EventScheduleMode).optional(),
    multiDayConfig: z.unknown().optional().nullable(),
    reminderPrimaryEnabled: z.boolean(),
    reminderPrimaryHoursBefore: primaryHoursSchema,
    reminderPrimaryEmail: z.boolean(),
    reminderPrimaryWhatsapp: z.boolean(),
    reminderPrimarySms: z.boolean(),
    reminderFinalEnabled: z.boolean(),
    reminderFinalHoursBefore: finalHoursSchema,
    reminderFinalWhatsapp: z.boolean(),
    reminderFinalSms: z.boolean(),
    zoomSessionKind: z.nativeEnum(ZoomSessionKind).default(ZoomSessionKind.WEBINAR),
    /** `custom` sends `zoomCustomPasscode` to Zoom; `default` lets Zoom assign. */
    zoomPasscodeMode: z.enum(["default", "custom"]).optional(),
    zoomCustomPasscode: z.string().max(10).optional().nullable(),
    blueprintTemplate: z.nativeEnum(EventBlueprintTemplate).optional(),
    allowPublicRegistration: z.boolean().optional(),
    /** Command Center walk-ins (`/o/[slug]/…/enter`) when email is not on guest list or CRM. */
    allowFlashEntry: z.boolean().optional(),
    registrationProfile: z.unknown().optional(),
    accommodationTravelNotes: z.string().max(50000).optional().nullable(),
    resourceLinks: z.unknown().optional(),
    internalStaffAudience: z.unknown().optional().nullable(),
    internalStaffCheckInMode: z.nativeEnum(InternalStaffCheckInMode).optional(),
    internalStaffNoticeKind: z.nativeEnum(InternalStaffNoticeKind).optional(),
    internalStaffNoticeTo: z.string().max(240).optional().nullable(),
    internalStaffNoticeFrom: z.string().max(240).optional().nullable(),
    internalStaffNoticeCc: z.string().max(240).optional().nullable(),
    internalStaffNoticeContext: z.string().max(50000).optional().nullable(),
    internalStaffNoticeSubject: z.string().max(500).optional().nullable(),
    internalStaffMeetingRoom: z.string().max(240).optional().nullable(),
    internalStaffEmailTemplateKind: z.nativeEnum(InternalStaffEmailTemplateKind).optional(),
    internalStaffSmsTemplateKind: z.nativeEnum(InternalStaffSmsTemplateKind).optional(),
    internalStaffSmsCustomText: z.string().max(2000).optional().nullable(),
    internalStaffEmailMailyJson: z.record(z.unknown()).optional().nullable(),
    bannerImageUrl: z.string().max(2048).optional().nullable(),
    brandLogoUrl: z.string().max(2048).optional().nullable(),
    attendeeTheme: z.nativeEnum(AttendeeTheme).optional(),
    publicPageTemplate: z.nativeEnum(PublicPageTemplate).optional(),
    brandPrimaryColor: z.string().max(32).optional().nullable()
  })
  .superRefine((data, ctx) => {
    const optHttps = (url: string | null | undefined, path: "bannerImageUrl" | "brandLogoUrl") => {
      const t = typeof url === "string" ? url.trim() : "";
      if (!t) return;
      if (path === "bannerImageUrl" && t.startsWith("/uploads/")) {
        if (t.includes("..") || t.length > 500) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [path],
            message: "Invalid uploaded banner path"
          });
        }
        return;
      }
      if (path === "brandLogoUrl" && t.startsWith("/uploads/")) {
        if (t.includes("..") || t.length > 500) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [path],
            message: "Invalid uploaded logo path"
          });
        }
        return;
      }
      try {
        const u = new URL(t);
        if (u.protocol !== "https:") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [path],
            message: "Image URL must use https://"
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: "Enter a valid https URL"
        });
      }
    };
    optHttps(data.bannerImageUrl, "bannerImageUrl");
    optHttps(data.brandLogoUrl, "brandLogoUrl");
    const hex = typeof data.brandPrimaryColor === "string" ? data.brandPrimaryColor.trim() : "";
    if (hex && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["brandPrimaryColor"],
        message: "Use a hex color like #0f172a or #333"
      });
    }
    if ((data.type === EventType.VIRTUAL || data.type === EventType.HYBRID) && data.virtualCapacity < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["virtualCapacity"],
        message: "Virtual and Hybrid events must have virtual capacity of at least 1."
      });
    }
    if (data.type === EventType.IN_PERSON && data.virtualCapacity > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["type"],
        message: "Set event type to Hybrid or Virtual when virtual capacity is enabled."
      });
    }
    const scheduleMode = data.scheduleMode ?? EventScheduleMode.SINGLE_BLOCK;
    if (data.endDate.getTime() <= data.date.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Program end must be after program start."
      });
    }
    if (scheduleMode !== EventScheduleMode.SINGLE_BLOCK) {
      const parsedCfg = multiDayConfigSchema.safeParse(data.multiDayConfig);
      if (!parsedCfg.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["multiDayConfig"],
          message: parsedCfg.error.issues.map((i) => i.message).join("; ")
        });
        return;
      }
      const cfg = parsedCfg.data;
      if (data.virtualCapacity > 0 && cfg.virtualLinkMode === "PER_DAY" && data.zoomSessionKind === ZoomSessionKind.WEBINAR) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["zoomSessionKind"],
          message: "Per-day Zoom links require Meeting mode. Webinars use a single Zoom registration."
        });
      }
      if (data.virtualCapacity > 0 && cfg.virtualLinkMode === "PER_DAY") {
        for (let i = 0; i < cfg.days.length; i++) {
          if (!cfg.days[i].zoomJoinUrl?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["multiDayConfig"],
              message: `Per-day Zoom requires a join URL for day ${cfg.days[i]?.dayIndex ?? i + 1}.`
            });
            break;
          }
        }
      }
    }
  });

function resolvedSchedulePayload(data: z.infer<typeof eventSchema>): {
  date: Date;
  endDate: Date;
  scheduleMode: EventScheduleMode;
  multiDayConfig: MultiDayConfig | null;
} {
  const scheduleMode = data.scheduleMode ?? EventScheduleMode.SINGLE_BLOCK;
  if (scheduleMode === EventScheduleMode.SINGLE_BLOCK) {
    return { date: data.date, endDate: data.endDate, scheduleMode, multiDayConfig: null };
  }
  const cfg = multiDayConfigSchema.parse(data.multiDayConfig);
  const span = multiDaySpan(cfg);
  return { date: span.startsAt, endDate: span.endsAt, scheduleMode, multiDayConfig: cfg };
}

function shouldCreateOrgZoomSession(
  virtualCapacity: number,
  scheduleMode: EventScheduleMode,
  multiDayConfig: MultiDayConfig | null
): boolean {
  if (virtualCapacity <= 0) return false;
  if (scheduleMode === EventScheduleMode.SINGLE_BLOCK) return true;
  return multiDayConfig?.virtualLinkMode === "SHARED";
}

function prismaJsonForMultiDayConfig(config: MultiDayConfig | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (config === null) return Prisma.JsonNull;
  return config as Prisma.InputJsonValue;
}

/** Copy optional JSON columns from a source event row when cloning. */
function prismaCloneJsonField(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function blueprintPayloadForPrisma(data: z.infer<typeof eventSchema>) {
  const template = data.blueprintTemplate ?? EventBlueprintTemplate.BLANK;
  const allowPublicRegistration = data.allowPublicRegistration ?? true;
  const regParsed = registrationProfileSchema.safeParse(data.registrationProfile);
  const registrationProfile = regParsed.success ? (regParsed.data as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
  const resParsed = resourceLinksPayloadSchema.safeParse(data.resourceLinks);
  const resourceLinks =
    resParsed.success && resParsed.data.length > 0 ? (resParsed.data as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
  const internalStaffAudience =
    template === EventBlueprintTemplate.INTERNAL_STAFF
      ? (internalStaffAudienceForPrisma(template, data.internalStaffAudience) as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;
  const internalStaffCheckInMode =
    template === EventBlueprintTemplate.INTERNAL_STAFF
      ? (data.internalStaffCheckInMode ?? InternalStaffCheckInMode.PERSONAL_LINK)
      : InternalStaffCheckInMode.PERSONAL_LINK;
  const internalStaffEmailTemplateKind =
    template === EventBlueprintTemplate.INTERNAL_STAFF
      ? (data.internalStaffEmailTemplateKind ?? InternalStaffEmailTemplateKind.MEMORANDUM)
      : InternalStaffEmailTemplateKind.MEMORANDUM;
  const internalStaffSmsTemplateKind =
    template === EventBlueprintTemplate.INTERNAL_STAFF
      ? (data.internalStaffSmsTemplateKind ?? InternalStaffSmsTemplateKind.STANDARD)
      : InternalStaffSmsTemplateKind.STANDARD;
  const internalStaffNoticeKind =
    template === EventBlueprintTemplate.INTERNAL_STAFF
      ? (data.internalStaffNoticeKind ?? InternalStaffNoticeKind.TRAINING)
      : InternalStaffNoticeKind.TRAINING;
  const allowFlashEntryDefault = true;
  return {
    blueprintTemplate: template,
    allowPublicRegistration,
    allowFlashEntry: data.allowFlashEntry ?? allowFlashEntryDefault,
    registrationProfile,
    accommodationTravelNotes: data.accommodationTravelNotes?.trim() || null,
    resourceLinks,
    internalStaffAudience,
    internalStaffCheckInMode,
    internalStaffEmailTemplateKind,
    internalStaffSmsTemplateKind,
    internalStaffSmsCustomText:
      template === EventBlueprintTemplate.INTERNAL_STAFF
        ? data.internalStaffSmsCustomText?.trim() || null
        : null,
    internalStaffEmailMailyJson:
      template === EventBlueprintTemplate.INTERNAL_STAFF && data.internalStaffEmailMailyJson
        ? (data.internalStaffEmailMailyJson as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    internalStaffNoticeKind,
    internalStaffNoticeTo:
      template === EventBlueprintTemplate.INTERNAL_STAFF
        ? data.internalStaffNoticeTo?.trim() || null
        : null,
    internalStaffNoticeFrom:
      template === EventBlueprintTemplate.INTERNAL_STAFF
        ? data.internalStaffNoticeFrom?.trim() || null
        : null,
    internalStaffNoticeCc:
      template === EventBlueprintTemplate.INTERNAL_STAFF ? data.internalStaffNoticeCc?.trim() || null : null,
    internalStaffNoticeContext:
      template === EventBlueprintTemplate.INTERNAL_STAFF
        ? stripLegacyMeetingRoomMarkers(data.internalStaffNoticeContext) || null
        : null,
    internalStaffNoticeSubject:
      template === EventBlueprintTemplate.INTERNAL_STAFF
        ? data.internalStaffNoticeSubject?.trim() || null
        : null,
    internalStaffMeetingRoom:
      template === EventBlueprintTemplate.INTERNAL_STAFF
        ? data.internalStaffMeetingRoom?.trim() || null
        : null
  };
}

function canCreateEvents(role: Role) {
  return role === "ADMIN" || role === "MARKETING";
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

async function sendBulkNotificationInternal(input: {
  eventId: string;
  orgId: string;
  headline: string;
}) {
  const event = await prisma.event.findFirst({
    where: { id: input.eventId, orgId: input.orgId },
    include: {
      location: true,
      org: { select: { resendApiKey: true } }
    }
  });
  if (!event) return { sent: 0 };

  const guests = await prisma.guest.findMany({
    where: {
      eventId: input.eventId,
      status: { in: [GuestStatus.INVITED, GuestStatus.REGISTERED, GuestStatus.ACCEPTED] }
    },
    select: { name: true, email: true, mode: true, zoomLink: true, qrCode: true }
  });

  let sent = 0;
  const resendApiKeyOverride = event.org.resendApiKey?.trim() || undefined;
  for (const guest of guests) {
    if (!guest.email?.trim()) continue;
    try {
      await sendEventReminderEmail({
        to: guest.email,
        guestName: guest.name,
        eventName: event.name,
        whenLabel: formatDate(event.date),
        locationLabel: formatLocationLine(event.location),
        headline: input.headline,
        zoomLink: guest.mode !== "IN_PERSON" ? guest.zoomLink : undefined,
        qrPayload: guest.mode === "IN_PERSON" ? guest.qrCode : undefined,
        resendApiKeyOverride
      });
      sent += 1;
    } catch {
      // Best effort bulk send. Do not block lifecycle transitions.
    }
  }

  return { sent };
}

async function sendCancellationNotificationsInternal(input: { eventId: string; orgId: string }) {
  const event = await prisma.event.findFirst({
    where: { id: input.eventId, orgId: input.orgId },
    include: {
      location: true,
      org: { select: { resendApiKey: true } }
    }
  });
  if (!event) return { emails: 0, whatsapp: 0, sms: 0 };

  const guests = await prisma.guest.findMany({
    where: {
      eventId: input.eventId,
      status: {
        in: [
          GuestStatus.INVITED,
          GuestStatus.REGISTERED,
          GuestStatus.ACCEPTED,
          GuestStatus.CHECKED_IN,
          GuestStatus.JOINED
        ]
      }
    },
    select: { name: true, email: true, phone: true, mode: true, zoomLink: true, qrCode: true }
  });

  let emails = 0;
  let whatsapp = 0;
  let sms = 0;
  const headline = `Event cancelled: ${event.name}`;
  const resendApiKeyOverride = event.org.resendApiKey?.trim() || undefined;
  const smsBody = `${headline} — ${event.name} was scheduled for ${formatDate(event.date)}. Contact the organizer if you have questions.`.slice(
    0,
    450
  );

  const smsRecipients: string[] = [];
  for (const guest of guests) {
    if (guest.email?.trim()) {
      try {
        await sendEventReminderEmail({
          to: guest.email,
          guestName: guest.name,
          eventName: event.name,
          whenLabel: formatDate(event.date),
          locationLabel: formatLocationLine(event.location),
          headline,
          zoomLink: guest.mode !== "IN_PERSON" ? guest.zoomLink : undefined,
          qrPayload: guest.mode === "IN_PERSON" ? guest.qrCode : undefined,
          resendApiKeyOverride
        });
        emails += 1;
      } catch {
        /* continue */
      }
    }
    if (guest.phone) {
      const digits = guest.phone.replace(/\D/g, "");
      if (digits.length >= 10) {
        const wa = await sendOrgWhatsAppText(
          event.orgId,
          `+${digits}`,
          `${headline} — ${event.name} was scheduled for ${formatDate(event.date)}. Contact the organizer if you have questions.`
        );
        if (wa.ok) whatsapp += 1;
        const m = phoneToMnotifyRecipient(guest.phone);
        if (m) smsRecipients.push(m);
      }
    }
  }

  const uniqueSms = [...new Set(smsRecipients)];
  if (uniqueSms.length > 0) {
    const smsRes = await sendOrgMnotifyQuickSms(event.orgId, uniqueSms, smsBody);
    if (smsRes.ok) sms = smsRes.totalSent ?? uniqueSms.length;
  }

  return { emails, whatsapp, sms };
}

const sendBulkNotificationSchema = z.object({
  eventId: z.string().min(1),
  headline: z.string().min(3).max(180)
});

export async function sendBulkNotification(
  input: z.input<typeof sendBulkNotificationSchema>
): Promise<ActionResult<{ sent: number }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to send bulk notifications." };
  }
  const parsed = sendBulkNotificationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const result = await sendBulkNotificationInternal({
    eventId: parsed.data.eventId,
    orgId: session.user.orgId,
    headline: parsed.data.headline
  });
  return { success: true, data: result };
}

export async function createEvent(
  input: z.input<typeof eventSchema>
): Promise<ActionResult<Event>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to create events." };
  }

  const billing = await requireBillingCapability(session.user.orgId, "create_event");
  if (!billing.ok) return { success: false, error: billing.error };

  const orgPlan = await getOrgPlanForLimits(session.user.orgId);
  if (!orgPlan) return { success: false, error: "Organization not found." };

  const activeLimit = await assertCanCreateActiveEvent(orgPlan);
  if (!activeLimit.ok) return { success: false, error: activeLimit.error };

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  if (VIRTUALISH_EVENT_TYPES.includes(parsed.data.type)) {
    const virtualLimit = await assertCanUseVirtualishEvent(orgPlan);
    if (!virtualLimit.ok) return { success: false, error: virtualLimit.error };
  }

  const loc = await prisma.location.findFirst({
    where: { id: parsed.data.locationId, orgId: session.user.orgId }
  });
  if (!loc) return { success: false, error: "Venue not found for your organization." };

  const {
    virtualCapacity,
    zoomSessionKind,
    zoomPasscodeMode: _zpm,
    zoomCustomPasscode: _zcp,
    scheduleMode: _sm,
    multiDayConfig: _md,
    blueprintTemplate: _bt,
    allowPublicRegistration: _apr,
    allowFlashEntry: _afe,
    registrationProfile: _rp,
    accommodationTravelNotes: _at,
    resourceLinks: _rl,
    internalStaffAudience: _isa,
    internalStaffCheckInMode: _iscm,
    ...rest
  } = parsed.data;
  const { date, endDate, scheduleMode, multiDayConfig } = resolvedSchedulePayload(parsed.data);

  const template = parsed.data.blueprintTemplate ?? EventBlueprintTemplate.BLANK;
  const resolvedAudience = internalStaffAudienceForPrisma(template, parsed.data.internalStaffAudience);
  const preloadedContactsForInternal =
    template === EventBlueprintTemplate.INTERNAL_STAFF
      ? await listOrgContactsMatchingAudience(session.user.orgId, resolvedAudience)
      : [];
  const issuePersonalStaffLinks =
    template === EventBlueprintTemplate.INTERNAL_STAFF &&
    (parsed.data.internalStaffCheckInMode ?? InternalStaffCheckInMode.PERSONAL_LINK) ===
      InternalStaffCheckInMode.PERSONAL_LINK;

  let zoomMeetingId: string | null = null;
  let zoomJoinUrl: string | null = null;
  let zoomStartUrl: string | null = null;
  let zoomPasscode: string | null = null;

  if (parsed.data.zoomPasscodeMode === "custom") {
    const v = validateZoomPasscode(parsed.data.zoomCustomPasscode ?? "");
    if (!v.ok) {
      return { success: false, error: actionErrorForField("zoomCustomPasscode", v.message) };
    }
  }
  const zoomPasswordForCreate = zoomPasscodeForApi(
    parsed.data.zoomPasscodeMode ?? "default",
    parsed.data.zoomCustomPasscode
  );

  if (shouldCreateOrgZoomSession(virtualCapacity, scheduleMode, multiDayConfig)) {
    try {
      const zoom = await createZoomVirtualSession(
        zoomSessionKind,
        {
          topic: rest.name,
          startTime: date,
          endDate,
          description: rest.description,
          password: zoomPasswordForCreate
        },
        session.user.orgId
      );
      zoomMeetingId = zoom.zoomMeetingId;
      zoomJoinUrl = zoom.zoomJoinUrl;
      zoomStartUrl = zoom.zoomStartUrl;
      zoomPasscode = zoom.zoomPasscode;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: `Could not create Zoom link (${zoomSessionKind}). ${detail}`.slice(0, 700)
      };
    }
  }

  try {
    const event = await prisma.$transaction(async (tx) => {
      const e = await tx.event.create({
        data: {
          ...rest,
          date,
          endDate,
          scheduleMode,
          multiDayConfig: prismaJsonForMultiDayConfig(multiDayConfig),
          description: rest.description ?? undefined,
          virtualCapacity,
          zoomSessionKind,
          orgId: session.user.orgId,
          createdByUserId: session.user.id,
          status: rest.status ?? EventStatus.DRAFT,
          zoomMeetingId,
          zoomJoinUrl,
          zoomStartUrl,
          zoomPasscode,
          ...blueprintPayloadForPrisma(parsed.data)
        }
      });
      if (template === EventBlueprintTemplate.INTERNAL_STAFF && preloadedContactsForInternal.length > 0) {
        await insertContactGuestsFromDirectory(tx, e.id, rest.type, preloadedContactsForInternal, {
          issuePersonalCheckInLinks: issuePersonalStaffLinks
        });
      }
      return e;
    });
    revalidatePath("/events");
    void revalidateOrgCommandCenterForOrgId(event.orgId);
    void kickReminderEvaluationForEvent(event.id);
    if (issuePersonalStaffLinks && preloadedContactsForInternal.length > 0) {
      void dispatchInternalStaffRosterNotices(event.id).catch((e) =>
        console.error("[internal-staff] dispatch after create", e)
      );
    }
    return { success: true, data: event };
  } catch (e) {
    return { success: false, error: formatPrismaWriteError(e, "Could not create event") };
  }
}

const provisionEventAfterWizardSchema = z.object({
  eventId: z.string().min(1),
  publish: z.boolean()
});

/** After wizard / template creation: optionally publish and enqueue reminder evaluation (WhatsApp/SMS follow org cron). */
export async function provisionEventAfterWizard(
  input: z.input<typeof provisionEventAfterWizardSchema>
): Promise<ActionResult<{ status: EventStatus }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to update this event." };
  }
  const parsed = provisionEventAfterWizardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId }
  });
  if (!event) return { success: false, error: "Event not found" };
  if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
    return { success: false, error: "This event cannot be provisioned in its current state." };
  }

  if (parsed.data.publish && event.status === EventStatus.DRAFT) {
    await prisma.event.update({
      where: { id: event.id },
      data: { status: EventStatus.PUBLISHED }
    });
    void sendPendingOrganizerInvitesForEvent(event.id);
    void dispatchInternalStaffRosterNotices(event.id).catch((e) =>
      console.error("[internal-staff] dispatch on publish (wizard)", e)
    );
  }

  void kickReminderEvaluationForEvent(event.id);
  revalidatePath("/events");
  revalidatePath(`/events/${event.id}`);
  revalidatePath(`/events/${event.id}/edit`);
  revalidatePath(`/events/${event.id}/publish`);
  revalidatePath(`/register/${event.id}`);
  void revalidateOrgCommandCenterForOrgId(session.user.orgId);

  const fresh = await prisma.event.findFirst({ where: { id: event.id }, select: { status: true } });
  return { success: true, data: { status: fresh?.status ?? event.status } };
}

export async function updateEvent(
  eventId: string,
  input: z.input<typeof eventSchema>
): Promise<ActionResult<Event>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to update events." };
  }

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.event.findFirst({
    where: { id: eventId, orgId: session.user.orgId }
  });
  if (!existing) return { success: false, error: "Event not found" };
  if (existing.status === EventStatus.COMPLETED || existing.status === EventStatus.CANCELLED) {
    return { success: false, error: "Completed or cancelled events are locked and cannot be edited." };
  }

  const becomingVirtualish =
    VIRTUALISH_EVENT_TYPES.includes(parsed.data.type) &&
    !VIRTUALISH_EVENT_TYPES.includes(existing.type);
  if (becomingVirtualish) {
    const orgPlan = await getOrgPlanForLimits(session.user.orgId);
    if (!orgPlan) return { success: false, error: "Organization not found." };
    const virtualLimit = await assertCanUseVirtualishEvent(orgPlan, {
      excludeEventId: eventId
    });
    if (!virtualLimit.ok) return { success: false, error: virtualLimit.error };
  }

  const loc = await prisma.location.findFirst({
    where: { id: parsed.data.locationId, orgId: session.user.orgId }
  });
  if (!loc) return { success: false, error: "Venue not found for your organization." };

  const {
    virtualCapacity,
    zoomSessionKind,
    zoomPasscodeMode: _zpmUp,
    zoomCustomPasscode: _zcpUp,
    scheduleMode: _smIn,
    multiDayConfig: _mdIn,
    blueprintTemplate: _bt,
    allowPublicRegistration: _apr,
    allowFlashEntry: _afeUp,
    registrationProfile: _rp,
    accommodationTravelNotes: _at,
    resourceLinks: _rl,
    internalStaffAudience: _isaUp,
    internalStaffCheckInMode: _iscmUp,
    ...rest
  } = parsed.data;
  const { date, endDate, scheduleMode, multiDayConfig } = resolvedSchedulePayload(parsed.data);
  const nextStatus = rest.status ?? existing.status;
  const zoomSessionKindToStore =
    existing.zoomMeetingId && virtualCapacity > 0 ? existing.zoomSessionKind : zoomSessionKind;

  try {
    let zoomMeetingId = existing.zoomMeetingId;
    let zoomJoinUrl = existing.zoomJoinUrl;
    let zoomStartUrl = existing.zoomStartUrl;
    let zoomPasscode = existing.zoomPasscode;

    const wantOrgZoom = shouldCreateOrgZoomSession(virtualCapacity, scheduleMode, multiDayConfig);
    if (parsed.data.zoomPasscodeMode === "custom") {
      const v = validateZoomPasscode(parsed.data.zoomCustomPasscode ?? "");
      if (!v.ok) {
        return { success: false, error: actionErrorForField("zoomCustomPasscode", v.message) };
      }
    }
    const zoomPasswordForCreate = zoomPasscodeForApi(
      parsed.data.zoomPasscodeMode ?? "default",
      parsed.data.zoomCustomPasscode
    );

    if (virtualCapacity === 0) {
      zoomMeetingId = null;
      zoomJoinUrl = null;
      zoomStartUrl = null;
      zoomPasscode = null;
    } else if (wantOrgZoom) {
      if (!existing.zoomMeetingId) {
        try {
          const zoom = await createZoomVirtualSession(
            zoomSessionKindToStore,
            {
              topic: rest.name,
              startTime: date,
              endDate,
              description: rest.description,
              password: zoomPasswordForCreate
            },
            session.user.orgId
          );
          zoomMeetingId = zoom.zoomMeetingId;
          zoomJoinUrl = zoom.zoomJoinUrl;
          zoomStartUrl = zoom.zoomStartUrl;
          zoomPasscode = zoom.zoomPasscode;
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e);
          return {
            success: false,
            error: `Could not create Zoom link (${zoomSessionKindToStore}). ${detail}`.slice(0, 700)
          };
        }
      }
    } else {
      zoomMeetingId = null;
      zoomJoinUrl = null;
      zoomStartUrl = null;
      zoomPasscode = null;
    }

    const blueprintMerged = {
      ...parsed.data,
      blueprintTemplate: parsed.data.blueprintTemplate ?? existing.blueprintTemplate,
      allowPublicRegistration: parsed.data.allowPublicRegistration ?? existing.allowPublicRegistration,
      registrationProfile:
        parsed.data.registrationProfile !== undefined
          ? parsed.data.registrationProfile
          : existing.registrationProfile,
      accommodationTravelNotes:
        parsed.data.accommodationTravelNotes !== undefined
          ? parsed.data.accommodationTravelNotes
          : existing.accommodationTravelNotes,
      resourceLinks: parsed.data.resourceLinks !== undefined ? parsed.data.resourceLinks : existing.resourceLinks,
      internalStaffAudience:
        parsed.data.internalStaffAudience !== undefined
          ? parsed.data.internalStaffAudience
          : existing.internalStaffAudience,
      internalStaffCheckInMode:
        parsed.data.internalStaffCheckInMode !== undefined
          ? parsed.data.internalStaffCheckInMode
          : existing.internalStaffCheckInMode,
      internalStaffNoticeKind:
        parsed.data.internalStaffNoticeKind ?? existing.internalStaffNoticeKind,
      internalStaffNoticeTo:
        parsed.data.internalStaffNoticeTo !== undefined
          ? parsed.data.internalStaffNoticeTo
          : existing.internalStaffNoticeTo,
      internalStaffNoticeFrom:
        parsed.data.internalStaffNoticeFrom !== undefined
          ? parsed.data.internalStaffNoticeFrom
          : existing.internalStaffNoticeFrom,
      internalStaffNoticeCc:
        parsed.data.internalStaffNoticeCc !== undefined
          ? parsed.data.internalStaffNoticeCc
          : existing.internalStaffNoticeCc,
      internalStaffNoticeContext:
        parsed.data.internalStaffNoticeContext !== undefined
          ? parsed.data.internalStaffNoticeContext
          : existing.internalStaffNoticeContext,
      internalStaffNoticeSubject:
        parsed.data.internalStaffNoticeSubject !== undefined
          ? parsed.data.internalStaffNoticeSubject
          : existing.internalStaffNoticeSubject,
      internalStaffMeetingRoom:
        parsed.data.internalStaffMeetingRoom !== undefined
          ? parsed.data.internalStaffMeetingRoom
          : existing.internalStaffMeetingRoom,
      internalStaffEmailTemplateKind:
        parsed.data.internalStaffEmailTemplateKind ?? existing.internalStaffEmailTemplateKind,
      internalStaffSmsTemplateKind:
        parsed.data.internalStaffSmsTemplateKind ?? existing.internalStaffSmsTemplateKind,
      internalStaffSmsCustomText:
        parsed.data.internalStaffSmsCustomText !== undefined
          ? parsed.data.internalStaffSmsCustomText
          : existing.internalStaffSmsCustomText,
      allowFlashEntry:
        parsed.data.allowFlashEntry !== undefined ? parsed.data.allowFlashEntry : existing.allowFlashEntry
    } as z.infer<typeof eventSchema>;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...rest,
        date,
        endDate,
        scheduleMode,
        multiDayConfig: prismaJsonForMultiDayConfig(multiDayConfig),
        status: nextStatus,
        description: parsed.data.description ?? undefined,
        virtualCapacity,
        zoomSessionKind: zoomSessionKindToStore,
        zoomMeetingId,
        zoomJoinUrl,
        zoomStartUrl,
        zoomPasscode,
        ...blueprintPayloadForPrisma(blueprintMerged)
      }
    });
    if (
      existing.status === EventStatus.DRAFT &&
      (nextStatus === EventStatus.PUBLISHED || nextStatus === EventStatus.LIVE)
    ) {
      void sendPendingOrganizerInvitesForEvent(eventId);
      void dispatchInternalStaffRosterNotices(eventId).catch((e) =>
        console.error("[internal-staff] dispatch on publish (update)", e)
      );
    }
    revalidatePath("/events");
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/edit`);
    revalidatePath(`/register/${eventId}`);
    void revalidateOrgCommandCenterForOrgId(event.orgId);
    void kickReminderEvaluationForEvent(event.id);
    return { success: true, data: event };
  } catch (e) {
    return { success: false, error: formatPrismaWriteError(e, "Could not update event") };
  }
}

const cloneEventSchema = z.object({
  eventId: z.string().min(1)
});

export async function cloneEvent(
  input: z.input<typeof cloneEventSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to clone events." };
  }

  const billing = await requireBillingCapability(session.user.orgId, "create_event");
  if (!billing.ok) return { success: false, error: billing.error };

  const parsed = cloneEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const orgPlan = await getOrgPlanForLimits(session.user.orgId);
  if (!orgPlan) return { success: false, error: "Organization not found." };

  const activeLimit = await assertCanCreateActiveEvent(orgPlan);
  if (!activeLimit.ok) return { success: false, error: activeLimit.error };

  const source = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId }
  });
  if (!source) return { success: false, error: "Source event not found." };

  if (VIRTUALISH_EVENT_TYPES.includes(source.type)) {
    const virtualLimit = await assertCanUseVirtualishEvent(orgPlan);
    if (!virtualLimit.ok) return { success: false, error: virtualLimit.error };
  }

  try {
    const shiftedSchedule = shiftClonedEventSchedule(
      source.date,
      source.endDate,
      source.scheduleMode,
      source.multiDayConfig
    );

    const cloned = await prisma.event.create({
      data: {
        name: `${source.name} (Copy)`,
        description: source.description ?? undefined,
        date: shiftedSchedule.date,
        endDate: shiftedSchedule.endDate,
        scheduleMode: source.scheduleMode,
        multiDayConfig: shiftedSchedule.multiDayConfig,
        locationId: source.locationId,
        capacity: source.capacity,
        virtualCapacity: source.virtualCapacity,
        type: source.type,
        status: EventStatus.DRAFT,
        zoomMeetingId: null,
        zoomJoinUrl: null,
        zoomPasscode: null,
        reminderPrimaryEnabled: source.reminderPrimaryEnabled,
        reminderPrimaryHoursBefore: source.reminderPrimaryHoursBefore,
        reminderPrimaryEmail: source.reminderPrimaryEmail,
        reminderPrimaryWhatsapp: source.reminderPrimaryWhatsapp,
        reminderPrimarySms: source.reminderPrimarySms,
        reminderFinalEnabled: source.reminderFinalEnabled,
        reminderFinalHoursBefore: source.reminderFinalHoursBefore,
        reminderFinalWhatsapp: source.reminderFinalWhatsapp,
        reminderFinalSms: source.reminderFinalSms,
        zoomSessionKind: source.zoomSessionKind,
        orgId: session.user.orgId,
        createdByUserId: session.user.id,
        blueprintTemplate: source.blueprintTemplate,
        allowPublicRegistration: source.allowPublicRegistration,
        allowFlashEntry: source.allowFlashEntry,
        /** Always reset — optional-email is per-event policy, not cloned from walk-in / phone-only programs. */
        emailMandatoryForRegistration: true,
        registrationProfile:
          source.registrationProfile === null || source.registrationProfile === undefined
            ? Prisma.JsonNull
            : (source.registrationProfile as Prisma.InputJsonValue),
        accommodationTravelNotes: source.accommodationTravelNotes ?? null,
        resourceLinks:
          source.resourceLinks === null || source.resourceLinks === undefined
            ? Prisma.JsonNull
            : (source.resourceLinks as Prisma.InputJsonValue),
        internalStaffAudience:
          source.internalStaffAudience === null || source.internalStaffAudience === undefined
            ? Prisma.JsonNull
            : (source.internalStaffAudience as Prisma.InputJsonValue),
        internalStaffCheckInMode: source.internalStaffCheckInMode,
        internalStaffMealMenuEnabled: source.internalStaffMealMenuEnabled,
        internalStaffMealMenuScope: source.internalStaffMealMenuScope,
        internalStaffMealMenuItems:
          source.internalStaffMealMenuItems === null || source.internalStaffMealMenuItems === undefined
            ? Prisma.JsonNull
            : (source.internalStaffMealMenuItems as Prisma.InputJsonValue),
        internalStaffMealMenusByBranch:
          source.internalStaffMealMenusByBranch === null || source.internalStaffMealMenusByBranch === undefined
            ? Prisma.JsonNull
            : (source.internalStaffMealMenusByBranch as Prisma.InputJsonValue),
        publicExperience: prismaCloneJsonField(source.publicExperience),
        publicPageTemplate: source.publicPageTemplate,
        customRegistrationForm: prismaCloneJsonField(source.customRegistrationForm),
        bannerImageUrl: source.bannerImageUrl,
        brandLogoUrl: source.brandLogoUrl,
        attendeeTheme: source.attendeeTheme,
        brandPrimaryColor: source.brandPrimaryColor
      }
    });

    const sourceTeamMembers = await prisma.eventTeamMember.findMany({
      where: { eventId: source.id },
      select: { userId: true, role: true }
    });
    if (sourceTeamMembers.length > 0) {
      await prisma.eventTeamMember.createMany({
        data: sourceTeamMembers.map((m) => ({
          eventId: cloned.id,
          userId: m.userId,
          role: m.role
        }))
      });
    }

    let zoomMeetingId: string | null = null;
    let zoomJoinUrl: string | null = null;
    let zoomPasscode: string | null = null;

    const sourceMultiParsed = getParsedMultiDayOrNull(source.scheduleMode, source.multiDayConfig);
    if (source.virtualCapacity > 0 && shouldCreateOrgZoomSession(source.virtualCapacity, source.scheduleMode, sourceMultiParsed)) {
      try {
        const zoom = await createZoomVirtualSession(
          source.zoomSessionKind,
          {
            topic: cloned.name,
            startTime: cloned.date,
            endDate: cloned.endDate,
            description: cloned.description
          },
          session.user.orgId
        );
        zoomMeetingId = zoom.zoomMeetingId;
        zoomJoinUrl = zoom.zoomJoinUrl;
        zoomPasscode = zoom.zoomPasscode;
        const zoomStartUrl = zoom.zoomStartUrl;
        await prisma.event.update({
          where: { id: cloned.id },
          data: { zoomMeetingId, zoomJoinUrl, zoomStartUrl, zoomPasscode }
        });
      } catch (e) {
        await prisma.event.delete({ where: { id: cloned.id } });
        const detail = e instanceof Error ? e.message : String(e);
        return {
          success: false,
          error: `Could not create a new Zoom link for the clone (${source.zoomSessionKind}). ${detail}`.slice(0, 700)
        };
      }
    }

    revalidatePath("/events");
    revalidatePath(`/events/${cloned.id}`);
    revalidatePath(`/events/${cloned.id}/edit`);
    revalidatePath(`/events/${cloned.id}/settings/team`);
    revalidatePath(`/events/${cloned.id}/public`);
    revalidatePath(`/register/${cloned.id}`);
    void revalidateOrgCommandCenterForOrgId(session.user.orgId);
    return { success: true, data: { id: cloned.id } };
  } catch {
    return { success: false, error: "Could not clone event." };
  }
}

const setEventStatusSchema = z.object({
  eventId: z.string().min(1),
  status: z.nativeEnum(EventStatus)
});

const markEventCompletedSchema = z.object({
  eventId: z.string().min(1)
});

/** Set status to COMPLETED after scheduled end (manual; automation still runs on cron). */
export async function markEventCompleted(
  input: z.input<typeof markEventCompletedSchema>
): Promise<ActionResult<{ status: EventStatus }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to complete events." };
  }
  const parsed = markEventCompletedSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, status: true, endDate: true }
  });
  if (!existing) return { success: false, error: "Event not found." };
  if (existing.status === EventStatus.COMPLETED || existing.status === EventStatus.CANCELLED) {
    return { success: false, error: "This event is already completed or cancelled." };
  }
  if (existing.status !== EventStatus.PUBLISHED && existing.status !== EventStatus.LIVE) {
    return { success: false, error: "Only published or live events can be marked complete." };
  }
  const now = Date.now();
  if (existing.endDate.getTime() > now) {
    return { success: false, error: "The scheduled end time has not passed yet." };
  }

  try {
    const event = await prisma.event.update({
      where: { id: parsed.data.eventId },
      data: { status: EventStatus.COMPLETED }
    });

    revalidatePath("/events");
    revalidatePath(`/events/${event.id}`);
    revalidatePath(`/events/${event.id}/edit`);
    revalidatePath(`/register/${event.id}`);
    return { success: true, data: { status: event.status } };
  } catch {
    return { success: false, error: "Failed to mark event complete." };
  }
}

export async function setEventStatus(
  input: z.input<typeof setEventStatusSchema>
): Promise<ActionResult<{ status: EventStatus }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to update event status." };
  }
  const parsed = setEventStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, status: true }
  });
  if (!existing) return { success: false, error: "Event not found." };
  if (existing.status === EventStatus.COMPLETED || existing.status === EventStatus.CANCELLED) {
    return { success: false, error: "Completed or cancelled events are locked." };
  }

  try {
    const event = await prisma.event.update({
      where: { id: parsed.data.eventId },
      data: { status: parsed.data.status }
    });

    revalidatePath("/events");
    revalidatePath(`/events/${event.id}`);
    revalidatePath(`/events/${event.id}/edit`);
    revalidatePath(`/register/${event.id}`);
    return { success: true, data: { status: event.status } };
  } catch {
    return { success: false, error: "Failed to update event status." };
  }
}

const cancelEventSchema = z.object({
  eventId: z.string().min(1),
  notifyGuests: z.boolean()
});

export async function cancelEvent(
  input: z.input<typeof cancelEventSchema>
): Promise<ActionResult<{ cancelled: true; emailsSent: number; whatsappSent: number; smsSent: number }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to cancel events." };
  }
  const parsed = cancelEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, status: true }
  });
  if (!existing) return { success: false, error: "Event not found." };
  if (existing.status !== EventStatus.PUBLISHED && existing.status !== EventStatus.LIVE) {
    return { success: false, error: "Only published or live events can be cancelled." };
  }

  try {
    await prisma.event.update({
      where: { id: parsed.data.eventId },
      data: { status: EventStatus.CANCELLED }
    });

    let emailsSent = 0;
    let whatsappSent = 0;
    let smsSent = 0;
    if (parsed.data.notifyGuests) {
      const r = await sendCancellationNotificationsInternal({
        eventId: parsed.data.eventId,
        orgId: session.user.orgId
      });
      emailsSent = r.emails;
      whatsappSent = r.whatsapp;
      smsSent = r.sms;
    }

    revalidatePath("/events");
    revalidatePath(`/events/${parsed.data.eventId}`);
    revalidatePath(`/events/${parsed.data.eventId}/edit`);
    revalidatePath(`/register/${parsed.data.eventId}`);
    return {
      success: true,
      data: { cancelled: true, emailsSent, whatsappSent, smsSent }
    };
  } catch {
    return { success: false, error: "Failed to cancel event." };
  }
}

const publishEventSchema = z.object({
  eventId: z.string().min(1)
});

export async function publishEvent(
  input: z.input<typeof publishEventSchema>
): Promise<ActionResult<{ status: EventStatus }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to publish events." };
  }

  const parsed = publishEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId }
  });
  if (!existing) return { success: false, error: "Event not found" };

  if (existing.status !== EventStatus.DRAFT) {
    return { success: false, error: "Only draft events can be published." };
  }

  try {
    const event = await prisma.event.update({
      where: { id: parsed.data.eventId },
      data: { status: EventStatus.PUBLISHED }
    });
    void sendPendingOrganizerInvitesForEvent(parsed.data.eventId);
    void dispatchInternalStaffRosterNotices(parsed.data.eventId).catch((e) =>
      console.error("[internal-staff] dispatch on publish", e)
    );
    revalidatePath("/events");
    revalidatePath(`/events/${parsed.data.eventId}`);
    revalidatePath(`/events/${parsed.data.eventId}/publish`);
    revalidatePath(`/register/${parsed.data.eventId}`);
    void revalidateOrgCommandCenterForOrgId(event.orgId);
    void kickReminderEvaluationForEvent(event.id);
    return { success: true, data: { status: event.status } };
  } catch {
    return { success: false, error: "Failed to publish event" };
  }
}

const unpublishEventSchema = z.object({
  eventId: z.string().min(1)
});

/** Return a published or live event to draft so it can be edited without cancelling. */
export async function unpublishEvent(
  input: z.input<typeof unpublishEventSchema>
): Promise<ActionResult<{ status: EventStatus }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to unpublish events." };
  }

  const parsed = unpublishEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId }
  });
  if (!existing) return { success: false, error: "Event not found" };

  if (existing.status !== EventStatus.PUBLISHED && existing.status !== EventStatus.LIVE) {
    return { success: false, error: "Only published or live events can be moved back to draft." };
  }

  try {
    const event = await prisma.event.update({
      where: { id: parsed.data.eventId },
      data: { status: EventStatus.DRAFT }
    });
    revalidatePath("/events");
    revalidatePath(`/events/${parsed.data.eventId}`);
    revalidatePath(`/events/${parsed.data.eventId}/publish`);
    revalidatePath(`/events/${parsed.data.eventId}/edit`);
    revalidatePath(`/register/${parsed.data.eventId}`);
    void revalidateOrgCommandCenterForOrgId(event.orgId);
    return { success: true, data: { status: event.status } };
  } catch {
    return { success: false, error: "Failed to unpublish event" };
  }
}

export async function deleteEvent(eventId: string): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to delete events." };
  }

  const existing = await prisma.event.findFirst({
    where: { id: eventId, orgId: session.user.orgId }
  });
  if (!existing) return { success: false, error: "Event not found" };
  const effectiveEnd = existing.endDate;
  const guestCount = await prisma.guest.count({ where: { eventId } });
  const isPast = effectiveEnd.getTime() <= Date.now();
  const isPublishedOrLive =
    existing.status === EventStatus.PUBLISHED || existing.status === EventStatus.LIVE;
  const mayDelete =
    !isPublishedOrLive &&
    (existing.status === EventStatus.DRAFT ||
      guestCount === 0 ||
      isPast ||
      existing.status === EventStatus.CANCELLED);
  if (!mayDelete) {
    if (isPublishedOrLive) {
      return {
        success: false,
        error: "Unpublish this event before it can be deleted."
      };
    }
    return {
      success: false,
      error:
        "Delete is only allowed for drafts, events that have already ended, events with no registered guests, or cancelled events. Cancel a live event first if you need to stop it while guests are registered."
    };
  }

  try {
    void revalidateOrgCommandCenterForOrgId(existing.orgId);
    await prisma.event.delete({ where: { id: eventId } });
    revalidatePath("/events");
    return { success: true, data: { id: eventId } };
  } catch {
    return { success: false, error: "Failed to delete event" };
  }
}

const updateInternalStaffMeetingSettingsSchema = z.object({
  eventId: z.string().min(1),
  audience: z.unknown(),
  internalStaffCheckInMode: z.nativeEnum(InternalStaffCheckInMode).optional(),
  internalStaffNoticeKind: z.nativeEnum(InternalStaffNoticeKind).optional(),
  internalStaffNoticeTo: z.string().max(240).optional().nullable(),
  internalStaffNoticeFrom: z.string().max(240).optional().nullable(),
  internalStaffNoticeCc: z.string().max(240).optional().nullable(),
  internalStaffNoticeContext: z.string().max(50000).optional().nullable(),
  internalStaffNoticeSubject: z.string().max(500).optional().nullable(),
  internalStaffMeetingRoom: z.string().max(240).optional().nullable(),
  internalStaffEmailTemplateKind: z.nativeEnum(InternalStaffEmailTemplateKind).optional(),
  internalStaffSmsTemplateKind: z.nativeEnum(InternalStaffSmsTemplateKind).optional(),
  internalStaffSmsCustomText: z.string().max(2000).optional().nullable(),
  internalStaffEmailMailyJson: z.record(z.unknown()).optional().nullable(),
  /** Command Center walk-ins for internal staff programs. */
  allowFlashEntry: z.boolean().optional(),
  internalStaffMealMenuEnabled: z.boolean().optional(),
  internalStaffMealMenuScope: z.nativeEnum(InternalStaffMealMenuScope).optional(),
  internalStaffMealMenuItems: z.array(z.string().trim().min(1).max(80)).max(24).optional().nullable(),
  internalStaffMealMenusByBranch: z
    .array(
      z.object({
        branch: z.string().trim().min(1).max(120),
        items: z.array(z.string().trim().min(1).max(80)).min(1).max(24)
      })
    )
    .max(24)
    .optional()
    .nullable()
});

/** Update audience JSON and check-in / meal settings for an internal staff blueprint event. */
export async function updateInternalStaffMeetingSettings(
  input: z.input<typeof updateInternalStaffMeetingSettingsSchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to update this event." };
  }

  const parsed = updateInternalStaffMeetingSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const audienceParsed = internalStaffAudienceSchema.safeParse(normalizeAudienceJson(parsed.data.audience));
  if (!audienceParsed.success) {
    return { success: false, error: audienceParsed.error.issues.map((i) => i.message).join("; ") };
  }

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId }
  });
  if (!event) return { success: false, error: "Event not found." };
  if (event.blueprintTemplate !== EventBlueprintTemplate.INTERNAL_STAFF) {
    return { success: false, error: "Audience settings apply only to internal staff programs." };
  }
  if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
    return { success: false, error: "This event is locked and cannot be edited." };
  }

  const nextCheckInMode = parsed.data.internalStaffCheckInMode ?? event.internalStaffCheckInMode;
  const nextAllowFlashEntry = parsed.data.allowFlashEntry ?? event.allowFlashEntry;

  const nextMealEnabled = parsed.data.internalStaffMealMenuEnabled ?? event.internalStaffMealMenuEnabled;
  const nextMealScope =
    parsed.data.internalStaffMealMenuScope ?? event.internalStaffMealMenuScope ?? InternalStaffMealMenuScope.ALL_STAFF;

  let mealItemsJson: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
  let mealByBranchJson: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
  let mealScopeToSave: InternalStaffMealMenuScope = InternalStaffMealMenuScope.ALL_STAFF;

  if (!nextMealEnabled) {
    mealItemsJson = Prisma.JsonNull;
    mealByBranchJson = Prisma.JsonNull;
    mealScopeToSave = InternalStaffMealMenuScope.ALL_STAFF;
  } else if (nextMealScope === InternalStaffMealMenuScope.ALL_STAFF) {
    mealScopeToSave = InternalStaffMealMenuScope.ALL_STAFF;
    let nextMealItemsRaw: string[];
    if (parsed.data.internalStaffMealMenuItems != null) {
      nextMealItemsRaw = parsed.data.internalStaffMealMenuItems;
    } else {
      nextMealItemsRaw = parseInternalStaffMealMenuItems(event.internalStaffMealMenuItems);
    }
    if (nextMealItemsRaw.length < 1) {
      return {
        success: false,
        error: "Add at least one meal option when using one menu for all staff (one per line)."
      };
    }
    mealItemsJson = nextMealItemsRaw as unknown as Prisma.InputJsonValue;
    mealByBranchJson = Prisma.JsonNull;
  } else {
    mealScopeToSave = InternalStaffMealMenuScope.BY_BRANCH;
    const rowsRaw =
      parsed.data.internalStaffMealMenusByBranch != null
        ? parsed.data.internalStaffMealMenusByBranch
        : parseInternalStaffMealMenusByBranch(event.internalStaffMealMenusByBranch);
    const rowsParsed = internalStaffMealMenusByBranchPayloadSchema.safeParse(rowsRaw);
    if (!rowsParsed.success) {
      return {
        success: false,
        error: rowsParsed.error.issues.map((i) => i.message).join("; ")
      };
    }
    const seen = new Set<string>();
    for (const row of rowsParsed.data) {
      const k = row.branch.trim().toLowerCase();
      if (seen.has(k)) {
        return { success: false, error: "Each branch can only appear once in the meal menus." };
      }
      seen.add(k);
    }
    if (rowsParsed.data.length < 1) {
      return {
        success: false,
        error: "Add at least one branch with a meal list when using branch-specific menus."
      };
    }
    mealByBranchJson = rowsParsed.data as unknown as Prisma.InputJsonValue;
    mealItemsJson = Prisma.JsonNull;
  }

  try {
    await prisma.event.update({
      where: { id: event.id },
      data: {
        internalStaffAudience: audienceParsed.data as unknown as Prisma.InputJsonValue,
        internalStaffCheckInMode: nextCheckInMode,
        allowFlashEntry: nextAllowFlashEntry,
        internalStaffNoticeKind:
          parsed.data.internalStaffNoticeKind ?? event.internalStaffNoticeKind,
        internalStaffNoticeTo:
          parsed.data.internalStaffNoticeTo !== undefined
            ? parsed.data.internalStaffNoticeTo?.trim() || null
            : event.internalStaffNoticeTo,
        internalStaffNoticeFrom:
          parsed.data.internalStaffNoticeFrom !== undefined
            ? parsed.data.internalStaffNoticeFrom?.trim() || null
            : event.internalStaffNoticeFrom,
        internalStaffNoticeCc:
          parsed.data.internalStaffNoticeCc !== undefined
            ? parsed.data.internalStaffNoticeCc?.trim() || null
            : event.internalStaffNoticeCc,
        internalStaffNoticeContext:
          parsed.data.internalStaffNoticeContext !== undefined
            ? stripLegacyMeetingRoomMarkers(parsed.data.internalStaffNoticeContext) || null
            : event.internalStaffNoticeContext,
        internalStaffNoticeSubject:
          parsed.data.internalStaffNoticeSubject !== undefined
            ? parsed.data.internalStaffNoticeSubject?.trim() || null
            : event.internalStaffNoticeSubject,
        internalStaffMeetingRoom:
          parsed.data.internalStaffMeetingRoom !== undefined
            ? parsed.data.internalStaffMeetingRoom?.trim() || null
            : event.internalStaffMeetingRoom,
        internalStaffEmailTemplateKind:
          parsed.data.internalStaffEmailTemplateKind ?? event.internalStaffEmailTemplateKind,
        internalStaffSmsTemplateKind:
          parsed.data.internalStaffSmsTemplateKind ?? event.internalStaffSmsTemplateKind,
        internalStaffSmsCustomText:
          parsed.data.internalStaffSmsCustomText !== undefined
            ? parsed.data.internalStaffSmsCustomText?.trim() || null
            : event.internalStaffSmsCustomText,
        internalStaffEmailMailyJson:
          parsed.data.internalStaffEmailMailyJson !== undefined
            ? parsed.data.internalStaffEmailMailyJson
              ? (parsed.data.internalStaffEmailMailyJson as Prisma.InputJsonValue)
              : Prisma.JsonNull
            : event.internalStaffEmailMailyJson == null
              ? Prisma.JsonNull
              : (event.internalStaffEmailMailyJson as Prisma.InputJsonValue),
        internalStaffMealMenuEnabled: nextMealEnabled,
        internalStaffMealMenuScope: mealScopeToSave,
        internalStaffMealMenuItems: mealItemsJson,
        internalStaffMealMenusByBranch: mealByBranchJson
      }
    });
    revalidatePath(`/events/${event.id}`);
    revalidatePath(`/events/${event.id}/edit`);
    revalidatePath(`/events/${event.id}/guests`);
    revalidatePath(`/register/${event.id}`);
    void revalidateOrgCommandCenterForOrgId(event.orgId);
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save audience settings." };
  }
}

const updateEventAllowFlashEntrySchema = z.object({
  eventId: z.string().min(1),
  allowFlashEntry: z.boolean()
});

/** Toggle Command Center walk-in entry (`/o/[orgSlug]/…/enter`) for non–internal-staff programs. */
export async function updateEventAllowFlashEntry(
  input: z.input<typeof updateEventAllowFlashEntrySchema>
): Promise<ActionResult<{ allowFlashEntry: boolean }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to update this event." };
  }

  const parsed = updateEventAllowFlashEntrySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, orgId: true, blueprintTemplate: true, status: true, allowFlashEntry: true }
  });
  if (!event) return { success: false, error: "Event not found." };
  if (event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF) {
    return {
      success: false,
      error: "For internal staff programs, change walk-ins under Audience, check-in & meals."
    };
  }
  if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
    return { success: false, error: "This event is locked." };
  }

  try {
    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { allowFlashEntry: parsed.data.allowFlashEntry },
      select: { allowFlashEntry: true }
    });
    revalidatePath(`/events/${event.id}`);
    revalidatePath(`/events/${event.id}/edit`);
    revalidatePath(`/register/${event.id}`);
    void revalidateOrgCommandCenterForOrgId(event.orgId);
    return { success: true, data: { allowFlashEntry: updated.allowFlashEntry } };
  } catch {
    return { success: false, error: "Could not update walk-in setting." };
  }
}

const updateEventRegistrationContactSettingsSchema = z.object({
  eventId: z.string().min(1),
  emailMandatoryForRegistration: z.boolean()
});

/** Toggle whether registration forms require an email address (phone always required). */
export async function updateEventRegistrationContactSettings(
  input: z.input<typeof updateEventRegistrationContactSettingsSchema>
): Promise<ActionResult<{ emailMandatoryForRegistration: boolean }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to update this event." };
  }

  const parsed = updateEventRegistrationContactSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, status: true }
  });
  if (!event) return { success: false, error: "Event not found." };
  if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
    return { success: false, error: "This event is locked." };
  }

  try {
    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { emailMandatoryForRegistration: parsed.data.emailMandatoryForRegistration },
      select: { emailMandatoryForRegistration: true }
    });
    revalidatePath(`/events/${event.id}`);
    revalidatePath(`/events/${event.id}/edit`);
    revalidatePath(`/events/${event.id}/settings`);
    revalidatePath(`/events/${event.id}/guests/form`);
    revalidatePath(`/register/${event.id}`);
    return {
      success: true,
      data: { emailMandatoryForRegistration: updated.emailMandatoryForRegistration }
    };
  } catch {
    return { success: false, error: "Could not update registration contact settings." };
  }
}

const updateEventPublicRegistrationSettingsSchema = z.object({
  eventId: z.string().min(1),
  allowPublicRegistration: z.boolean(),
  enableSavedProfileLookup: z.boolean()
});

/** Public registration page options: self-registration and CRM profile lookup. */
export async function updateEventPublicRegistrationSettings(
  input: z.input<typeof updateEventPublicRegistrationSettingsSchema>
): Promise<
  ActionResult<{
    allowPublicRegistration: boolean;
    enableSavedProfileLookup: boolean;
  }>
> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to update this event." };
  }

  const parsed = updateEventPublicRegistrationSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, status: true, registrationProfile: true }
  });
  if (!event) return { success: false, error: "Event not found." };
  if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
    return { success: false, error: "This event is locked." };
  }

  const profile = parseRegistrationProfile(event.registrationProfile);
  const registrationProfile = registrationProfileSchema.parse({
    ...profile,
    enableSavedProfileLookup: parsed.data.enableSavedProfileLookup
  });

  try {
    const updated = await prisma.event.update({
      where: { id: event.id },
      data: {
        allowPublicRegistration: parsed.data.allowPublicRegistration,
        registrationProfile: registrationProfile as unknown as Prisma.InputJsonValue
      },
      select: {
        allowPublicRegistration: true,
        registrationProfile: true
      }
    });
    const saved = parseRegistrationProfile(updated.registrationProfile);
    revalidatePath(`/events/${event.id}`);
    revalidatePath(`/events/${event.id}/edit`);
    revalidatePath(`/events/${event.id}/publish`);
    revalidatePath(`/register/${event.id}`);
    return {
      success: true,
      data: {
        allowPublicRegistration: updated.allowPublicRegistration,
        enableSavedProfileLookup: saved.enableSavedProfileLookup
      }
    };
  } catch {
    return { success: false, error: "Could not update registration settings." };
  }
}

const updateEventAllowPublicRegistrationSchema = z.object({
  eventId: z.string().min(1),
  allowPublicRegistration: z.boolean()
});

/** Toggle whether `/register/[eventId]` accepts public self-registration. */
export async function updateEventAllowPublicRegistration(
  input: z.input<typeof updateEventAllowPublicRegistrationSchema>
): Promise<ActionResult<{ allowPublicRegistration: boolean }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to update this event." };
  }

  const parsed = updateEventAllowPublicRegistrationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, orgId: true, status: true, allowPublicRegistration: true }
  });
  if (!event) return { success: false, error: "Event not found." };
  if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
    return { success: false, error: "This event is locked." };
  }

  try {
    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { allowPublicRegistration: parsed.data.allowPublicRegistration },
      select: { allowPublicRegistration: true }
    });
    revalidatePath(`/events/${event.id}`);
    revalidatePath(`/events/${event.id}/edit`);
    revalidatePath(`/events/${event.id}/publish`);
    revalidatePath(`/register/${event.id}`);
    return { success: true, data: { allowPublicRegistration: updated.allowPublicRegistration } };
  } catch {
    return { success: false, error: "Could not update public registration setting." };
  }
}

const dispatchInternalStaffPersonalLinksSchema = z.object({
  eventId: z.string().min(1)
});

/** Sends staff programme notices (memo email + SMS) to roster guests. */
export async function dispatchInternalStaffPersonalCheckInLinksAction(
  input: z.input<typeof dispatchInternalStaffPersonalLinksSchema>
): Promise<ActionResult<{ emailed: number; smsSent: number; whatsappSent: number }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to send staff notices." };
  }
  const parsed = dispatchInternalStaffPersonalLinksSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, blueprintTemplate: true, status: true }
  });
  if (!event) return { success: false, error: "Event not found." };
  if (event.blueprintTemplate !== EventBlueprintTemplate.INTERNAL_STAFF) {
    return { success: false, error: "This action applies only to internal staff programs." };
  }
  if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
    return { success: false, error: "This event is locked." };
  }

  const result = await dispatchInternalStaffRosterNotices(event.id, {
    forceResend: true
  });
  revalidatePath(`/events/${event.id}`);
  revalidatePath(`/events/${event.id}/edit`);
  revalidatePath(`/register/${event.id}`);
  return {
    success: true,
    data: { emailed: result.emailed, smsSent: result.smsSent, whatsappSent: result.whatsappSent }
  };
}

const resyncInternalStaffGuestsActionSchema = z.object({
  eventId: z.string().min(1)
});

/** Recompute invited directory guests from the event's saved internal audience. */
export async function resyncInternalStaffGuestsForEventAction(
  input: z.input<typeof resyncInternalStaffGuestsActionSchema>
): Promise<ActionResult<ResyncInternalStaffGuestsResult>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to update this event." };
  }

  const parsed = resyncInternalStaffGuestsActionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, status: true, blueprintTemplate: true }
  });
  if (!event) return { success: false, error: "Event not found." };
  if (event.blueprintTemplate !== EventBlueprintTemplate.INTERNAL_STAFF) {
    return { success: false, error: "Guest re-sync applies only to internal staff programs." };
  }
  if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
    return { success: false, error: "This event is locked." };
  }

  const result = await resyncInternalStaffGuestsForEvent({
    eventId: parsed.data.eventId,
    orgId: session.user.orgId
  });
  if (!result.success) return result;

  revalidatePath(`/events/${parsed.data.eventId}`);
  revalidatePath(`/events/${parsed.data.eventId}/edit`);
  revalidatePath(`/events/${parsed.data.eventId}/guests`);
  revalidatePath(`/register/${parsed.data.eventId}`);
  void kickReminderEvaluationForEvent(parsed.data.eventId);

  return result;
}

const previewInternalStaffBlankEmailSchema = z.object({
  editorState: z.record(z.unknown()),
  mergeContext: z
    .object({
      guestName: z.string().optional(),
      eventName: z.string().optional(),
      eventDateIso: z.string().optional(),
      noticeKind: z.nativeEnum(InternalStaffNoticeKind).optional(),
      noticeSubject: z.string().optional().nullable(),
      memoTo: z.string().optional(),
      memoFrom: z.string().optional(),
      memoCc: z.string().optional().nullable(),
      meetingRoom: z.string().optional().nullable(),
      venueLine: z.string().optional(),
      orgName: z.string().optional(),
      orgLogoUrl: z.string().optional().nullable(),
      checkInLink: z.string().optional().nullable()
    })
    .optional()
});

/** Compile blank staff notice Maily draft with sample merge values for admin preview. */
export async function previewInternalStaffBlankEmailAction(
  input: z.input<typeof previewInternalStaffBlankEmailSchema>
): Promise<ActionResult<{ html: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };

  const parsed = previewInternalStaffBlankEmailSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  try {
    const templateHtml = await compileStaffNoticeEmailTemplateHtml(
      parsed.data.editorState as import("@tiptap/core").JSONContent
    );
    const ctx = parsed.data.mergeContext;
    const eventDate = ctx?.eventDateIso ? new Date(ctx.eventDateIso) : new Date();
    const mergeValues = ctx
      ? resolveStaffNoticeMergeValues({
          guest: { name: ctx.guestName ?? "Alex Morgan", email: "alex@example.com" },
          event: {
            name: ctx.eventName ?? "Staff programme",
            date: eventDate,
            noticeKind: ctx.noticeKind ?? InternalStaffNoticeKind.TRAINING,
            noticeSubject: ctx.noticeSubject
          },
          orgName: ctx.orgName ?? "Organization",
          orgLogoUrl: ctx.orgLogoUrl,
          checkInLink: ctx.checkInLink,
          memo: {
            memoTo: ctx.memoTo ?? "ALL STAFF",
            memoFrom: ctx.memoFrom ?? "HEAD, HUMAN RESOURCES",
            memoCc: ctx.memoCc,
            memoDate: new Date(),
            meetingRoom: ctx.meetingRoom,
            venueLine: ctx.venueLine ?? ""
          }
        })
      : sampleStaffNoticeMergeValues();
    const subject = mergeValues.memo_subject ?? "Staff notice";
    const html = renderStaffNoticeEmailFromTemplate(templateHtml, mergeValues, subject);
    return { success: true, data: { html } };
  } catch {
    return { success: false, error: "Could not render email preview." };
  }
}
