"use server";

import {
  AttendMode,
  EventBlueprintTemplate,
  EventScheduleMode,
  EventStatus,
  EventType,
  GuestStatus,
  EmailMarketingConsentSource,
  InternalStaffCheckInMode,
  Role,
  StaffEmploymentStatus,
  Tier,
  ZoomSessionKind,
  type Prisma
} from "@prisma/client";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { assertCanAddGuests } from "@/lib/billing/planLimits";
import { getOrgPlanForLimits } from "@/lib/db/billing";
import { isCrmEligibleEmail, isCrmInviteableProfile } from "@/lib/crm/contactEligibility";
import { normalizeCompanyForStorage } from "@/lib/guests/companyNormalization";
import {
  sendGuestConfirmationInPerson,
  sendGuestConfirmationVirtual,
  sendGuestInvitationEmail,
  sendGuestRemovedFromEventEmail,
  sendInternalStaffPersonalCheckInLinkEmail,
  type PollEmailNotice
} from "@/lib/email";
import { phoneToMnotifyRecipient, sendOrgMnotifyQuickSms } from "@/lib/mnotify";
import { prisma } from "@/lib/prisma";
import { guestQrToPngBase64, createGuestQrCode } from "@/lib/qr";
import { registerWebinarRegistrant, zoomRegistrantNameParts } from "@/lib/zoom";
import { getEventForPublicRegistration } from "@/lib/db/events";
import { recordGuestMarketingConsent } from "@/lib/db/emailContact";
import { shouldShowMarketingOptIn } from "@/lib/email/marketingOptIn";
import { findPriorGuestProfileForOrg, findPriorGuestProfileForOrgByPhone } from "@/lib/db/guests";
import { parseRegistrationProfile } from "@/lib/event-wizard/registrationProfile";
import { DEFAULT_PHONE_DIAL } from "@/lib/register/phoneDialOptions";
import {
  composeE164,
  isValidE164,
  isValidNationalForDial,
  normalizeNationalDigits,
  parseStoredPhoneToForm
} from "@/lib/phone/publicRegistrationPhone";
import { normalizeImportedPhoneToE164 } from "@/lib/phone/importPhoneNormalization";
import {
  eventHasVirtualJoinFromConfig,
  getParsedMultiDayOrNull,
  initialGuestVirtualJoinUrl,
  isPublicSelfRegistrationOpen
} from "@/lib/event-schedule/multiDayConfig";
import { eventAllowsGuestInvitationResend } from "@/lib/lifecycle/eventTiming";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import {
  getEventPollAbsoluteUrl,
  getInternalStaffMagicCheckInUrl,
  getGuestJoinSmsAbsoluteUrl,
  getJoinPageAbsoluteUrl,
  getOpenZoomJoinAbsoluteUrl,
  getPublicSiteUrl,
  getRsvpAcceptAbsoluteUrl,
  getRsvpDeclineAbsoluteUrl
} from "@/lib/url";
import { initialModeForOrganizerGuest } from "@/lib/guests/attendanceDefaults";
import { sendInternalStaffNoticeToGuestById } from "@/lib/internalStaff/dispatchPersonalCheckInLinks";
import { newInternalCheckInToken } from "@/lib/internalStaff/personalLinkToken";
import {
  guestEmailFieldSchema,
  guestHasDeliverableEmail,
  isEmailMandatoryForEvent,
  normalizeGuestEmailInput
} from "@/lib/guest/contactRequirements";
import { ensureGuestJoinSmsCode, resolveGuestSmsPortalUrl } from "@/lib/guest/joinLinks";
import { logMnotifySmsDelivery, logResendEmailDelivery } from "@/lib/delivery/providerDelivery";
import {
  logGuestNotificationDelivery,
  resolveGuestNotificationChannels
} from "@/lib/notifications/guestNotificationDispatch";
import { shouldNotifyGuestOfRemovalFromEvent } from "@/lib/guests/removalNotifications";
import {
  renderGuestInviteSms,
  renderGuestRegistrationConfirmSms,
  renderGuestReminderSms
} from "@/lib/sms/guestNotificationCopy";
import { canManageEventGuests, isSalesRepRole, mayEditOrDeleteGuestRow } from "@/lib/permissions";
import { formatDate, formatLocationLine } from "@/lib/utils";
import { ActionResult, Guest, GuestWithEmailStatus } from "@/types";

const guestBaseObjectSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().min(2),
  phone: z.string().min(1, "Mobile phone is required"),
  company: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  country: z.string().max(32).optional().nullable(),
  accessibilityNotes: z.string().max(2000).optional().nullable(),
  referralSource: z.string().max(80).optional().nullable(),
  staffEmployeeId: z.string().max(120).optional().nullable(),
  department: z.string().max(120).optional().nullable(),
  branch: z.string().max(120).optional().nullable(),
  tier: z.nativeEnum(Tier),
  /** Omit for hybrid events to leave attendance undecided until check-in or virtual join. */
  mode: z.nativeEnum(AttendMode).optional(),
  /** Event-scoped guest group (from Guests sidebar). */
  eventGuestGroupId: z.string().min(1).optional().nullable(),
  dietary: z.string().optional().nullable(),
  repId: z.string().optional().nullable()
});

function refineGuestPhoneE164(data: { phone: string }, ctx: z.RefinementCtx) {
  if (!isValidE164(data.phone)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter phone in international format, e.g. +233501234567.",
      path: ["phone"]
    });
  }
}

function buildGuestBaseSchema(emailRequired: boolean) {
  return guestBaseObjectSchema
    .extend({ email: guestEmailFieldSchema(emailRequired) })
    .superRefine(refineGuestPhoneE164);
}

/** Default schema (email required) — used where event context is unavailable at parse time. */
const guestBaseSchema = buildGuestBaseSchema(true);

function buildUpdateGuestDetailsSchema(emailRequired: boolean) {
  return guestBaseObjectSchema
    .omit({ mode: true })
    .extend({
      guestId: z.string().min(1),
      email: guestEmailFieldSchema(emailRequired),
      mode: z.union([z.nativeEnum(AttendMode), z.null()]).optional(),
      eventGuestGroupId: z.union([z.string().min(1), z.null()]).optional()
    })
    .superRefine(refineGuestPhoneE164);
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

function normalizeGuestPhone(phone: string) {
  return phone.trim();
}

function formatGroupedRowIssues(issues: Array<{ row: number; message: string }>, maxGroups = 5): string {
  if (issues.length === 0) return "";
  const rowsByMessage = new Map<string, number[]>();
  for (const issue of issues) {
    const arr = rowsByMessage.get(issue.message) ?? [];
    arr.push(issue.row);
    rowsByMessage.set(issue.message, arr);
  }

  const grouped = [...rowsByMessage.entries()]
    .map(([message, rows]) => {
      const uniqueRows = [...new Set(rows)].sort((a, b) => a - b);
      return `Rows ${uniqueRows.join(", ")}: ${message}`;
    })
    .sort((a, b) => a.localeCompare(b));

  const shown = grouped.slice(0, maxGroups);
  const hiddenCount = grouped.length - shown.length;
  return hiddenCount > 0 ? `${shown.join(" | ")} | +${hiddenCount} more issue type(s)` : shown.join(" | ");
}

/** Upsert org contact from guest snapshot and link guest.contactId (best-effort). */
async function syncOrgContactForGuest(
  orgId: string,
  guest: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    staffEmployeeId?: string | null;
    department?: string | null;
    branch?: string | null;
    company?: string | null;
    jobTitle?: string | null;
  }
) {
  const phone = guest.phone?.trim();
  if (!phone || !isValidE164(phone)) return;
  if (!isCrmEligibleEmail(guest.email)) return;
  const email = guest.email!.trim().toLowerCase();
  try {
    const contact = await prisma.orgContact.upsert({
      where: { orgId_email: { orgId, email } },
      create: {
        orgId,
        name: guest.name.trim(),
        email,
        phone,
        staffEmployeeId: guest.staffEmployeeId?.trim() || null,
        department: guest.department?.trim() || null,
        branch: guest.branch?.trim() || null,
        company: guest.company?.trim() || null,
        jobTitle: guest.jobTitle?.trim() || null,
        employmentStatus: StaffEmploymentStatus.PERMANENT
      },
      update: {
        name: guest.name.trim(),
        phone,
        staffEmployeeId: guest.staffEmployeeId?.trim() || null,
        department: guest.department?.trim() || null,
        branch: guest.branch?.trim() || null,
        company: guest.company?.trim() || null,
        jobTitle: guest.jobTitle?.trim() || null
      },
      select: { id: true }
    });
    await prisma.guest.update({ where: { id: guest.id }, data: { contactId: contact.id } });
  } catch (e) {
    console.error("[guest] org contact sync failed", e);
  }
}

function canManageGuests(role: Role) {
  return canManageEventGuests(role);
}

async function getEventForGuestAction(eventId: string, orgId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: {
      id: true,
      orgId: true,
      name: true,
      date: true,
      description: true,
      type: true,
      status: true,
      capacity: true,
      virtualCapacity: true,
      scheduleMode: true,
      multiDayConfig: true,
      zoomMeetingId: true,
      zoomJoinUrl: true,
      zoomPasscode: true,
      zoomSessionKind: true,
      brandLogoUrl: true,
      bannerImageUrl: true,
      brandPrimaryColor: true,
      emailMandatoryForRegistration: true,
      blueprintTemplate: true,
      internalStaffCheckInMode: true,
      location: true,
      org: {
        select: {
          name: true,
          logo: true,
          defaultEventBrandLogoUrl: true,
          resendApiKey: true
        }
      }
    }
  });
}

type GuestCreateInput = {
  eventId: string;
  name: string;
  email: string | null;
  phone: string;
  company: string | null | undefined;
  jobTitle: string | null | undefined;
  country: string | null | undefined;
  accessibilityNotes: string | null | undefined;
  referralSource: string | null | undefined;
  staffEmployeeId: string | null | undefined;
  department: string | null | undefined;
  branch?: string | null | undefined;
  tier: Tier;
  mode: AttendMode | null;
  dietary: string | null | undefined;
  repId: string | null;
  registrationChannel: "organizer" | "public";
  eventGuestGroupId?: string | null;
  createdByUserId?: string | null;
  staffVisibleSessionId?: string | null;
};

