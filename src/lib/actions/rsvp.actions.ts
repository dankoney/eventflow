"use server";

import {
  AttendMode,
  EmailMarketingConsentSource,
  EventBlueprintTemplate,
  EventStatus,
  GuestStatus,
  RsvpDeclineReason,
  WaitlistStatus,
  ZoomSessionKind
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { sendUnifiedRsvpConfirmationEmail, type UnifiedRsvpConfirmationTone } from "@/lib/email";
import { buildIcsBase64 } from "@/lib/email/icsCalendar";
import { shouldShowMarketingOptIn } from "@/lib/email/marketingOptIn";
import { recordGuestMarketingConsent } from "@/lib/db/emailContact";
import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";
import { prisma } from "@/lib/prisma";
import { guestQrToPngBase64, createGuestQrCode } from "@/lib/qr";
import { promoteEventWaitlist } from "@/lib/waitlist/promote";
import {
  getJoinPageAbsoluteUrl,
  getOpenZoomJoinAbsoluteUrl
} from "@/lib/url";
import {
  getParsedMultiDayOrNull,
  initialGuestVirtualJoinUrl,
  resolveCheckInDayIndexForEvent
} from "@/lib/event-schedule/multiDayConfig";
import { registerWebinarRegistrant, zoomRegistrantNameParts } from "@/lib/zoom";
import { formatDate, formatLocationLine } from "@/lib/utils";
import { ActionResult } from "@/types";

function formatZodError(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join(" | ");
}

const declineSchema = z.object({
  guestId: z.string().min(1),
  token: z.string().min(1),
  reason: z.nativeEnum(RsvpDeclineReason),
  note: z.string().trim().max(2000).optional().nullable()
});

export type RsvpDeclineActionResult = ActionResult<{
  alreadyDeclined: boolean;
  releasedSeat: boolean;
  promotedFromWaitlist: number;
}>;

/**
 * Magic-link decline submission. Idempotent: if the guest has already declined we
 * preserve the prior reason/note and return `alreadyDeclined: true`. Marks the guest
 * as `DECLINED`, suppresses future reminder dispatch, and (Phase F) releases the
 * seat / promotes the next waitlist entry — both currently no-ops here.
 */
export async function submitRsvpDecline(
  input: z.input<typeof declineSchema>
): Promise<RsvpDeclineActionResult> {
  const parsed = declineSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guest = await prisma.guest.findFirst({
    where: { id: parsed.data.guestId, invitationToken: parsed.data.token },
    select: {
      id: true,
      eventId: true,
      status: true,
      declineReason: true,
      declinedAt: true
    }
  });
  if (!guest) {
    return { success: false, error: "This RSVP link is invalid or has expired." };
  }

  const note = parsed.data.note?.trim() ? parsed.data.note.trim().slice(0, 2000) : null;
  const alreadyDeclined = guest.status === GuestStatus.DECLINED;

  if (!alreadyDeclined) {
    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        status: GuestStatus.DECLINED,
        declineReason: parsed.data.reason,
        declineNote: note,
        declinedAt: new Date(),
        notificationsSuppressedAt: new Date()
      }
    });
  }

  // Phase F: capacity-aware seat release + waitlist auto-promotion. Always runs even
  // when `alreadyDeclined` is true so a re-decline still drains the queue if a seat
  // somehow opened up between calls. Best-effort — promotion failures don't fail the
  // user-facing decline submission.
  let promotedFromWaitlist = 0;
  try {
    const result = await promoteEventWaitlist(guest.eventId);
    promotedFromWaitlist = result.promoted;
  } catch (e) {
    console.error("[rsvp] waitlist promotion after decline failed", e);
  }

  revalidatePath(`/events/${guest.eventId}/guests`);

  return {
    success: true,
    data: {
      alreadyDeclined,
      releasedSeat: !alreadyDeclined,
      promotedFromWaitlist
    }
  };
}

