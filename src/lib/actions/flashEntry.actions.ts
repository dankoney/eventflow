"use server";

import { randomBytes } from "crypto";

import {
  AttendMode,
  EventBlueprintTemplate,
  EventStatus,
  EventType,
  GuestJoinSource,
  GuestStatus,
  InternalStaffCheckInMode,
  Tier,
  ZoomSessionKind
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getParsedMultiDayOrNull, initialGuestVirtualJoinUrl } from "@/lib/event-schedule/multiDayConfig";
import { newInternalCheckInToken } from "@/lib/internalStaff/personalLinkToken";
import { parseRegistrationProfile } from "@/lib/event-wizard/registrationProfile";
import {
  guestEmailFieldSchema,
  isEmailMandatoryForEvent,
  normalizeGuestEmailInput
} from "@/lib/guest/contactRequirements";
import { prisma } from "@/lib/prisma";
import { createGuestQrCode } from "@/lib/qr";
import { getRsvpAcceptAbsoluteUrl } from "@/lib/url";
import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";
import type { ActionResult } from "@/types";

function formatZodError(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join(" | ");
}

const resolveEmailSchema = z.object({
  orgSlug: z.string().trim().min(1).max(120),
  eventId: z.string().min(1),
  email: z.string().trim().email()
});

export type FlashEntryResolveData =
  | { kind: "rsvp"; rsvpUrl: string }
  /**
   * Phase 3 — existing guest, event is LIVE, and the guest is on track for an
   * in-person seat. The client should show a one-tap "Confirm my presence" button
   * (calls `confirmRsvpPresence`) instead of redirecting through the RSVP page.
   */
  | {
      kind: "presence_confirm";
      guestId: string;
      token: string;
      firstName: string;
      eventName: string;
      alreadyCheckedIn: boolean;
      /** RSVP magic-link URL kept around so the client can offer "Update my RSVP instead". */
      rsvpUrl: string;
    }
  | { kind: "need_walkin" }
  | { kind: "rejected"; message: string };

/**
 * Command Center step 1: given org slug + event + work email, return an RSVP magic link
 * for an existing guest, mint one for a directory guest missing a token, create a guest
 * from CRM when matched, or signal walk-in / rejection.
 */