type EventForGuestEmail = {
  name: string;
  date: Date;
  description?: string | null;
  blueprintTemplate?: EventBlueprintTemplate;
  internalStaffCheckInMode?: InternalStaffCheckInMode;
  emailMandatoryForRegistration?: boolean | null;
  /** Branding for the invitational email template (logo, banner, accent color). */
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  bannerImageUrl?: string | null;
  brandPrimaryColor?: string | null;
  location: { name: string; address: string };
  orgId: string;
  orgName: string;
  status: EventStatus;
  scheduleMode: EventScheduleMode;
  multiDayConfig: Prisma.JsonValue | null;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  zoomPasscode: string | null;
  zoomSessionKind: ZoomSessionKind;
  /** Org-specific API key from Settings → Integrations (falls back to env in send) */
  resendApiKey: string | null;
  /**
   * Optional poll notice to include in the confirmation email/SMS. Populated by
   * `publicRegisterGuest` when the event has an active or upcoming ballot.
   * Inactive or ended polls are not passed in.
   */
  pollNotice?: PollEmailNotice | null;
};

function guestEventEmailBranding(event: {
  brandLogoUrl?: string | null;
  bannerImageUrl?: string | null;
  brandPrimaryColor?: string | null;
  org: { logo: string | null; defaultEventBrandLogoUrl: string | null };
}) {
  return {
    brandLogoUrl: event.brandLogoUrl ?? null,
    bannerImageUrl: event.bannerImageUrl ?? null,
    brandPrimaryColor: event.brandPrimaryColor ?? null,
    orgLogoUrl: event.org.logo,
    orgDefaultBrandLogoUrl: event.org.defaultEventBrandLogoUrl
  };
}

function eventNotifiesGuests(status: EventStatus) {
  return status === EventStatus.PUBLISHED || status === EventStatus.LIVE;
}

/**
 * Build the voter-facing poll notice that gets attached to the confirmation
 * email + SMS + post-registration UI for a freshly registered guest. Returns
 * `null` when the event has no poll, the poll is inactive, the ballot window
 * has already closed, or we can't resolve a public absolute URL.
 */
function buildPollEmailNoticeForEvent(
  eventId: string,
  poll:
    | {
        title: string;
        instructions: string | null;
        isActive: boolean;
        isAnonymous: boolean;
        startTime: Date;
        endTime: Date;
      }
    | null
    | undefined,
  now: Date = new Date()
): PollEmailNotice | null {
  if (!poll || !poll.isActive) return null;
  if (now >= poll.endTime) return null;
  const ballotUrl = getEventPollAbsoluteUrl(eventId);
  if (!ballotUrl) return null;
  const inWindow = now >= poll.startTime && now < poll.endTime;
  return {
    title: poll.title,
    instructions: poll.instructions,
    startTimeLabel: formatDate(poll.startTime),
    endTimeLabel: formatDate(poll.endTime),
    ballotUrl,
    inWindow,
    upcoming: !inWindow,
    isAttributed: !poll.isAnonymous
  };
}

/**
 * SMS suffix advertising the ballot when the registered event has an active or
 * upcoming poll. Returns an empty string when no poll context is attached, so
 * callers can append unconditionally.
 *
 * The total SMS body is capped at 300 chars by the caller — this helper keeps
 * its payload short on purpose (≈90 chars max) so we don't get truncated.
 */
function buildPollSmsSuffix(poll: PollEmailNotice | null | undefined): string {
  if (!poll) return "";
  const lead = poll.inWindow
    ? "Vote now:"
    : poll.upcoming
      ? `Vote opens ${poll.startTimeLabel}:`
      : "Vote:";
  return ` ${lead} ${poll.ballotUrl}`;
}

/**
 * Shared invitation email payload builder used by every organizer-invite send path
 * (initial create, pending-publish flush, manual resend). Keeps the "invitational"
 * design consistent and centralizes magic-link token URLs (Phase 1).
 */
function buildOrganizerInvitationEmailPayload(args: {
  to: string;
  guest: { id: string; name: string };
  invitationToken: string;
  event: EventForGuestEmail;
  resendKey: string | undefined;
  baseUrl: string;
}) {
  const baseTrim = args.baseUrl.replace(/\/$/, "");
  const acceptUrl =
    getRsvpAcceptAbsoluteUrl(args.guest.id, args.invitationToken) ??
    `${baseTrim}/rsvp/${args.guest.id}/${args.invitationToken}`;
  const declineUrl =
    getRsvpDeclineAbsoluteUrl(args.guest.id, args.invitationToken) ??
    `${baseTrim}/rsvp/${args.guest.id}/${args.invitationToken}/decline`;

  const description = args.event.description?.trim() || null;
  const directionsUrl = args.event.location?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${args.event.location.name} ${args.event.location.address}`
      )}`
    : null;

  return {
    to: args.to,
    guestName: args.guest.name,
    eventName: args.event.name,
    eventDate: formatDate(args.event.date),
    locationLine: formatLocationLine(args.event.location),
    acceptUrl,
    declineUrl,
    orgName: args.event.orgName,
    brandLogoUrl: args.event.brandLogoUrl ?? null,
    orgLogoUrl: args.event.orgLogoUrl ?? null,
    orgDefaultBrandLogoUrl: args.event.orgDefaultBrandLogoUrl ?? null,
    bannerImageUrl: args.event.bannerImageUrl ?? null,
    brandPrimaryColor: args.event.brandPrimaryColor ?? null,
    hookCopy: description,
    directionsUrl,
    siteBaseUrl: baseTrim,
    resendApiKeyOverride: args.resendKey
  } as const;
}