const acceptSchema = z.object({
  guestId: z.string().min(1),
  token: z.string().min(1),
  name: z.string().trim().min(2, "Please enter your full name."),
  email: z.string().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .refine((p) => isValidE164(p), {
      message: "Enter phone in international format, e.g. +233501234567."
    }),
  company: z.string().trim().max(200).optional().nullable(),
  jobTitle: z.string().trim().max(200).optional().nullable(),
  mode: z.nativeEnum(AttendMode),
  accommodationRequested: z.boolean().default(false),
  accommodationDetails: z.string().trim().max(2000).optional().nullable(),
  marketingOptIn: z.boolean().optional().default(false)
});

export type RsvpAcceptActionResult = ActionResult<{
  alreadyConfirmed: boolean;
  emailDelivered: boolean;
  mode: AttendMode;
  /** Final status persisted on the guest after this confirm. */
  status: GuestStatus;
  /**
   * True when the confirm produced a real-time check-in (event was LIVE and
   * the guest picked in-person). Drives the receipt-tone email and success UI.
   */
  checkedInNow: boolean;
}>;

/**
 * Magic-link confirm submission. Idempotent — repeated submits update the
 * guest record (mode, accommodation, edited contact fields). The unified
 * confirmation email is sent only on the first confirm (`rsvpConfirmedAt` was
 * previously null). Triggers Zoom webinar self-registration when needed.
 */