export async function flashEntryResolveEmail(
  input: z.input<typeof resolveEmailSchema>
): Promise<ActionResult<FlashEntryResolveData>> {
  const parsed = resolveEmailSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const emailNorm = parsed.data.email.trim().toLowerCase();

  const org = await prisma.organization.findUnique({
    where: { slug: parsed.data.orgSlug },
    select: { id: true }
  });
  if (!org) {
    return { success: false, error: "Organization not found." };
  }

  const event = await prisma.event.findFirst({
    where: {
      id: parsed.data.eventId,
      orgId: org.id,
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] }
    },
    select: {
      id: true,
      orgId: true,
      name: true,
      status: true,
      type: true,
      blueprintTemplate: true,
      allowFlashEntry: true,
      internalStaffCheckInMode: true,
      scheduleMode: true,
      multiDayConfig: true,
      zoomJoinUrl: true,
      zoomMeetingId: true,
      zoomSessionKind: true
    }
  });
  if (!event) {
    return { success: false, error: "Event not found or not open for entry." };
  }

  const existingGuest = await prisma.guest.findFirst({
    where: { eventId: event.id, email: emailNorm },
    select: { id: true, name: true, email: true, status: true, mode: true, invitationToken: true, qrCode: true }
  });

  if (existingGuest) {
    const token = await ensureRsvpMagicLinkForGuest(event.id, existingGuest);
    const rsvpUrl = getRsvpAcceptAbsoluteUrl(existingGuest.id, token);
    if (!rsvpUrl) {
      return { success: false, error: "Could not build RSVP URL (site URL not configured)." };
    }
    revalidatePath(`/o/${parsed.data.orgSlug}`);
    revalidatePath(`/o/${parsed.data.orgSlug}/${event.id}/enter`);

    // Phase 3 — when the event is LIVE and the guest is in-person eligible, surface
    // the one-tap "Confirm my presence" affordance on the Command Center itself.
    const eligibleForPresenceConfirm =
      event.status === EventStatus.LIVE &&
      event.type !== EventType.VIRTUAL &&
      existingGuest.mode !== AttendMode.VIRTUAL &&
      existingGuest.status !== GuestStatus.DECLINED &&
      existingGuest.status !== GuestStatus.NO_SHOW;

    if (eligibleForPresenceConfirm) {
      return {
        success: true,
        data: {
          kind: "presence_confirm",
          guestId: existingGuest.id,
          token,
          firstName: firstNameOf(existingGuest.name),
          eventName: event.name,
          alreadyCheckedIn: existingGuest.status === GuestStatus.CHECKED_IN,
          rsvpUrl
        }
      };
    }

    return { success: true, data: { kind: "rsvp", rsvpUrl } };
  }

  const contact = await prisma.orgContact.findFirst({
    where: { orgId: org.id, email: emailNorm },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      staffEmployeeId: true,
      company: true,
      jobTitle: true,
      department: true,
      branch: true
    }
  });

  if (contact) {
    const dupPhone = await prisma.guest.findFirst({
      where: { eventId: event.id, phone: contact.phone }
    });
    if (dupPhone) {
      return {
        success: false,
        error: "This contact’s phone number is already used by another guest on this event."
      };
    }

    const invitationToken = randomBytes(24).toString("hex");
    const qrCode = createGuestQrCode(event.id, emailNorm);
    const issuePersonal =
      event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF &&
      event.internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK;
    const internalCheckInToken = issuePersonal ? newInternalCheckInToken() : null;

    const mode: AttendMode | null =
      event.type === EventType.VIRTUAL
        ? AttendMode.VIRTUAL
        : event.type === EventType.IN_PERSON
          ? AttendMode.IN_PERSON
          : null;

    const multiCfg = getParsedMultiDayOrNull(event.scheduleMode, event.multiDayConfig);
    const perDayVirtual = multiCfg?.virtualLinkMode === "PER_DAY";
    const firstVirtualUrl = initialGuestVirtualJoinUrl({
      scheduleMode: event.scheduleMode,
      multiDayConfig: event.multiDayConfig,
      eventZoomJoinUrl: event.zoomJoinUrl
    });
    const isMeetingVirtual =
      mode === AttendMode.VIRTUAL &&
      (perDayVirtual ? Boolean(firstVirtualUrl) : Boolean(event.zoomMeetingId && event.zoomSessionKind === ZoomSessionKind.MEETING));
    const initialZoomLink: string | null = isMeetingVirtual ? (perDayVirtual ? firstVirtualUrl : event.zoomJoinUrl) : null;

    const guest = await prisma.guest.create({
      data: {
        eventId: event.id,
        name: contact.name.trim(),
        email: emailNorm,
        phone: contact.phone.trim(),
        contactId: contact.id,
        staffEmployeeId: contact.staffEmployeeId?.trim() || null,
        company: contact.company?.trim() || undefined,
        jobTitle: contact.jobTitle?.trim() || undefined,
        department: contact.department?.trim() || undefined,
        branch: contact.branch?.trim() || undefined,
        tier: Tier.C,
        mode,
        status: GuestStatus.INVITED,
        joinSource: GuestJoinSource.REGISTERED,
        invitationToken,
        qrCode,
        zoomLink: initialZoomLink,
        internalCheckInToken
      }
    });

    const rsvpUrl = getRsvpAcceptAbsoluteUrl(guest.id, invitationToken);
    if (!rsvpUrl) {
      await prisma.guest.delete({ where: { id: guest.id } });
      return { success: false, error: "Could not build RSVP URL (site URL not configured)." };
    }
    revalidatePath(`/o/${parsed.data.orgSlug}`);
    revalidatePath(`/events/${event.id}/guests`);
    return { success: true, data: { kind: "rsvp", rsvpUrl } };
  }

  if (!event.allowFlashEntry) {
    return {
      success: true,
      data: {
        kind: "rejected",
        message:
          "No guest or CRM contact matches this email, and walk-ins are disabled for this event. Ask your organizer to add you or enable walk-ins."
      }
    };
  }

  return { success: true, data: { kind: "need_walkin" } };
}

function firstNameOf(name: string): string {
  const f = name.trim().split(/\s+/)[0];
  return f && f.length > 0 ? f : "there";
}

async function ensureRsvpMagicLinkForGuest(
  eventId: string,
  guest: { id: string; email: string | null; invitationToken: string | null; qrCode: string | null }
): Promise<string> {
  if (guest.invitationToken) return guest.invitationToken;

  const invitationToken = randomBytes(24).toString("hex");
  const qrIdentifier = guest.email?.trim().toLowerCase() || guest.id;
  const qrCode = guest.qrCode ?? createGuestQrCode(eventId, qrIdentifier);

  await prisma.guest.update({
    where: { id: guest.id },
    data: { invitationToken, qrCode }
  });

  return invitationToken;
}

const walkInBaseSchema = z.object({
  orgSlug: z.string().trim().min(1).max(120),
  eventId: z.string().min(1),
  name: z.string().trim().min(2, "Enter your full name."),
  phone: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .refine((p) => isValidE164(p), {
      message: "Enter phone in international format, e.g. +233501234567."
    }),
  company: z.string().trim().max(200).optional().nullable(),
  jobTitle: z.string().trim().max(200).optional().nullable(),
  staffEmployeeId: z.string().trim().max(120).optional().nullable(),
  department: z.string().trim().max(120).optional().nullable()
});

function buildFlashWalkInSchema(emailRequired: boolean) {
  return walkInBaseSchema.extend({ email: guestEmailFieldSchema(emailRequired) });
}

/**
 * Command Center: create a walk-in guest (email not on file) when `allowFlashEntry` is on.
 */