async function createGuestWithSideEffects(
  input: GuestCreateInput,
  event: EventForGuestEmail
): Promise<ActionResult<GuestWithEmailStatus>> {
  const orgPlan = await getOrgPlanForLimits(event.orgId);
  if (!orgPlan) return { success: false, error: "Organization not found." };
  const guestLimit = await assertCanAddGuests(orgPlan, input.eventId, 1);
  if (!guestLimit.ok) return { success: false, error: guestLimit.error };

  const emailNorm = normalizeGuestEmailInput(input.email, isEmailMandatoryForEvent(event));
  if (isEmailMandatoryForEvent(event) && !emailNorm) {
    return { success: false, error: "Email is required for this event." };
  }
  const phoneNorm = normalizeGuestPhone(input.phone);

  if (emailNorm) {
    const dup = await prisma.guest.findFirst({
      where: { eventId: input.eventId, email: emailNorm }
    });
    if (dup) return { success: false, error: "A guest with this email is already on this event." };
  }
  const dupPhone = await prisma.guest.findFirst({
    where: { eventId: input.eventId, phone: phoneNorm }
  });
  if (dupPhone) return { success: false, error: "A guest with this phone number is already on this event." };

  let eventGuestGroupId: string | null = input.eventGuestGroupId?.trim() ? input.eventGuestGroupId.trim() : null;
  if (eventGuestGroupId) {
    const grp = await prisma.eventGuestGroup.findFirst({
      where: { id: eventGuestGroupId, eventId: input.eventId }
    });
    if (!grp) return { success: false, error: "Invalid guest group for this event." };
  } else {
    eventGuestGroupId = null;
  }

  const mdCfg = getParsedMultiDayOrNull(event.scheduleMode, event.multiDayConfig);
  const perDayVirtual = mdCfg?.virtualLinkMode === "PER_DAY";
  const joinUrlForVirtual = initialGuestVirtualJoinUrl({
    scheduleMode: event.scheduleMode,
    multiDayConfig: event.multiDayConfig,
    eventZoomJoinUrl: event.zoomJoinUrl
  });

  const mode = input.mode;
  const isWebinarVirtual =
    !perDayVirtual &&
    mode === AttendMode.VIRTUAL &&
    event.zoomMeetingId &&
    event.zoomSessionKind === ZoomSessionKind.WEBINAR;
  const isMeetingVirtual =
    mode === AttendMode.VIRTUAL &&
    (perDayVirtual
      ? Boolean(joinUrlForVirtual)
      : Boolean(event.zoomMeetingId && event.zoomSessionKind === ZoomSessionKind.MEETING));

  if (isMeetingVirtual && !perDayVirtual && !event.zoomJoinUrl) {
    return {
      success: false,
      error:
        "This event is missing its Zoom join URL. Edit the event and ensure Zoom is configured, then try again."
    };
  }

  if (isWebinarVirtual && !emailNorm) {
    return {
      success: false,
      error: "Email is required to register for this virtual webinar."
    };
  }

  const isInternalStaffOrganizerAdd =
    event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF &&
    input.registrationChannel === "organizer";

  const qrIdentifier = emailNorm || phoneNorm;
  const qrCode = isInternalStaffOrganizerAdd ? null : createGuestQrCode(input.eventId, qrIdentifier);
  const initialZoomLink: string | null = isInternalStaffOrganizerAdd
    ? null
    : isMeetingVirtual
      ? perDayVirtual
        ? joinUrlForVirtual
        : event.zoomJoinUrl
      : null;

  const invitationToken =
    input.registrationChannel === "organizer" && !isInternalStaffOrganizerAdd
      ? randomBytes(24).toString("hex")
      : null;
  const internalCheckInToken =
    isInternalStaffOrganizerAdd &&
    event.internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK
      ? newInternalCheckInToken()
      : null;
  const status =
    input.registrationChannel === "public" ? GuestStatus.REGISTERED : GuestStatus.INVITED;

  try {
    const guest = await prisma.guest.create({
      data: {
        name: input.name,
        email: emailNorm,
        phone: phoneNorm,
        company: normalizeCompanyForStorage(input.company) ?? undefined,
        jobTitle: input.jobTitle ?? undefined,
        country: input.country?.trim() || undefined,
        accessibilityNotes: input.accessibilityNotes?.trim() || undefined,
        referralSource: input.referralSource?.trim() || undefined,
        staffEmployeeId: input.staffEmployeeId?.trim() || undefined,
        department: input.department?.trim() || undefined,
        branch: input.branch?.trim() || undefined,
        tier: input.tier,
        mode,
        dietary: input.dietary ?? undefined,
        repId: input.repId ?? undefined,
        createdByUserId: input.createdByUserId ?? undefined,
        staffVisibleSessionId: input.staffVisibleSessionId ?? undefined,
        eventId: input.eventId,
        status,
        invitationToken,
        internalCheckInToken,
        qrCode,
        zoomLink: initialZoomLink,
        ...(eventGuestGroupId ? { eventGuestGroupId } : {})
      }
    });

    let zoomLink: string | null = initialZoomLink;

    if (isWebinarVirtual) {
      try {
        const { firstName, lastName } = zoomRegistrantNameParts(
          input.name,
          input.company,
          event.orgName
        );
        zoomLink = await registerWebinarRegistrant(
          event.zoomMeetingId as string,
          { email: emailNorm as string, firstName, lastName },
          event.orgId
        );
        await prisma.guest.update({
          where: { id: guest.id },
          data: { zoomLink }
        });
      } catch (e) {
        await prisma.guest.delete({ where: { id: guest.id } });
        const detail = e instanceof Error ? e.message : String(e);
        return {
          success: false,
          error: `Could not register this guest on Zoom (webinar). ${detail}`.slice(0, 700)
        };
      }
    }

    const formattedGuest = await prisma.guest.findUnique({ where: { id: guest.id } });
    if (!formattedGuest) return { success: false, error: "Failed to add guest" };

    const resendKey = event.resendApiKey?.trim() || undefined;
    const isOrganizerInvite = input.registrationChannel === "organizer" && Boolean(invitationToken);
    const deliverOrganizerInviteNow = isOrganizerInvite && eventNotifiesGuests(event.status);

    const channels = resolveGuestNotificationChannels(formattedGuest);
    const hasEmail = channels.email;
    const rsvpUrl =
      invitationToken != null
        ? getRsvpAcceptAbsoluteUrl(guest.id, invitationToken)
        : null;
    const portalUrl = getJoinPageAbsoluteUrl(guest.id);
    const joinSmsCode = await ensureGuestJoinSmsCode(guest.id);
    const smsPortalUrl = (joinSmsCode ? getGuestJoinSmsAbsoluteUrl(joinSmsCode) : null) ?? portalUrl;
    const virtualJoinUrl =
      mode === AttendMode.VIRTUAL ? getOpenZoomJoinAbsoluteUrl(guest.id) ?? zoomLink : null;
    const smsCtx = {
      eventName: event.name,
      eventDate: event.date,
      hasEmail,
      rsvpUrl,
      portalUrl: smsPortalUrl,
      virtualJoinUrl,
      attendanceMode: mode,
      pollSuffix: buildPollSmsSuffix(event.pollNotice ?? null)
    };

    let emailDelivered = false;
    let smsDelivered = false;
    try {
      if (isInternalStaffOrganizerAdd && eventNotifiesGuests(event.status)) {
        const noticeRes = await sendInternalStaffNoticeToGuestById(input.eventId, guest.id);
        emailDelivered = noticeRes.emailed;
        smsDelivered = noticeRes.smsSent;
      } else if (hasEmail) {
        if (isOrganizerInvite) {
          if (deliverOrganizerInviteNow && formattedGuest.email) {
            await sendGuestInvitationEmail(
              buildOrganizerInvitationEmailPayload({
                to: formattedGuest.email,
                guest: { id: guest.id, name: formattedGuest.name },
                invitationToken: invitationToken as string,
                event,
                resendKey,
                baseUrl: getPublicSiteUrl()
              })
            );
            await prisma.guest.update({
              where: { id: guest.id },
              data: { invitationEmailSentAt: new Date() }
            });
            emailDelivered = true;
            void logGuestNotificationDelivery({
              guestId: guest.id,
              eventId: input.eventId,
              kind: isOrganizerInvite ? "invite" : "registration_confirm",
              deliveryChannel: "EMAIL",
              status: "SENT",
              recipient: formattedGuest.email,
              detail: "email"
            });
          }
        } else if (formattedGuest.email) {
          emailDelivered = await sendGuestEmailsAfterCreate(formattedGuest, event, zoomLink, resendKey);
          if (emailDelivered) {
            void logGuestNotificationDelivery({
              guestId: guest.id,
              eventId: input.eventId,
              kind: "registration_confirm",
              deliveryChannel: "EMAIL",
              status: "SENT",
              recipient: formattedGuest.email,
              detail: "email"
            });
          }
        }
      } else {
        void logGuestNotificationDelivery({
          guestId: guest.id,
          eventId: input.eventId,
          kind: isOrganizerInvite ? "invite" : "registration_confirm",
          deliveryChannel: "SMS",
          status: "SKIPPED",
          detail: "no deliverable email"
        });
      }
    } catch (e) {
      console.error("[guest] guest email failed", e);
      void logGuestNotificationDelivery({
        guestId: guest.id,
        eventId: input.eventId,
        kind: isOrganizerInvite ? "invite" : "registration_confirm",
        deliveryChannel: "EMAIL",
        status: "FAILED",
        recipient: formattedGuest.email,
        detail: e instanceof Error ? e.message : String(e)
      });
    }
    try {
      const to = phoneToMnotifyRecipient(formattedGuest.phone);
      if (to) {
        let smsBody = "";
        if (deliverOrganizerInviteNow) {
          smsBody = renderGuestInviteSms(smsCtx);
        } else if (input.registrationChannel === "public") {
          smsBody = renderGuestRegistrationConfirmSms(smsCtx);
        }
        if (smsBody) {
          const smsRes = await sendOrgMnotifyQuickSms(event.orgId, [to], smsBody);
          if (smsRes.ok) smsDelivered = true;
          await logMnotifySmsDelivery({
            orgId: event.orgId,
            guestId: guest.id,
            eventId: input.eventId,
            kind: isOrganizerInvite ? "invite" : "registration_confirm",
            recipient: formattedGuest.phone,
            messageBody: smsBody,
            smsRes
          });
        }
      } else if (input.registrationChannel === "public" || deliverOrganizerInviteNow) {
        console.error("[guest] confirmation sms skipped: invalid phone for mNotify");
        void logGuestNotificationDelivery({
          guestId: guest.id,
          eventId: input.eventId,
          kind: isOrganizerInvite ? "invite" : "registration_confirm",
          deliveryChannel: "SMS",
          status: "SKIPPED",
          recipient: formattedGuest.phone,
          detail: "Invalid phone for SMS.",
          errorCode: "INVALID_PHONE"
        });
      }
    } catch (e) {
      console.error("[guest] confirmation sms failed", e);
    }

    void syncOrgContactForGuest(event.orgId, {
      id: formattedGuest.id,
      name: formattedGuest.name,
      email: formattedGuest.email,
      phone: formattedGuest.phone,
      staffEmployeeId: formattedGuest.staffEmployeeId,
      department: formattedGuest.department,
      branch: formattedGuest.branch,
      company: formattedGuest.company,
      jobTitle: formattedGuest.jobTitle
    });

    revalidatePath(`/events/${input.eventId}/guests`);
    revalidatePath(`/register/${input.eventId}`);
    const invitationPendingUntilPublish = isOrganizerInvite && !deliverOrganizerInviteNow;
    const refreshed = await prisma.guest.findUnique({ where: { id: guest.id } });
    const guestOut = refreshed ?? formattedGuest;
    return {
      success: true,
      data: {
        ...guestOut,
        emailDelivered,
        smsDelivered,
        ...(invitationPendingUntilPublish ? { invitationPendingUntilPublish: true as const } : {})
      }
    };
  } catch {
    return { success: false, error: "Failed to add guest" };
  }
}

/** Organizer invites created while the event was draft: deliver email+SMS once the event is published/live. */
export async function sendPendingOrganizerInvitesForEvent(eventId: string): Promise<{ sent: number }> {
  await syncEventStatusForEvent(eventId);
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    include: {
      location: true,
      org: {
        select: {
          name: true,
          logo: true,
          defaultEventBrandLogoUrl: true,
          resendApiKey: true
        }
      }
    }
  });
  if (!event || !eventNotifiesGuests(event.status)) {
    return { sent: 0 };
  }

  const pending = await prisma.guest.findMany({
    where: {
      eventId,
      status: GuestStatus.INVITED,
      invitationToken: { not: null },
      invitationEmailSentAt: null,
      notificationsSuppressedAt: null
    },
    select: { id: true, email: true, name: true, phone: true, invitationToken: true }
  });

  const resendKey = event.org.resendApiKey?.trim() || undefined;
  let sent = 0;
  for (const g of pending) {
    const token = g.invitationToken;
    if (!token) continue;
    try {
      const channels = resolveGuestNotificationChannels(g);
      const hasEmail = channels.email && g.email;
      const smsCtx = {
        eventName: event.name,
        eventDate: event.date,
        hasEmail: Boolean(hasEmail),
        rsvpUrl: getRsvpAcceptAbsoluteUrl(g.id, token),
        portalUrl: await resolveGuestSmsPortalUrl(g.id)
      };
      const eventPayload: EventForGuestEmail = {
        name: event.name,
        date: event.date,
        description: event.description,
        emailMandatoryForRegistration: event.emailMandatoryForRegistration,
        ...guestEventEmailBranding(event),
        location: event.location ?? { name: "", address: "" },
        orgId: event.orgId,
        orgName: event.org.name,
        status: event.status,
        scheduleMode: event.scheduleMode,
        multiDayConfig: event.multiDayConfig,
        zoomMeetingId: event.zoomMeetingId,
        zoomJoinUrl: event.zoomJoinUrl,
        zoomPasscode: event.zoomPasscode,
        zoomSessionKind: event.zoomSessionKind,
        resendApiKey: event.org.resendApiKey
      };

      if (hasEmail && g.email) {
        await sendGuestInvitationEmail(
          buildOrganizerInvitationEmailPayload({
            to: g.email,
            guest: { id: g.id, name: g.name },
            invitationToken: token,
            event: eventPayload,
            resendKey,
            baseUrl: getPublicSiteUrl()
          })
        );
        await prisma.guest.update({
          where: { id: g.id },
          data: { invitationEmailSentAt: new Date() }
        });
        void logGuestNotificationDelivery({
          guestId: g.id,
          eventId,
          kind: "invite",
          deliveryChannel: "EMAIL",
          status: "SENT",
          recipient: g.email,
          detail: "email"
        });
      } else {
        void logGuestNotificationDelivery({
          guestId: g.id,
          eventId,
          kind: "invite",
          deliveryChannel: "EMAIL",
          status: "SKIPPED",
          detail: "no deliverable email"
        });
      }

      const to = phoneToMnotifyRecipient(g.phone);
      if (to) {
        const smsBody = renderGuestInviteSms(smsCtx);
        const smsRes = await sendOrgMnotifyQuickSms(event.orgId, [to], smsBody);
        await logMnotifySmsDelivery({
          orgId: event.orgId,
          guestId: g.id,
          eventId,
          kind: "invite",
          recipient: g.phone,
          messageBody: smsBody,
          smsRes
        });
        if (smsRes.ok) {
          if (!hasEmail) {
            await prisma.guest.update({
              where: { id: g.id },
              data: { invitationEmailSentAt: new Date() }
            });
          }
        }
      } else if (g.phone?.trim()) {
        void logGuestNotificationDelivery({
          guestId: g.id,
          eventId,
          kind: "invite",
          channel: "SMS_ONLY",
          status: "SKIPPED",
          recipient: g.phone,
          detail: "Invalid phone for SMS."
        });
      }
      sent++;
    } catch (e) {
      console.error("[guest] pending organizer invite failed", g.id, e);
      void logGuestNotificationDelivery({
        guestId: g.id,
        eventId,
        kind: "invite",
        channel: "EMAIL",
        status: "FAILED",
        detail: e instanceof Error ? e.message : String(e)
      });
    }
  }

  if (sent > 0) {
    revalidatePath(`/events/${eventId}/guests`);
    revalidatePath(`/events/${eventId}/deliveries`);
    revalidatePath(`/register/${eventId}`);
  }
  return { sent };
}