export async function submitRsvpAccept(
  input: z.input<typeof acceptSchema>
): Promise<RsvpAcceptActionResult> {
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guest = await prisma.guest.findFirst({
    where: { id: parsed.data.guestId, invitationToken: parsed.data.token },
    include: {
      event: {
        include: {
          location: true,
          org: {
            select: {
              name: true,
              resendApiKey: true,
              marketingEmailEnabled: true,
              marketingConsentCopy: true,
              marketingPrivacyPolicyUrl: true
            }
          }
        }
      }
    }
  });
  if (!guest) {
    return { success: false, error: "This RSVP link is invalid or has expired." };
  }
  const event = guest.event;
  if (event.status === EventStatus.CANCELLED || event.status === EventStatus.COMPLETED) {
    return { success: false, error: "This event is no longer accepting RSVPs." };
  }

  const allowsInPerson = event.type === "IN_PERSON" || event.type === "HYBRID";
  const allowsVirtual = event.type === "VIRTUAL" || event.type === "HYBRID";
  const requestedMode = parsed.data.mode;
  if (requestedMode === AttendMode.IN_PERSON && !allowsInPerson) {
    return { success: false, error: "This event is virtual only." };
  }
  if (requestedMode === AttendMode.VIRTUAL && !allowsVirtual) {
    return { success: false, error: "This event is in-person only." };
  }

  const phoneNorm = parsed.data.phone.trim();
  const emailNorm = parsed.data.email.trim().toLowerCase();
  if (emailNorm !== (guest.email?.toLowerCase() ?? "")) {
    const dupEmail = await prisma.guest.findFirst({
      where: { eventId: event.id, email: emailNorm, NOT: { id: guest.id } }
    });
    if (dupEmail) {
      return { success: false, error: "Another guest on this event already uses this email." };
    }
  }
  if (phoneNorm !== (guest.phone ?? "")) {
    const dupPhone = await prisma.guest.findFirst({
      where: { eventId: event.id, phone: phoneNorm, NOT: { id: guest.id } }
    });
    if (dupPhone) {
      return { success: false, error: "Another guest on this event already uses this phone number." };
    }
  }

  const mdCfg = getParsedMultiDayOrNull(event.scheduleMode, event.multiDayConfig);
  const perDayVirtual = mdCfg?.virtualLinkMode === "PER_DAY";
  const baseVirtualJoin = initialGuestVirtualJoinUrl({
    scheduleMode: event.scheduleMode,
    multiDayConfig: event.multiDayConfig,
    eventZoomJoinUrl: event.zoomJoinUrl
  });

  let zoomLink: string | null = guest.zoomLink;
  const isWebinarVirtual =
    !perDayVirtual &&
    requestedMode === AttendMode.VIRTUAL &&
    Boolean(event.zoomMeetingId) &&
    event.zoomSessionKind === ZoomSessionKind.WEBINAR;

  if (isWebinarVirtual && !zoomLink) {
    try {
      const { firstName, lastName } = zoomRegistrantNameParts(
        parsed.data.name,
        parsed.data.company,
        event.org.name
      );
      zoomLink = await registerWebinarRegistrant(
        event.zoomMeetingId as string,
        { email: emailNorm, firstName, lastName },
        event.orgId
      );
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: `Could not register you on Zoom (webinar). ${detail}`.slice(0, 700)
      };
    }
  } else if (requestedMode === AttendMode.VIRTUAL && !zoomLink) {
    zoomLink = baseVirtualJoin ?? event.zoomJoinUrl ?? null;
  }

  const qrCode = guest.qrCode ?? createGuestQrCode(event.id, emailNorm);
  const alreadyConfirmed =
    guest.rsvpConfirmedAt !== null &&
    (guest.status === GuestStatus.ACCEPTED ||
      guest.status === GuestStatus.REGISTERED ||
      guest.status === GuestStatus.CHECKED_IN);

  const isInternalStaff = event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF;
  const eventIsLive = event.status === EventStatus.LIVE;
  const isLiveInPerson = eventIsLive && requestedMode === AttendMode.IN_PERSON;

  // Blueprint-aware final status:
  // - LIVE + in-person (any template): CHECKED_IN + optional CheckIn row (presence at the door / room now)
  // - Internal staff, not live in-person: REGISTERED (intent on roster; check-in still at session)
  // - Conference / training / blank: ACCEPTED (classic RSVP)
  const nextStatus: GuestStatus = isLiveInPerson
    ? GuestStatus.CHECKED_IN
    : isInternalStaff
      ? GuestStatus.REGISTERED
      : GuestStatus.ACCEPTED;

  let checkInDayIndex: number | null = null;
  if (isLiveInPerson) {
    const window = resolveCheckInDayIndexForEvent(event.scheduleMode, event.multiDayConfig);
    if (!window.ok) {
      return {
        success: false,
        error: window.error ?? "Check-in window is not open yet."
      };
    }
    checkInDayIndex = window.dayIndex;
  }

  let checkedInNow = false;
  const updated = await prisma.$transaction(async (tx) => {
    const g = await tx.guest.update({
      where: { id: guest.id },
      data: {
        name: parsed.data.name.trim(),
        email: emailNorm,
        phone: phoneNorm,
        ...(parsed.data.company !== undefined
          ? { company: parsed.data.company?.trim() || null }
          : {}),
        ...(parsed.data.jobTitle !== undefined
          ? { jobTitle: parsed.data.jobTitle?.trim() || null }
          : {}),
        mode: requestedMode,
        qrCode,
        zoomLink,
        status: nextStatus,
        rsvpConfirmedAt: alreadyConfirmed ? guest.rsvpConfirmedAt : new Date(),
        accommodationRequested: parsed.data.accommodationRequested,
        accommodationDetails: parsed.data.accommodationRequested
          ? parsed.data.accommodationDetails?.trim() || null
          : null,
        declineReason: null,
        declineNote: null,
        declinedAt: null,
        notificationsSuppressedAt: null
      }
    });
    if (checkInDayIndex != null) {
      const existing = await tx.checkIn.findUnique({
        where: { guestId_dayIndex: { guestId: g.id, dayIndex: checkInDayIndex } }
      });
      if (!existing) {
        await tx.checkIn.create({
          data: {
            guestId: g.id,
            dayIndex: checkInDayIndex,
            method: "manual",
            source: "rsvp-accept"
          }
        });
        checkedInNow = true;
      }
    }
    return g;
  });

  let emailDelivered = false;
  if (!alreadyConfirmed) {
    let emailTone: UnifiedRsvpConfirmationTone = "confirmation";
    if (checkedInNow) {
      emailTone = "receipt";
    } else if (isInternalStaff) {
      emailTone = "internal_staff";
    } else if (event.blueprintTemplate === EventBlueprintTemplate.CONFERENCE) {
      emailTone = "conference";
    } else if (event.blueprintTemplate === EventBlueprintTemplate.TRAINING_WORKSHOP) {
      emailTone = "training_workshop";
    }

    try {
      if (!updated.email?.trim()) {
        throw new Error("Guest email is required to send RSVP confirmation.");
      }
      const resendKey = event.org.resendApiKey?.trim() || undefined;
      const trackedZoom = zoomLink ? getOpenZoomJoinAbsoluteUrl(updated.id) ?? zoomLink : null;
      const joinPageUrl = getJoinPageAbsoluteUrl(updated.id);
      const directionsUrl = event.location?.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.location.name} ${event.location.address}`)}`
        : null;

      const ics = buildIcsBase64({
        uid: `rsvp-${updated.id}@eventflow.app`,
        title: event.name,
        description: event.description ?? null,
        locationLine: formatLocationLine(event.location),
        starts: event.date,
        ends: event.endDate,
        virtualJoinUrl: trackedZoom,
        venueAddress: event.location?.address ?? null,
        organizer: { name: event.org.name },
        attendee: { name: updated.name, email: updated.email }
      });

      const qrPng = await guestQrToPngBase64(qrCode);

      await sendUnifiedRsvpConfirmationEmail({
        to: updated.email,
        guestName: updated.name,
        eventName: event.name,
        eventDate: formatDate(event.date),
        locationLine: formatLocationLine(event.location),
        attendanceMode: requestedMode === AttendMode.VIRTUAL ? "VIRTUAL" : "IN_PERSON",
        tone: emailTone,
        qrPngBase64: qrPng,
        zoomJoinUrl: trackedZoom,
        joinPageUrl,
        directionsUrl,
        brandLogoUrl: event.brandLogoUrl,
        brandPrimaryColor: event.brandPrimaryColor,
        orgName: event.org.name,
        icsBase64: ics,
        resendApiKeyOverride: resendKey
      });
      emailDelivered = true;
    } catch (e) {
      console.error("[rsvp] confirmation email failed", e);
    }
  }

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
        guestId: updated.id,
        marketingOptIn: parsed.data.marketingOptIn ?? false,
        consentSource: EmailMarketingConsentSource.RSVP
      });
    } catch (e) {
      console.error("[rsvp] marketing consent record failed", e);
    }
  }

  revalidatePath(`/events/${event.id}/guests`);
  revalidatePath(`/join/${updated.id}`);
  revalidatePath(`/rsvp/${updated.id}/${parsed.data.token}`);
  if (checkedInNow) {
    revalidatePath(`/events/${event.id}/checkin`);
  }

  return {
    success: true,
    data: {
      alreadyConfirmed,
      emailDelivered,
      mode: requestedMode,
      status: updated.status,
      checkedInNow
    }
  };
}