export async function flashEntryCreateWalkIn(
  input: z.input<ReturnType<typeof buildFlashWalkInSchema>>
): Promise<ActionResult<{ rsvpUrl: string }>> {
  const orgSlug =
    typeof input === "object" && input && "orgSlug" in input ? String(input.orgSlug) : "";
  const eventId =
    typeof input === "object" && input && "eventId" in input ? String(input.eventId) : "";

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true }
  });
  if (!org) return { success: false, error: "Organization not found." };

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      orgId: org.id,
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] },
      allowFlashEntry: true
    },
    select: {
      id: true,
      type: true,
      emailMandatoryForRegistration: true,
      registrationProfile: true,
      blueprintTemplate: true,
      internalStaffCheckInMode: true,
      scheduleMode: true,
      multiDayConfig: true,
      zoomJoinUrl: true,
      zoomMeetingId: true,
      zoomSessionKind: true
    }
  });
  if (!event) {
    return { success: false, error: "Event not found, not open, or walk-ins are disabled." };
  }

  const emailRequired = isEmailMandatoryForEvent(event);
  const parsed = buildFlashWalkInSchema(emailRequired).safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const emailNorm = normalizeGuestEmailInput(parsed.data.email, emailRequired);
  if (emailRequired && !emailNorm) {
    return { success: false, error: "Email is required for this event." };
  }
  const phoneNorm = parsed.data.phone.trim();

  if (emailNorm) {
    const dup = await prisma.guest.findFirst({ where: { eventId: event.id, email: emailNorm } });
    if (dup) {
      return {
        success: false,
        error: "A guest with this email was just added. Go back and continue with the same email."
      };
    }
    const contactExists = await prisma.orgContact.findFirst({
      where: { orgId: org.id, email: emailNorm },
      select: { id: true }
    });
    if (contactExists) {
      return {
        success: false,
        error: "This email matches a CRM contact — use Continue without the walk-in form."
      };
    }
  }

  const dupPhone = await prisma.guest.findFirst({ where: { eventId: event.id, phone: phoneNorm } });
  if (dupPhone) {
    return { success: false, error: "Another guest on this event already uses this phone number." };
  }

  const reg = parseRegistrationProfile(event.registrationProfile);
  if (event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF) {
    if (reg.requireStaffId && !parsed.data.staffEmployeeId?.trim()) {
      return { success: false, error: "Staff ID is required for this program." };
    }
    if (reg.requireDepartment && !parsed.data.department?.trim()) {
      return { success: false, error: "Department is required for this program." };
    }
  }

  const invitationToken = randomBytes(24).toString("hex");
  const qrCode = createGuestQrCode(event.id, emailNorm || phoneNorm);
  const issuePersonal =
    event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF &&
    event.internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK;
  const internalCheckInToken = issuePersonal ? newInternalCheckInToken() : null;

  const mode: AttendMode | null =
    event.type === EventType.VIRTUAL
      ? AttendMode.VIRTUAL
      : event.type === EventType.IN_PERSON
        ? AttendMode.IN_PERSON
        : null;

  const multiCfg = getParsedMultiDayOrNull(event.scheduleMode, event.multiDayConfig);
  const perDayVirtual = multiCfg?.virtualLinkMode === "PER_DAY";
  const firstVirtualUrl = initialGuestVirtualJoinUrl({
    scheduleMode: event.scheduleMode,
    multiDayConfig: event.multiDayConfig,
    eventZoomJoinUrl: event.zoomJoinUrl
  });
  const isMeetingVirtual =
    mode === AttendMode.VIRTUAL &&
    (perDayVirtual ? Boolean(firstVirtualUrl) : Boolean(event.zoomMeetingId && event.zoomSessionKind === ZoomSessionKind.MEETING));
  const initialZoomLink: string | null = isMeetingVirtual ? (perDayVirtual ? firstVirtualUrl : event.zoomJoinUrl) : null;

  const guest = await prisma.guest.create({
    data: {
      eventId: event.id,
      name: parsed.data.name.trim(),
      email: emailNorm,
      phone: phoneNorm,
      company: parsed.data.company?.trim() || undefined,
      jobTitle: parsed.data.jobTitle?.trim() || undefined,
      staffEmployeeId: parsed.data.staffEmployeeId?.trim() || null,
      department: parsed.data.department?.trim() || undefined,
      tier: Tier.C,
      mode,
      status: GuestStatus.INVITED,
      joinSource: GuestJoinSource.WALK_IN,
      repId: null,
      invitationToken,
      qrCode,
      zoomLink: initialZoomLink,
      internalCheckInToken
    }
  });

  const rsvpUrl = getRsvpAcceptAbsoluteUrl(guest.id, invitationToken);
  if (!rsvpUrl) {
    await prisma.guest.delete({ where: { id: guest.id } });
    return { success: false, error: "Could not build RSVP URL (site URL not configured)." };
  }

  revalidatePath(`/o/${parsed.data.orgSlug}`);
  revalidatePath(`/events/${event.id}/guests`);
  return { success: true, data: { rsvpUrl } };
}