const publicRegisterObjectSchema = z.object({
    eventId: z.string().min(1),
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    phone: z.string().min(1, "Mobile phone is required"),
    company: z.string().optional().nullable(),
    jobTitle: z.string().optional().nullable(),
    staffEmployeeId: z.string().max(120).optional().nullable(),
    department: z.string().max(120).optional().nullable(),
    country: z.string().max(32).optional().nullable(),
    accessibilityNotes: z.string().max(2000).optional().nullable(),
    referralSource: z.string().max(80).optional().nullable(),
    mode: z.nativeEnum(AttendMode),
    dietary: z.string().optional().nullable(),
    marketingOptIn: z.boolean().optional().default(false)
  });

function buildPublicRegisterSchema(emailRequired: boolean) {
  return publicRegisterObjectSchema
    .extend({ email: guestEmailFieldSchema(emailRequired) })
    .strict()
    .superRefine((data, ctx) => {
      if (!isValidE164(data.phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter phone in international format, e.g. +233501234567.",
          path: ["phone"]
        });
      }
    });
}

const lookupPriorGuestSchema = z.object({
  eventId: z.string().min(1),
  email: z.string().email()
});

type RegistrationMergeRow = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  country: string | null;
};

function splitGuestOrContactName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] ?? "" };
}

function nameScore(r: RegistrationMergeRow): number {
  return (r.firstName.trim() + " " + r.lastName.trim()).trim().length;
}

function mergeRegistrationRows(rows: RegistrationMergeRow[]): RegistrationMergeRow | null {
  const valid = rows.filter((r) => nameScore(r) > 0 || r.email || r.phone);
  if (valid.length === 0) return null;
  const best = valid.reduce((a, b) => (nameScore(a) >= nameScore(b) ? a : b));
  const out: RegistrationMergeRow = { ...best };
  for (const r of valid) {
    if (!out.email?.trim() && r.email?.trim()) out.email = r.email.trim().toLowerCase();
    if (!out.phone?.trim() && r.phone?.trim()) out.phone = r.phone.trim();
    if (!out.company?.trim() && r.company?.trim()) out.company = r.company;
    if (!out.jobTitle?.trim() && r.jobTitle?.trim()) out.jobTitle = r.jobTitle;
    if (!out.country?.trim() && r.country?.trim()) out.country = r.country;
  }
  return out;
}

const lookupPublicRegistrationSchema = z
  .object({
    eventId: z.string().min(1),
    email: z.string().optional(),
    phoneDialCode: z.string().optional(),
    phoneNational: z.string().optional()
  })
  .superRefine((data, ctx) => {
    const em = (data.email ?? "").trim();
    const nat = (data.phoneNational ?? "").trim();
    if (!em && !nat) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter your work email or mobile number to look up your profile.",
        path: ["email"]
      });
      return;
    }
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid email address.",
        path: ["email"]
      });
    }
    if (nat) {
      const dial = (data.phoneDialCode ?? "").trim() || DEFAULT_PHONE_DIAL;
      const normalized = normalizeNationalDigits(nat, dial);
      if (!isValidNationalForDial(dial, normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid mobile number for the selected country code.",
          path: ["phoneNational"]
        });
      }
    }
  });

export type PriorGuestProfilePayload = {
  firstName: string;
  lastName: string;
  /** Work email when known from past registrations or CRM. */
  email: string | null;
  phone: string | null;
  phoneDialCode: string;
  phoneNational: string;
  company: string | null;
  jobTitle: string | null;
  country: string | null;
};

export async function lookupPublicRegistrationProfile(
  input: z.input<typeof lookupPublicRegistrationSchema>
): Promise<ActionResult<PriorGuestProfilePayload | null>> {
  const parsed = lookupPublicRegistrationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  await syncEventStatusForEvent(parsed.data.eventId);
  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] } },
    select: { orgId: true }
  });
  if (!event) {
    return { success: false, error: "Registration is not open for this event." };
  }

  const orgId = event.orgId;
  const eventId = parsed.data.eventId;
  const emailInput = (parsed.data.email ?? "").trim().toLowerCase();
  const hasEmail = Boolean(emailInput && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput));
  const dialIn = (parsed.data.phoneDialCode ?? "").trim() || DEFAULT_PHONE_DIAL;
  const natRaw = (parsed.data.phoneNational ?? "").trim();
  let phoneE164: string | null = null;
  if (natRaw) {
    const nat = normalizeNationalDigits(natRaw, dialIn);
    if (isValidNationalForDial(dialIn, nat)) {
      phoneE164 = composeE164(dialIn, nat);
    }
  }

  const rows: RegistrationMergeRow[] = [];

  if (hasEmail) {
    const g = await findPriorGuestProfileForOrg(orgId, eventId, emailInput);
    if (g) {
      rows.push({
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email,
        phone: g.phone,
        company: g.company,
        jobTitle: g.jobTitle,
        country: g.country
      });
    }
    const contact = await prisma.orgContact.findFirst({
      where: { orgId, email: emailInput },
      select: { name: true, email: true, phone: true, company: true, jobTitle: true }
    });
    if (contact) {
      const nm = splitGuestOrContactName(contact.name);
      rows.push({
        firstName: nm.firstName,
        lastName: nm.lastName,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        jobTitle: contact.jobTitle,
        country: null
      });
    }
  }

  if (phoneE164) {
    const g2 = await findPriorGuestProfileForOrgByPhone(orgId, eventId, phoneE164);
    if (g2) {
      rows.push({
        firstName: g2.firstName,
        lastName: g2.lastName,
        email: g2.email,
        phone: g2.phone,
        company: g2.company,
        jobTitle: g2.jobTitle,
        country: g2.country
      });
    }
    const contact2 = await prisma.orgContact.findFirst({
      where: { orgId, phone: phoneE164 },
      select: { name: true, email: true, phone: true, company: true, jobTitle: true }
    });
    if (contact2) {
      const nm2 = splitGuestOrContactName(contact2.name);
      rows.push({
        firstName: nm2.firstName,
        lastName: nm2.lastName,
        email: contact2.email,
        phone: contact2.phone,
        company: contact2.company,
        jobTitle: contact2.jobTitle,
        country: null
      });
    }
  }

  const merged = mergeRegistrationRows(rows);
  if (!merged) return { success: true, data: null };

  const phoneForParse = merged.phone?.trim() || phoneE164;
  const { dial, national } = parseStoredPhoneToForm(phoneForParse);

  return {
    success: true,
    data: {
      firstName: merged.firstName,
      lastName: merged.lastName,
      email: merged.email?.trim() || (hasEmail ? emailInput : null),
      phone: merged.phone,
      phoneDialCode: dial,
      phoneNational: national,
      company: merged.company,
      jobTitle: merged.jobTitle,
      country: merged.country
    }
  };
}

export async function lookupPriorGuestProfileForPublic(
  input: z.input<typeof lookupPriorGuestSchema>
): Promise<ActionResult<PriorGuestProfilePayload | null>> {
  const parsed = lookupPriorGuestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  return lookupPublicRegistrationProfile({
    eventId: parsed.data.eventId,
    email: parsed.data.email
  });
}