const confirmPresenceSchema = z.object({
  guestId: z.string().min(1),
  token: z.string().min(1)
});

export type RsvpPresenceConfirmResult = ActionResult<{
  alreadyCheckedIn: boolean;
  /** Final status persisted on the guest after this call. */
  status: GuestStatus;
}>;

/**
 * Phase 3 — "Confirm my presence" on the RSVP magic-link page (and the org
 * Command Center). Token-gated, idempotent. Only writes a {@link CheckIn} row
 * + flips the guest to `CHECKED_IN` when the event is `LIVE`. Outside the LIVE
 * window we surface an explicit error so the UI can fall back to the normal
 * RSVP flow instead of silently doing nothing.
 */
export async function confirmRsvpPresence(
  input: z.input<typeof confirmPresenceSchema>
): Promise<RsvpPresenceConfirmResult> {
  const parsed = confirmPresenceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guest = await prisma.guest.findFirst({
    where: { id: parsed.data.guestId, invitationToken: parsed.data.token },
    select: {
      id: true,
      status: true,
      mode: true,
      eventId: true,
      event: {
        select: {
          id: true,
          status: true,
          type: true,
          scheduleMode: true,
          multiDayConfig: true
        }
      }
    }
  });
  if (!guest) {
    return { success: false, error: "This RSVP link is invalid or has expired." };
  }
  const event = guest.event;
  if (event.status === EventStatus.CANCELLED || event.status === EventStatus.COMPLETED) {
    return { success: false, error: "This event is no longer accepting check-ins." };
  }
  if (event.status !== EventStatus.LIVE) {
    return {
      success: false,
      error: "Self check-in is only available once the event is live."
    };
  }
  if (event.type === "VIRTUAL") {
    return {
      success: false,
      error: "This event is virtual only — use the Join Stream link instead."
    };
  }

  if (guest.status === GuestStatus.CHECKED_IN) {
    return {
      success: true,
      data: { alreadyCheckedIn: true, status: guest.status }
    };
  }
  if (guest.status === GuestStatus.NO_SHOW || guest.status === GuestStatus.DECLINED) {
    return { success: false, error: "This registration is no longer active." };
  }

  const window = resolveCheckInDayIndexForEvent(event.scheduleMode, event.multiDayConfig);
  if (!window.ok) {
    return {
      success: false,
      error: window.error ?? "Check-in window is not open yet."
    };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const g = await tx.guest.update({
        where: { id: guest.id },
        data: {
          status: GuestStatus.CHECKED_IN,
          ...(guest.mode === null ? { mode: AttendMode.IN_PERSON } : {})
        }
      });
      const existing = await tx.checkIn.findUnique({
        where: { guestId_dayIndex: { guestId: g.id, dayIndex: window.dayIndex } }
      });
      if (!existing) {
        await tx.checkIn.create({
          data: {
            guestId: g.id,
            dayIndex: window.dayIndex,
            method: "manual",
            source: "rsvp-presence-confirm"
          }
        });
      }
      return g;
    });

    revalidatePath(`/rsvp/${guest.id}/${parsed.data.token}`);
    revalidatePath(`/join/${guest.id}`);
    revalidatePath(`/events/${event.id}/checkin`);
    revalidatePath(`/events/${event.id}/guests`);
    revalidatePath(`/events/${event.id}/analytics`);

    return {
      success: true,
      data: { alreadyCheckedIn: false, status: updated.status }
    };
  } catch {
    return { success: false, error: "Could not record your presence. Please try again." };
  }
}