export async function publicRegisterGuest(
  input: z.input<ReturnType<typeof buildPublicRegisterSchema>>
): Promise<ActionResult<GuestWithEmailStatus>> {
  await syncEventStatusForEvent(
    typeof input === "object" && input && "eventId" in input ? String(input.eventId) : ""
  );
  const event = await getEventForPublicRegistration(
    typeof input === "object" && input && "eventId" in input ? String(input.eventId) : ""
  );
  if (!event) {
    return { success: false, error: "Registration is not open for this event." };
  }

  const emailRequired = isEmailMandatoryForEvent(event);
  const parsed = buildPublicRegisterSchema(emailRequired).safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const regProfile = parseRegistrationProfile(event.registrationProfile);
  if (regProfile.requireCompany && !parsed.data.company?.trim()) {
    return { success: false, error: "Company is required for this event." };
  }
  if (regProfile.requireJobTitle && !parsed.data.jobTitle?.trim()) {
    return { success: false, error: "Job title is required for this event." };
  }
  if (regProfile.requireStaffId && !parsed.data.staffEmployeeId?.trim()) {
    return { success: false, error: "Staff ID is required for this event." };
  }
  if (regProfile.requireDepartment && !parsed.data.department?.trim()) {
    return { success: false, error: "Department is required for this event." };
  }

  if (!isPublicSelfRegistrationOpen(event.scheduleMode, event.multiDayConfig)) {
    return {
      success: false,
      error:
        "Self-registration for this multi-day event was limited to day 1, and that window has closed. Contact the organizer to be added."
    };
  }

  if (
    parsed.data.mode === AttendMode.VIRTUAL &&
    !eventHasVirtualJoinFromConfig({
      virtualCapacity: event.virtualCapacity,
      scheduleMode: event.scheduleMode,
      multiDayConfig: event.multiDayConfig,
      zoomJoinUrl: event.zoomJoinUrl,
      zoomMeetingId: event.zoomMeetingId
    })
  ) {
    return {
      success: false,
      error: "Virtual attendance is not available for this event."
    };
  }
  if (
    parsed.data.mode === AttendMode.VIRTUAL &&
    event.zoomMeetingId &&
    event.zoomSessionKind === ZoomSessionKind.MEETING &&
    !event.zoomJoinUrl &&
    getParsedMultiDayOrNull(event.scheduleMode, event.multiDayConfig)?.virtualLinkMode !== "PER_DAY"
  ) {
    return {
      success: false,
      error: "This event is missing its Zoom join URL. Please contact the organizer."
    };
  }

  const modeOk =
    event.type === EventType.HYBRID ||
    (event.type === EventType.IN_PERSON && parsed.data.mode === AttendMode.IN_PERSON) ||
    (event.type === EventType.VIRTUAL && parsed.data.mode === AttendMode.VIRTUAL);
  if (!modeOk) {
    return { success: false, error: "This attendance mode is not available for this event." };
  }

  const inPersonCount = await prisma.guest.count({
    where: {
      eventId: event.id,
      mode: AttendMode.IN_PERSON,
      status: { not: GuestStatus.DECLINED }
    }
  });
  const virtualCount = await prisma.guest.count({
    where: {
      eventId: event.id,
      mode: AttendMode.VIRTUAL,
      status: { not: GuestStatus.DECLINED }
    }
  });

  if (parsed.data.mode === AttendMode.IN_PERSON && inPersonCount >= event.capacity) {
    return { success: false, error: "In-person registration is full for this event." };
  }
  if (
    parsed.data.mode === AttendMode.VIRTUAL &&
    (event.virtualCapacity <= 0 || virtualCount >= event.virtualCapacity)
  ) {
    return { success: false, error: "Virtual registration is full for this event." };
  }

  const fullName = [parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(" ").trim();
  const countryNorm = parsed.data.country?.trim() || null;
  const referralNorm = parsed.data.referralSource?.trim() || null;

  const pollNotice = buildPollEmailNoticeForEvent(event.id, event.poll);

  const result = await createGuestWithSideEffects(
    {
      eventId: parsed.data.eventId,
      name: fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      jobTitle: parsed.data.jobTitle,
      country: countryNorm || undefined,
      accessibilityNotes: parsed.data.accessibilityNotes?.trim() || undefined,
      referralSource: referralNorm || undefined,
      staffEmployeeId: parsed.data.staffEmployeeId?.trim() || undefined,
      department: parsed.data.department?.trim() || undefined,
      tier: Tier.C,
      mode: parsed.data.mode,
      dietary: parsed.data.dietary,
      repId: null,
      registrationChannel: "public"
    },
    {
      name: event.name,
      date: event.date,
      emailMandatoryForRegistration: event.emailMandatoryForRegistration,
      ...guestEventEmailBranding(event),
      location: event.location,
      orgId: event.orgId,
      orgName: event.org.name,
      status: event.status,
      scheduleMode: event.scheduleMode,
      multiDayConfig: event.multiDayConfig,
      zoomMeetingId: event.zoomMeetingId,
      zoomJoinUrl: event.zoomJoinUrl,
      zoomPasscode: event.zoomPasscode,
      zoomSessionKind: event.zoomSessionKind,
      resendApiKey: event.org.resendApiKey,
      pollNotice
    }
  );

  if (result.success && result.data) {
    if (
      shouldShowMarketingOptIn(
        { blueprintTemplate: event.blueprintTemplate },
        {
          name: event.org.name,
          marketingEmailEnabled: event.org.marketingEmailEnabled,
          marketingConsentCopy: event.org.marketingConsentCopy,
          marketingPrivacyPolicyUrl: event.org.marketingPrivacyPolicyUrl
        }
      )
    ) {
      try {
        await recordGuestMarketingConsent({
          guestId: result.data.id,
          marketingOptIn: parsed.data.marketingOptIn ?? false,
          consentSource: EmailMarketingConsentSource.PUBLIC_REGISTER
        });
      } catch (e) {
        console.error("[guest] marketing consent record failed", e);
      }
    }
  }

  /**
   * Forward the poll notice to the form's success card so the post-registration
   * UI can render "you qualify to vote" + the How-to-vote popup. Only surfaced
   * on success — failures keep the original error contract.
   */
  if (result.success && result.data && pollNotice) {
    return {
      ...result,
      data: { ...result.data, poll: pollNotice }
    };
  }
  return result;
}

export async function addGuest(
  input: z.input<ReturnType<typeof buildGuestBaseSchema>>
): Promise<ActionResult<GuestWithEmailStatus>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const eventId =
    typeof input === "object" && input && "eventId" in input ? String(input.eventId) : "";
  const event = await getEventForGuestAction(eventId, session.user.orgId);
  if (!event) return { success: false, error: "Event not found" };

  const parsed = buildGuestBaseSchema(isEmailMandatoryForEvent(event)).safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const resolvedMode =
    parsed.data.mode ?? initialModeForOrganizerGuest({ type: event.type, virtualCapacity: event.virtualCapacity });

  if (
    resolvedMode === AttendMode.VIRTUAL &&
    !eventHasVirtualJoinFromConfig({
      virtualCapacity: event.virtualCapacity,
      scheduleMode: event.scheduleMode,
      multiDayConfig: event.multiDayConfig,
      zoomJoinUrl: event.zoomJoinUrl,
      zoomMeetingId: event.zoomMeetingId
    })
  ) {
    return {
      success: false,
      error:
        "This event has no Zoom link. Add virtual capacity on the event or choose in-person attendance."
    };
  }
  if (
    resolvedMode === AttendMode.VIRTUAL &&
    event.zoomMeetingId &&
    event.zoomSessionKind === ZoomSessionKind.MEETING &&
    !event.zoomJoinUrl &&
    getParsedMultiDayOrNull(event.scheduleMode, event.multiDayConfig)?.virtualLinkMode !== "PER_DAY"
  ) {
    return {
      success: false,
      error:
        "This event is missing its Zoom join URL. Edit the event and ensure Zoom is configured, then try again."
    };
  }

  let repId = parsed.data.repId?.trim() || null;
  if (isSalesRepRole(session.user.role)) {
    repId = repId ?? session.user.id;
  }

  return createGuestWithSideEffects(
    {
      eventId: parsed.data.eventId,
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone,
      company: parsed.data.company,
      jobTitle: parsed.data.jobTitle,
      country: parsed.data.country?.trim() || undefined,
      accessibilityNotes: parsed.data.accessibilityNotes?.trim() || undefined,
      referralSource: parsed.data.referralSource?.trim() || undefined,
      staffEmployeeId: parsed.data.staffEmployeeId?.trim() || undefined,
      department: parsed.data.department?.trim() || undefined,
      branch: parsed.data.branch?.trim() || undefined,
      tier: parsed.data.tier,
      mode: resolvedMode,
      dietary: parsed.data.dietary,
      repId,
      registrationChannel: "organizer",
      eventGuestGroupId: parsed.data.eventGuestGroupId
    },
    {
      name: event.name,
      date: event.date,
      emailMandatoryForRegistration: event.emailMandatoryForRegistration,
      ...guestEventEmailBranding(event),
      location: event.location,
      orgId: event.orgId,
      orgName: event.org.name,
      status: event.status,
      scheduleMode: event.scheduleMode,
      multiDayConfig: event.multiDayConfig,
      zoomMeetingId: event.zoomMeetingId,
      zoomJoinUrl: event.zoomJoinUrl,
      zoomPasscode: event.zoomPasscode,
      zoomSessionKind: event.zoomSessionKind,
      resendApiKey: event.org.resendApiKey
    }
  );
}

async function sendGuestEmailsAfterCreate(
  guest: {
    id: string;
    name: string;
    email: string | null;
    mode: AttendMode | null;
    qrCode: string | null;
  },
  event: EventForGuestEmail,
  zoomLink: string | null,
  resendApiKeyOverride?: string
): Promise<boolean> {
  if (!guestHasDeliverableEmail(guest.email)) return false;
  const to = guest.email as string;
  const eventDate = formatDate(event.date);

  if (guest.mode === AttendMode.IN_PERSON && guest.qrCode) {
    const png = await guestQrToPngBase64(guest.qrCode);
    const directionsUrl = event.location?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${event.location.name} ${event.location.address}`
        )}`
      : null;
    await sendGuestConfirmationInPerson({
      to,
      guestName: guest.name,
      eventName: event.name,
      eventDate,
      location: formatLocationLine(event.location),
      qrPngBase64: png,
      directionsUrl,
      poll: event.pollNotice ?? null,
      orgName: event.orgName,
      brandLogoUrl: event.brandLogoUrl ?? null,
      orgLogoUrl: event.orgLogoUrl ?? null,
      orgDefaultBrandLogoUrl: event.orgDefaultBrandLogoUrl ?? null,
      brandPrimaryColor: event.brandPrimaryColor ?? null,
      resendApiKeyOverride
    });
    return true;
  }

  const mdCfg = getParsedMultiDayOrNull(event.scheduleMode, event.multiDayConfig);
  const perDayVirtual = mdCfg?.virtualLinkMode === "PER_DAY";
  const effectiveZoomLink = zoomLink ?? event.zoomJoinUrl;
  const virtualLike =
    guest.mode === AttendMode.VIRTUAL || (guest.mode == null && Boolean(effectiveZoomLink));

  if (virtualLike && effectiveZoomLink && (event.zoomMeetingId || perDayVirtual)) {
    const perGuestOpenZoom = getOpenZoomJoinAbsoluteUrl(guest.id);
    await sendGuestConfirmationVirtual({
      to,
      guestName: guest.name,
      eventName: event.name,
      eventDate,
      zoomSessionKind: event.zoomSessionKind,
      /** Always prefer Eventflow `/join/.../open-zoom` in email so attendance + Zoom use this guest’s link. */
      zoomJoinUrl: perGuestOpenZoom ?? effectiveZoomLink,
      zoomLinkTracksAttendance: Boolean(perGuestOpenZoom),
      meetingId: event.zoomMeetingId,
      passcode: event.zoomPasscode,
      joinPageUrl: getJoinPageAbsoluteUrl(guest.id),
      poll: event.pollNotice ?? null,
      orgName: event.orgName,
      brandLogoUrl: event.brandLogoUrl ?? null,
      orgLogoUrl: event.orgLogoUrl ?? null,
      orgDefaultBrandLogoUrl: event.orgDefaultBrandLogoUrl ?? null,
      brandPrimaryColor: event.brandPrimaryColor ?? null,
      resendApiKeyOverride
    });
    return true;
  }

  return false;
}

export async function updateGuestDetails(
  input: z.input<ReturnType<typeof buildUpdateGuestDetailsSchema>>
): Promise<ActionResult<Guest>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const guestId =
    typeof input === "object" && input && "guestId" in input ? String(input.guestId) : "";
  const eventId =
    typeof input === "object" && input && "eventId" in input ? String(input.eventId) : "";

  const eventRow = await getEventForGuestAction(eventId, session.user.orgId);
  if (!eventRow) return { success: false, error: "Event not found." };

  const parsed = buildUpdateGuestDetailsSchema(isEmailMandatoryForEvent(eventRow)).safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.guest.findFirst({
    where: {
      id: guestId || parsed.data.guestId,
      eventId: parsed.data.eventId,
      event: { orgId: session.user.orgId }
    },
    select: { id: true, repId: true, email: true, eventId: true }
  });
  if (!existing) return { success: false, error: "Guest not found." };
  if (!mayEditOrDeleteGuestRow(session.user.role, session.user.id, existing.repId)) {
    return { success: false, error: "You do not have permission to edit this guest." };
  }

  const emailNorm = normalizeGuestEmailInput(parsed.data.email, isEmailMandatoryForEvent(eventRow));
  if (isEmailMandatoryForEvent(eventRow) && !emailNorm) {
    return { success: false, error: "Email is required for this event." };
  }
  const phoneNorm = normalizeGuestPhone(parsed.data.phone);
  const existingEmail = existing.email?.trim().toLowerCase() ?? null;
  if (emailNorm && emailNorm !== existingEmail) {
    const dup = await prisma.guest.findFirst({
      where: { eventId: parsed.data.eventId, email: emailNorm, NOT: { id: existing.id } }
    });
    if (dup) return { success: false, error: "Another guest on this event already uses this email." };
  }
  const dupPhone = await prisma.guest.findFirst({
    where: { eventId: parsed.data.eventId, phone: phoneNorm, NOT: { id: existing.id } }
  });
  if (dupPhone) return { success: false, error: "Another guest on this event already uses this phone number." };

  let repId = parsed.data.repId?.trim() || null;
  if (isSalesRepRole(session.user.role)) {
    repId = session.user.id;
  }

  if (parsed.data.eventGuestGroupId !== undefined && parsed.data.eventGuestGroupId !== null) {
    const grp = await prisma.eventGuestGroup.findFirst({
      where: { id: parsed.data.eventGuestGroupId, eventId: parsed.data.eventId }
    });
    if (!grp) return { success: false, error: "Invalid guest group for this event." };
  }

  try {
    const guest = await prisma.guest.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name.trim(),
        email: emailNorm,
        phone: phoneNorm,
        company: normalizeCompanyForStorage(parsed.data.company) ?? undefined,
        jobTitle: parsed.data.jobTitle?.trim() || undefined,
        country: parsed.data.country?.trim() || undefined,
        accessibilityNotes: parsed.data.accessibilityNotes?.trim() || undefined,
        referralSource: parsed.data.referralSource?.trim() || undefined,
        staffEmployeeId: parsed.data.staffEmployeeId?.trim() || null,
        department: parsed.data.department?.trim() || null,
        branch: parsed.data.branch?.trim() || null,
        tier: parsed.data.tier,
        ...(parsed.data.mode !== undefined ? { mode: parsed.data.mode } : {}),
        ...(parsed.data.eventGuestGroupId !== undefined ? { eventGuestGroupId: parsed.data.eventGuestGroupId } : {}),
        dietary: parsed.data.dietary?.trim() || undefined,
        repId
      }
    });
    revalidatePath(`/events/${parsed.data.eventId}/guests`);
    revalidatePath(`/events/${parsed.data.eventId}/checkin`);
    revalidatePath(`/register/${parsed.data.eventId}`);

    const orgId = (await prisma.event.findUnique({
      where: { id: parsed.data.eventId },
      select: { orgId: true }
    }))?.orgId;
    if (orgId) {
      void syncOrgContactForGuest(orgId, {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        staffEmployeeId: guest.staffEmployeeId,
        department: guest.department,
        branch: guest.branch,
        company: guest.company,
        jobTitle: guest.jobTitle
      });
    }

    return { success: true, data: guest };
  } catch {
    return { success: false, error: "Could not update guest." };
  }
}

const resendGuestInvitationSchema = z.object({
  eventId: z.string().min(1),
  guestId: z.string().min(1)
});

/** Resend the guest’s invitation email (QR + venue for in-person, join/Zoom for virtual, or personal staff link). */
export async function resendGuestInvitationEmail(
  input: z.input<typeof resendGuestInvitationSchema>
): Promise<ActionResult<{ sent: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = resendGuestInvitationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  await syncEventStatusForEvent(parsed.data.eventId);

  const guest = await prisma.guest.findFirst({
    where: {
      id: parsed.data.guestId,
      eventId: parsed.data.eventId,
      event: { orgId: session.user.orgId }
    },
    include: {
      event: {
        include: {
          location: true,
          org: {
            select: {
              name: true,
              logo: true,
              defaultEventBrandLogoUrl: true,
              resendApiKey: true
            }
          }
        }
      }
    }
  });
  if (!guest) return { success: false, error: "Guest not found." };
  if (!mayEditOrDeleteGuestRow(session.user.role, session.user.id, guest.repId)) {
    return { success: false, error: "You do not have permission to resend for this guest." };
  }
  if (guest.status === GuestStatus.DECLINED) {
    return {
      success: false,
      error: "This guest declined the invitation. Resend is disabled — use a new invite or contact them directly."
    };
  }

  const event = guest.event;
  if (!eventAllowsGuestInvitationResend({ status: event.status, endDate: event.endDate })) {
    return {
      success: false,
      error:
        "Invitations can only be resent while the event is published or live and before it has ended (including the post-event window)."
    };
  }
  const resendKey = event.org.resendApiKey?.trim() || undefined;

  if (guest.status === GuestStatus.INVITED && guest.invitationToken) {
    if (!guestHasDeliverableEmail(guest.email)) {
      return {
        success: false,
        error:
          "This guest has no email on file. Use SMS resend or add an email address on the guest record."
      };
    }
    try {
      const emailRes = await sendGuestInvitationEmail(
        buildOrganizerInvitationEmailPayload({
          to: guest.email as string,
          guest: { id: guest.id, name: guest.name },
          invitationToken: guest.invitationToken,
          event: {
            name: event.name,
            date: event.date,
            description: event.description,
            ...guestEventEmailBranding(event),
            location: event.location ?? { name: "", address: "" },
            orgId: event.orgId,
            orgName: event.org.name,
            status: event.status,
            scheduleMode: event.scheduleMode,
            multiDayConfig: event.multiDayConfig,
            zoomMeetingId: event.zoomMeetingId,
            zoomJoinUrl: event.zoomJoinUrl,
            zoomPasscode: event.zoomPasscode,
            zoomSessionKind: event.zoomSessionKind,
            resendApiKey: event.org.resendApiKey
          },
          resendKey,
          baseUrl: getPublicSiteUrl()
        })
      );
      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationEmailSentAt: new Date() }
      });
      await logResendEmailDelivery({
        orgId: event.orgId,
        guestId: guest.id,
        eventId: parsed.data.eventId,
        kind: "invite_resend",
        recipient: guest.email,
        resendMessageId: emailRes?.id ?? null
      });
      revalidatePath(`/events/${parsed.data.eventId}/guests`);
      revalidatePath(`/events/${parsed.data.eventId}/deliveries`);
      return { success: true, data: { sent: true } };
    } catch (e) {
      console.error("[guest] resend invitation email", e);
      await logResendEmailDelivery({
        orgId: event.orgId,
        guestId: guest.id,
        eventId: parsed.data.eventId,
        kind: "invite_resend",
        recipient: guest.email,
        sendFailed: true,
        sendError: e instanceof Error ? e.message : String(e)
      });
      return { success: false, error: "Email could not be sent. Check Resend settings and try again." };
    }
  }

  const eventEmail: EventForGuestEmail = {
    name: event.name,
    date: event.date,
    location: event.location,
    ...guestEventEmailBranding(event),
    orgId: event.orgId,
    orgName: event.org.name,
    status: event.status,
    scheduleMode: event.scheduleMode,
    multiDayConfig: event.multiDayConfig,
    zoomMeetingId: event.zoomMeetingId,
    zoomJoinUrl: event.zoomJoinUrl,
    zoomPasscode: event.zoomPasscode,
    zoomSessionKind: event.zoomSessionKind,
    resendApiKey: event.org.resendApiKey
  };

  const isInternalStaffRosterGuest =
    event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF &&
    !guest.invitationToken &&
    !guest.qrCode &&
    !guest.zoomLink;

  if (isInternalStaffRosterGuest) {
    if (!guestHasDeliverableEmail(guest.email) && !guest.phone?.trim()) {
      return {
        success: false,
        error: "This guest has no deliverable email or phone for a staff notice."
      };
    }
    const noticeRes = await sendInternalStaffNoticeToGuestById(parsed.data.eventId, guest.id);
    if (!noticeRes.emailed && !noticeRes.smsSent) {
      return { success: false, error: "Staff notice could not be sent. Check Resend and mNotify settings." };
    }
    revalidatePath(`/events/${parsed.data.eventId}/guests`);
    revalidatePath(`/events/${parsed.data.eventId}/deliveries`);
    return { success: true, data: { sent: true } };
  }

  const isInternalPersonalLink =
    event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF &&
    event.internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK &&
    Boolean(guest.internalCheckInToken) &&
    !guest.qrCode &&
    !guest.zoomLink;

  try {
    if (!guestHasDeliverableEmail(guest.email)) {
      return {
        success: false,
        error:
          "This guest has no email on file. Use SMS resend or add an email address on the guest record."
      };
    }
    const guestEmail = guest.email as string;
    if (isInternalPersonalLink) {
      const token = guest.internalCheckInToken as string;
      const url = getInternalStaffMagicCheckInUrl(event.id, token);
      if (!url) {
        return {
          success: false,
          error: "Public site URL is not configured (NEXTAUTH_URL / PUBLIC_APP_URL), so the check-in link cannot be built."
        };
      }
      await sendInternalStaffPersonalCheckInLinkEmail({
        to: guestEmail,
        guestName: guest.name,
        eventName: event.name,
        whenLabel: formatDate(event.date),
        locationLabel: formatLocationLine(event.location),
        checkInUrl: url,
        resendApiKeyOverride: resendKey
      });
    } else {
      const sent = await sendGuestEmailsAfterCreate(
        {
          id: guest.id,
          name: guest.name,
          email: guestEmail,
          mode: guest.mode,
          qrCode: guest.qrCode
        },
        eventEmail,
        guest.zoomLink,
        resendKey
      );
      if (!sent) {
        void logGuestNotificationDelivery({
          guestId: guest.id,
          eventId: parsed.data.eventId,
          kind: "invite_resend",
          channel: "EMAIL",
          status: "SKIPPED",
          recipient: guestEmail,
          detail: "Nothing to email for this guest yet."
        });
        return {
          success: false,
          error:
            "Nothing to email for this guest yet. They need a check-in QR (in person), a virtual Zoom link on their record, or a personal staff check-in token. Confirm the event and guest setup, and Resend under Settings."
        };
      }
    }

    void logGuestNotificationDelivery({
      guestId: guest.id,
      eventId: parsed.data.eventId,
      kind: "invite_resend",
      channel: "EMAIL",
      status: "SENT",
      recipient: guestEmail,
      detail: isInternalPersonalLink ? "staff check-in link" : "email"
    });

    revalidatePath(`/events/${parsed.data.eventId}/guests`);
    revalidatePath(`/events/${parsed.data.eventId}/deliveries`);
    return { success: true, data: { sent: true } };
  } catch (e) {
    console.error("[guest] resend invitation", e);
    void logGuestNotificationDelivery({
      guestId: guest.id,
      eventId: parsed.data.eventId,
      kind: "invite_resend",
      channel: "EMAIL",
      status: "FAILED",
      recipient: guest.email,
      detail: e instanceof Error ? e.message : String(e)
    });
    return { success: false, error: "Email could not be sent. Check Resend settings and try again." };
  }
}