const lookupRsvpSchema = z.object({
  guestId: z.string().min(1),
  token: z.string().min(1)
});

export type RsvpPrefillPayload = {
  guestId: string;
  token: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  jobTitle: string | null;
  mode: AttendMode | null;
  accommodationRequested: boolean;
  accommodationDetails: string | null;
  status: GuestStatus;
  rsvpConfirmedAt: string | null;
};

export async function lookupRsvpGuestForPublic(
  input: z.input<typeof lookupRsvpSchema>
): Promise<ActionResult<RsvpPrefillPayload>> {
  const parsed = lookupRsvpSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guest = await prisma.guest.findFirst({
    where: { id: parsed.data.guestId, invitationToken: parsed.data.token },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      mode: true,
      status: true,
      rsvpConfirmedAt: true,
      accommodationRequested: true,
      accommodationDetails: true
    }
  });
  if (!guest) {
    return { success: false, error: "This RSVP link is invalid or has expired." };
  }

  return {
    success: true,
    data: {
      guestId: guest.id,
      token: parsed.data.token,
      name: guest.name,
      email: guest.email ?? "",
      phone: guest.phone ?? "",
      company: guest.company,
      jobTitle: guest.jobTitle,
      mode: guest.mode,
      accommodationRequested: guest.accommodationRequested,
      accommodationDetails: guest.accommodationDetails,
      status: guest.status,
      rsvpConfirmedAt: guest.rsvpConfirmedAt?.toISOString() ?? null
    }
  };
}

const joinWaitlistSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(2, "Please enter your full name."),
  email: z.string().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .refine((p) => isValidE164(p), {
      message: "Enter phone in international format, e.g. +233501234567."
    }),
  company: z.string().trim().max(200).optional().nullable(),
  preferredMode: z.nativeEnum(AttendMode).optional().nullable()
});

export type JoinWaitlistResult = ActionResult<{
  position: number;
  alreadyOnWaitlist: boolean;
  alreadyRegistered: boolean;
}>;

/**
 * Public-facing waitlist sign-up. Used when the public registration form
 * detects the event is at capacity. Idempotent on (eventId, email):
 * resubmitting returns the existing position without bumping it.
 */
export async function joinEventWaitlist(
  input: z.input<typeof joinWaitlistSchema>
): Promise<JoinWaitlistResult> {
  const parsed = joinWaitlistSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId },
    select: { id: true, status: true, allowPublicRegistration: true }
  });
  if (!event) return { success: false, error: "Event not found." };
  if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.LIVE) {
    return { success: false, error: "This event isn't accepting waitlist sign-ups yet." };
  }
  if (!event.allowPublicRegistration) {
    return { success: false, error: "This event is invite-only." };
  }

  const emailNorm = parsed.data.email.trim().toLowerCase();

  const existingGuest = await prisma.guest.findFirst({
    where: { eventId: event.id, email: emailNorm },
    select: { id: true, status: true }
  });
  if (existingGuest && existingGuest.status !== GuestStatus.DECLINED) {
    return {
      success: true,
      data: { position: 0, alreadyOnWaitlist: false, alreadyRegistered: true }
    };
  }

  const existing = await prisma.eventWaitlistEntry.findFirst({
    where: { eventId: event.id, email: emailNorm }
  });
  if (existing) {
    if (existing.status === WaitlistStatus.WAITING) {
      return {
        success: true,
        data: { position: existing.position, alreadyOnWaitlist: true, alreadyRegistered: false }
      };
    }
    // Re-activate previously promoted/expired entry at the back of the queue.
    const last = await prisma.eventWaitlistEntry.aggregate({
      where: { eventId: event.id },
      _max: { position: true }
    });
    const nextPosition = (last._max.position ?? 0) + 1;
    const reactivated = await prisma.eventWaitlistEntry.update({
      where: { id: existing.id },
      data: {
        status: WaitlistStatus.WAITING,
        position: nextPosition,
        name: parsed.data.name.trim(),
        phone: parsed.data.phone.trim(),
        company: parsed.data.company?.trim() || null,
        preferredMode: parsed.data.preferredMode ?? null,
        notifiedAt: null,
        promotedToGuestId: null
      }
    });
    return {
      success: true,
      data: { position: reactivated.position, alreadyOnWaitlist: false, alreadyRegistered: false }
    };
  }

  const last = await prisma.eventWaitlistEntry.aggregate({
    where: { eventId: event.id },
    _max: { position: true }
  });
  const nextPosition = (last._max.position ?? 0) + 1;

  const entry = await prisma.eventWaitlistEntry.create({
    data: {
      eventId: event.id,
      email: emailNorm,
      name: parsed.data.name.trim(),
      phone: parsed.data.phone.trim(),
      company: parsed.data.company?.trim() || null,
      preferredMode: parsed.data.preferredMode ?? null,
      position: nextPosition,
      status: WaitlistStatus.WAITING
    }
  });

  // If a seat happens to be open right now (e.g. raced with a decline), promote
  // immediately so the user sees the smart-invitation email instead of a wait.
  let promotedRightAway = false;
  try {
    const result = await promoteEventWaitlist(event.id);
    if (result.promoted > 0) promotedRightAway = true;
  } catch (e) {
    console.error("[waitlist] eager promote failed", e);
  }

  return {
    success: true,
    data: {
      position: entry.position,
      alreadyOnWaitlist: false,
      alreadyRegistered: promotedRightAway
    }
  };
}