/** Resend a short SMS reminder (same window as invitation email resend). */
export async function resendGuestInvitationSms(
  input: z.input<typeof resendGuestInvitationSchema>
): Promise<ActionResult<{ sent: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = resendGuestInvitationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  await syncEventStatusForEvent(parsed.data.eventId);

  const guest = await prisma.guest.findFirst({
    where: {
      id: parsed.data.guestId,
      eventId: parsed.data.eventId,
      event: { orgId: session.user.orgId }
    },
    select: {
      id: true,
      phone: true,
      email: true,
      repId: true,
      status: true,
      invitationToken: true,
      event: { select: { orgId: true, name: true, date: true, status: true, endDate: true } }
    }
  });
  if (!guest) return { success: false, error: "Guest not found." };
  if (!mayEditOrDeleteGuestRow(session.user.role, session.user.id, guest.repId)) {
    return { success: false, error: "You do not have permission to resend for this guest." };
  }
  if (guest.status === GuestStatus.DECLINED) {
    return {
      success: false,
      error: "This guest declined the invitation. SMS resend is disabled."
    };
  }

  const { event } = guest;
  if (!eventAllowsGuestInvitationResend({ status: event.status, endDate: event.endDate })) {
    return {
      success: false,
      error:
        "SMS reminders can only be resent while the event is published or live and before it has ended (including the post-event window)."
    };
  }

  const to = phoneToMnotifyRecipient(guest.phone);
  if (!to) {
    return {
      success: false,
      error: "This guest has no valid mobile number. Save an international phone number (for example +14155552671) on the guest record, then try again."
    };
  }

  const smsPortalUrl = await resolveGuestSmsPortalUrl(guest.id);

  const smsBody = renderGuestReminderSms({
    eventName: event.name,
    eventDate: event.date,
    hasEmail: guestHasDeliverableEmail(guest.email),
    portalUrl: smsPortalUrl,
    rsvpUrl:
      guest.invitationToken != null
        ? getRsvpAcceptAbsoluteUrl(guest.id, guest.invitationToken)
        : null
  });

  const smsRes = await sendOrgMnotifyQuickSms(guest.event.orgId, [to], smsBody);

  if (!smsRes.ok) {
    await logMnotifySmsDelivery({
      orgId: guest.event.orgId,
      guestId: guest.id,
      eventId: parsed.data.eventId,
      kind: "invite_resend",
      recipient: guest.phone,
      messageBody: smsBody,
      smsRes
    });
    return { success: false, error: smsRes.error ?? "SMS could not be sent." };
  }

  await logMnotifySmsDelivery({
    orgId: guest.event.orgId,
    guestId: guest.id,
    eventId: parsed.data.eventId,
    kind: "invite_resend",
    recipient: guest.phone,
    messageBody: smsBody,
    smsRes
  });

  revalidatePath(`/events/${parsed.data.eventId}/guests`);
  revalidatePath(`/events/${parsed.data.eventId}/deliveries`);
  return { success: true, data: { sent: true } };
}

export async function importGuestsFromRows(
  eventId: string,
  rows: Array<Record<string, string | undefined>>
): Promise<ActionResult<{ count: number }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const event = await getEventForGuestAction(eventId, session.user.orgId);
  if (!event) return { success: false, error: "Event not found" };

  const reps = await prisma.user.findMany({
    where: { orgId: session.user.orgId, role: { in: [Role.STAFF, Role.SALES_REP] } },
    select: { id: true, email: true }
  });
  const repByEmail = new Map(reps.map((r) => [r.email.toLowerCase(), r.id]));

  let count = 0;
  const rowIssues: Array<{ row: number; message: string }> = [];

  const emailRequired = isEmailMandatoryForEvent(event);
  const importSchema = buildGuestBaseSchema(emailRequired);

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowIndex = i + 2;
    const repEmail = raw.repEmail?.trim().toLowerCase() || "";
    let repId: string | null = null;
    if (repEmail) {
      const id = repByEmail.get(repEmail);
      if (!id) {
        rowIssues.push({ row: rowIndex, message: `unknown rep email "${repEmail}"` });
        continue;
      }
      repId = id;
    }
    if (isSalesRepRole(session.user.role)) {
      repId = repId ?? session.user.id;
    }

    const normalizedPhone = normalizeImportedPhoneToE164(raw.phone, {
      country: raw.country ?? null,
      countryCode: raw.countryCode ?? null
    });
    if (!normalizedPhone.ok) {
      rowIssues.push({ row: rowIndex, message: normalizedPhone.message });
      continue;
    }

    const parsed = importSchema.safeParse({
      eventId,
      name: (raw.name ?? "").trim(),
      email: (raw.email ?? "").trim() || null,
      phone: normalizedPhone.phone,
      company: normalizeCompanyForStorage(raw.company?.trim() || null),
      jobTitle: raw.jobTitle?.trim() || null,
      country: raw.country?.trim() || null,
      accessibilityNotes: raw.accessibilityNotes?.trim() || null,
      referralSource: raw.referralSource?.trim() || null,
      staffEmployeeId: raw.staffEmployeeId?.trim() || null,
      department: raw.department?.trim() || null,
      branch: raw.branch?.trim() || null,
      tier: parseTier(raw.tier),
      mode: parseModeOptional(raw.mode),
      dietary: raw.dietary?.trim() || null,
      repId
    });

    if (!parsed.success) {
      rowIssues.push({ row: rowIndex, message: formatZodError(parsed.error) });
      continue;
    }

    const res = await addGuest({ ...parsed.data, phone: normalizedPhone.phone });
    if (res.success) count++;
    else rowIssues.push({ row: rowIndex, message: res.error ?? "Failed" });
  }

  const issuesSummary = formatGroupedRowIssues(rowIssues, 5);
  if (rowIssues.length && count === 0) {
    return { success: false, error: issuesSummary };
  }

  revalidatePath(`/events/${eventId}/guests`);
  if (rowIssues.length) {
    return {
      success: true,
      data: { count },
      error: `Imported ${count}. Issues: ${formatGroupedRowIssues(rowIssues, 3)}`
    };
  }
  return { success: true, data: { count } };
}

const inviteOrgContactsToEventSchema = z.object({
  eventId: z.string().min(1),
  contactIds: z.array(z.string().min(1)).min(1).max(5000)
});

/**
 * Create guests from org CRM contacts (admin / marketing). Skips invalid phones and duplicate email/phone values.
 * Links each new guest to the source `OrgContact` when creation succeeds.
 */
export async function inviteOrgContactsToEvent(
  input: z.input<typeof inviteOrgContactsToEventSchema>
): Promise<ActionResult<{ invited: number; skipped: number; errors: string[] }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Only admins and marketing can invite from the CRM directory." };
  }
  if (!canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = inviteOrgContactsToEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { eventId, contactIds } = parsed.data;
  const event = await getEventForGuestAction(eventId, session.user.orgId);
  if (!event) return { success: false, error: "Event not found" };

  const uniqueIds = [...new Set(contactIds)];
  const contacts = await prisma.orgContact.findMany({
    where: { orgId: session.user.orgId, id: { in: uniqueIds } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      department: true,
      branch: true,
      staffEmployeeId: true
    }
  });
  const byId = new Map(contacts.map((c) => [c.id, c]));

  let invited = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const id of uniqueIds) {
    const c = byId.get(id);
    if (!c) {
      skipped++;
      if (errors.length < 12) errors.push(`Unknown contact id ${id.slice(0, 8)}…`);
      continue;
    }
    if (!isCrmInviteableProfile(c.email, c.phone)) {
      skipped++;
      if (errors.length < 12) {
        errors.push(
          `${c.email.trim() || c.id}: needs a valid work email and international mobile format (for example +14155552671) so invitations can be delivered.`
        );
      }
      continue;
    }
    const phone = c.phone.trim();

    const res = await addGuest({
      eventId,
      name: c.name.trim(),
      email: c.email.trim(),
      phone,
      company: c.company?.trim() || null,
      jobTitle: c.jobTitle?.trim() || null,
      country: null,
      accessibilityNotes: null,
      referralSource: "CRM",
      staffEmployeeId: c.staffEmployeeId?.trim() || null,
      department: c.department?.trim() || null,
      branch: c.branch?.trim() || null,
      tier: Tier.C,
      dietary: null,
      repId: null
    });

    if (!res.success || !res.data) {
      skipped++;
      if (errors.length < 12) errors.push(`${c.email}: ${res.error ?? "skipped"}`);
      continue;
    }

    invited++;
    try {
      await prisma.guest.update({ where: { id: res.data.id }, data: { contactId: c.id } });
    } catch (e) {
      console.error("[guest] link contactId after CRM invite", e);
    }
  }

  revalidatePath(`/events/${eventId}/guests`);
  revalidatePath(`/register/${eventId}`);
  return { success: true, data: { invited, skipped, errors } };
}

function parseTier(v: string | undefined): Tier {
  const x = (v ?? "C").trim().toUpperCase();
  if (x === "A" || x === "B" || x === "C") return x as Tier;
  return Tier.C;
}

/** Empty / unknown cell → undefined so hybrid imports get undecided mode. */
function parseModeOptional(v: string | undefined | null): AttendMode | undefined {
  if (v == null || !String(v).trim()) return undefined;
  const x = String(v).trim().toLowerCase().replace(/[-\s]/g, "_");
  if (x === "virtual" || x === "v") return AttendMode.VIRTUAL;
  if (x === "in_person" || x === "inperson") return AttendMode.IN_PERSON;
  return undefined;
}

const acceptGuestInvitationSchema = z.object({
  guestId: z.string().min(1),
  token: z.string().min(16).max(200)
});

/**
 * Public: guest taps link in invitation email.
 *
 * Idempotent across the whole magic-link lifetime — the token is the persistent
 * key for both `/rsvp/[id]/[token]` (Secure My Spot) and
 * `/rsvp/[id]/[token]/decline` (I Can't Make It). A guest who first accepts
 * and later declines (or vice-versa) needs to be able to re-open the same
 * link without hitting a 404, so we never null out `invitationToken` here.
 *
 * Status transitions handled:
 *   INVITED   → ACCEPTED                                (first accept)
 *   DECLINED  → ACCEPTED + clear decline + notifications (changed mind)
 *   ACCEPTED  → no-op success                            (revisit / refresh)
 *   anything else (REGISTERED, CHECKED_IN, JOINED, NO_SHOW) → no-op success
 *     (already finalized — guest opens the link to view their join page)
 */
export async function acceptGuestInvitationByToken(
  input: z.input<typeof acceptGuestInvitationSchema>
): Promise<ActionResult<{ eventId: string }>> {
  const parsed = acceptGuestInvitationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guest = await prisma.guest.findFirst({
    where: {
      id: parsed.data.guestId,
      invitationToken: parsed.data.token
    },
    select: { id: true, eventId: true, status: true }
  });
  if (!guest) {
    return { success: false, error: "This invitation link is invalid or has expired." };
  }

  try {
    if (guest.status === GuestStatus.INVITED) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { status: GuestStatus.ACCEPTED }
      });
    } else if (guest.status === GuestStatus.DECLINED) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: {
          status: GuestStatus.ACCEPTED,
          declineReason: null,
          declineNote: null,
          declinedAt: null,
          notificationsSuppressedAt: null
        }
      });
    }
    revalidatePath(`/events/${guest.eventId}/guests`);
    revalidatePath(`/join/${guest.id}`);
    return { success: true, data: { eventId: guest.eventId } };
  } catch {
    return { success: false, error: "Could not accept invitation." };
  }
}

const removeGuestFromEventSchema = z.object({
  eventId: z.string().min(1),
  guestId: z.string().min(1)
});

const removeGuestsFromEventSchema = z.object({
  eventId: z.string().min(1),
  guestIds: z.array(z.string().min(1)).min(1).max(300)
});

async function notifyGuestRemovedIfNeeded(
  guest: {
    email: string | null;
    name: string;
    status: GuestStatus;
    invitationEmailSentAt: Date | null;
  },
  event: {
    status: EventStatus;
    name: string;
    date: Date;
    brandLogoUrl?: string | null;
    brandPrimaryColor?: string | null;
    org: {
      name: string;
      logo: string | null;
      defaultEventBrandLogoUrl: string | null;
      resendApiKey: string | null;
    };
  }
) {
  if (!shouldNotifyGuestOfRemovalFromEvent(event.status, guest)) return;
  if (!guestHasDeliverableEmail(guest.email)) return;
  try {
    await sendGuestRemovedFromEventEmail({
      to: guest.email as string,
      guestName: guest.name,
      eventName: event.name,
      eventDate: formatDate(event.date),
      orgName: event.org.name,
      brandLogoUrl: event.brandLogoUrl ?? null,
      orgLogoUrl: event.org.logo,
      orgDefaultBrandLogoUrl: event.org.defaultEventBrandLogoUrl,
      brandPrimaryColor: event.brandPrimaryColor ?? null,
      resendApiKeyOverride: event.org.resendApiKey?.trim() || undefined
    });
  } catch (e) {
    console.error("[guest] removal notification email failed", e);
  }
}

/** Remove multiple guests. Same rules as single removal; invalid IDs are ignored. */
export async function removeGuestsFromEventAsOrganizer(
  input: z.input<typeof removeGuestsFromEventSchema>
): Promise<ActionResult<{ removed: number }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canManageEventGuests(session.user.role)) {
    return { success: false, error: "You do not have permission to remove guests." };
  }

  const parsed = removeGuestsFromEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const orgId = session.user.orgId;
  const unique = [...new Set(parsed.data.guestIds)];

  const found = await prisma.guest.findMany({
    where: {
      eventId: parsed.data.eventId,
      id: { in: unique },
      event: { orgId }
    },
    select: { id: true, eventId: true, repId: true }
  });

  const allowed = found.filter((g) => mayEditOrDeleteGuestRow(session.user.role, session.user.id, g.repId));
  if (allowed.length === 0) {
    return { success: true, data: { removed: 0 } };
  }

  const eventId = parsed.data.eventId;
  const allowedIds = allowed.map((g) => g.id);
  try {
    const rows = await prisma.guest.findMany({
      where: { id: { in: allowedIds } },
      select: {
        email: true,
        name: true,
        status: true,
        invitationEmailSentAt: true,
        event: {
          select: {
            status: true,
            name: true,
            date: true,
            brandLogoUrl: true,
            brandPrimaryColor: true,
            org: {
              select: {
                name: true,
                logo: true,
                defaultEventBrandLogoUrl: true,
                resendApiKey: true
              }
            }
          }
        }
      }
    });
    for (const row of rows) {
      await notifyGuestRemovedIfNeeded(
        {
          email: row.email,
          name: row.name,
          status: row.status,
          invitationEmailSentAt: row.invitationEmailSentAt
        },
        row.event
      );
    }
    await prisma.guest.deleteMany({ where: { id: { in: allowedIds } } });
    revalidatePath(`/events/${eventId}/guests`);
    revalidatePath(`/events/${eventId}/checkin`);
    revalidatePath(`/register/${eventId}`);
    return { success: true, data: { removed: allowed.length } };
  } catch {
    return { success: false, error: "Could not remove one or more guests." };
  }
}

/** Remove a guest from an event (including check-ins). Admins/marketers: any guest; reps/staff: assigned guests only. */
export async function removeGuestFromEventAsOrganizer(
  input: z.input<typeof removeGuestFromEventSchema>
): Promise<ActionResult<{ removed: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canManageEventGuests(session.user.role)) {
    return { success: false, error: "You do not have permission to remove guests." };
  }

  const parsed = removeGuestFromEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guest = await prisma.guest.findFirst({
    where: {
      id: parsed.data.guestId,
      eventId: parsed.data.eventId,
      event: { orgId: session.user.orgId }
    },
    select: {
      id: true,
      eventId: true,
      repId: true,
      email: true,
      name: true,
      status: true,
      invitationEmailSentAt: true,
      event: {
        select: {
          status: true,
          name: true,
          date: true,
          brandLogoUrl: true,
          brandPrimaryColor: true,
          org: {
            select: {
              name: true,
              logo: true,
              defaultEventBrandLogoUrl: true,
              resendApiKey: true
            }
          }
        }
      }
    }
  });
  if (!guest) return { success: false, error: "Guest not found." };
  if (!mayEditOrDeleteGuestRow(session.user.role, session.user.id, guest.repId)) {
    return { success: false, error: "You do not have permission to remove this guest." };
  }

  try {
    await notifyGuestRemovedIfNeeded(
      {
        email: guest.email,
        name: guest.name,
        status: guest.status,
        invitationEmailSentAt: guest.invitationEmailSentAt
      },
      guest.event
    );
    await prisma.guest.delete({ where: { id: guest.id } });
    revalidatePath(`/events/${guest.eventId}/guests`);
    revalidatePath(`/events/${guest.eventId}/checkin`);
    revalidatePath(`/register/${guest.eventId}`);
    return { success: true, data: { removed: true } };
  } catch {
    return { success: false, error: "Could not remove guest." };
  }
}

export async function updateGuestStatus(
  guestId: string,
  status: GuestStatus
): Promise<ActionResult<Guest>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };

  const existing = await prisma.guest.findFirst({
    where: { id: guestId },
    include: { event: true }
  });
  if (!existing || existing.event.orgId !== session.user.orgId) {
    return { success: false, error: "Guest not found" };
  }
  if (isSalesRepRole(session.user.role) && existing.repId !== session.user.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const guest = await prisma.guest.update({
      where: { id: guestId },
      data: { status }
    });
    revalidatePath(`/events/${guest.eventId}/guests`);
    return { success: true, data: guest };
  } catch {
    return { success: false, error: "Failed to update guest status" };
  }
}
