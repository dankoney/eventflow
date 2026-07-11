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
import { headers } from "next/headers";
import { z } from "zod";

import {
  isWalkInBoothOpen,
  resolveWalkInBoothCheckInDayIndex
} from "@/lib/checkin/walkInBoothWindow";
import { getParsedMultiDayOrNull, initialGuestVirtualJoinUrl } from "@/lib/event-schedule/multiDayConfig";
import { parseRegistrationProfile } from "@/lib/event-wizard/registrationProfile";
import {
  guestEmailFieldSchema,
  isEmailMandatoryForEvent,
  normalizeGuestEmailInput
} from "@/lib/guest/contactRequirements";
import { newInternalCheckInToken } from "@/lib/internalStaff/personalLinkToken";
import {
  composeE164,
  isValidE164,
  isValidNationalForDial,
  normalizeNationalDigits
} from "@/lib/phone/publicRegistrationPhone";
import { prisma } from "@/lib/prisma";
import { sendCheckInConfirmationNotifications } from "@/lib/checkin/sendCheckInConfirmation";
import {
  assertVenueCapacityForCheckIn,
  maybeNotifyOrgAdminsVenueCapacity
} from "@/lib/checkin/venueCapacity";
import { listPartyMembersForGuest, type PartyMemberRow } from "@/lib/db/checkinParty";
import { createGuestQrCode, validateGuestQrCode } from "@/lib/qr";
import { hitSlidingWindow } from "@/lib/rateLimit/memorySlidingWindow";
import type { ActionResult } from "@/types";

const BOOTH_RL_MAX = 45;
const BOOTH_RL_WINDOW_MS = 600_000;

function formatZodError(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join(" | ");
}

function clientIpForRateLimit(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || h.get("cf-connecting-ip")?.trim() || "unknown";
}

function boothRateLimit(eventId: string): { ok: true } | { ok: false; error: string } {
  const ip = clientIpForRateLimit();
  const rl = hitSlidingWindow(`walk-in-booth:${eventId}:${ip}`, BOOTH_RL_MAX, BOOTH_RL_WINDOW_MS);
  if (!rl.ok) {
    const sec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { ok: false, error: `Too many check-in attempts. Please wait about ${sec}s.` };
  }
  return { ok: true };
}

const boothContextSchema = z.object({
  orgSlug: z.string().trim().min(1).max(120),
  eventId: z.string().min(1)
});

export type WalkInBoothCheckInData = {
  guestName: string;
  alreadyCheckedIn: boolean;
  /** ISO timestamp of the check-in for the current session day. */
  checkedInAt: string;
};

function boothGuestCheckInInclude(dayIndex: number) {
  return {
    checkIns: { where: { dayIndex }, select: { dayIndex: true, checkedInAt: true } }
  } as const;
}

function boothCheckInResult(
  guest: { name: string; checkIns: { dayIndex: number; checkedInAt: Date }[] },
  dayIndex: number,
  alreadyCheckedIn: boolean,
  checkedInAtOverride?: Date
): WalkInBoothCheckInData {
  const row = guest.checkIns.find((c) => c.dayIndex === dayIndex);
  const checkedInAt = (checkedInAtOverride ?? row?.checkedInAt ?? new Date()).toISOString();
  return {
    guestName: guest.name.trim(),
    alreadyCheckedIn,
    checkedInAt
  };
}

async function loadBoothEvent(orgSlug: string, eventId: string) {
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true }
  });
  if (!org) return { ok: false as const, error: "Organization not found." };

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      orgId: org.id,
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] }
    },
    select: {
      id: true,
      orgId: true,
      name: true,
      date: true,
      endDate: true,
      status: true,
      type: true,
      blueprintTemplate: true,
      allowFlashEntry: true,
      emailMandatoryForRegistration: true,
      registrationProfile: true,
      internalStaffCheckInMode: true,
      scheduleMode: true,
      multiDayConfig: true,
      zoomJoinUrl: true,
      zoomMeetingId: true,
      zoomSessionKind: true
    }
  });

  if (!event) {
    return {
      ok: false as const,
      error: "Check-in booth is not available for this event."
    };
  }

  if (event.type === EventType.VIRTUAL) {
    return {
      ok: false as const,
      error: "This is a virtual-only event. Use the virtual join link instead of the onsite booth."
    };
  }

  const boothWindow: Parameters<typeof isWalkInBoothOpen>[0] = {
    date: event.date,
    endDate: event.endDate,
    status: event.status,
    type: event.type
  };
  if (!isWalkInBoothOpen(boothWindow)) {
    return {
      ok: false as const,
      error: "Check-in booth is not open yet. Walk-in check-in opens 2 hours before the event starts."
    };
  }

  const window = resolveWalkInBoothCheckInDayIndex(
    event.scheduleMode,
    event.multiDayConfig,
    event.date,
    event.endDate
  );
  if (!window.ok) {
    return { ok: false as const, error: window.error ?? "Check-in is not open for this session." };
  }

  return { ok: true as const, org, event, dayIndex: window.dayIndex };
}

type GuestForBoothCheckIn = {
  id: string;
  name: string;
  email: string | null;
  status: GuestStatus;
  mode: AttendMode | null;
  checkIns: { dayIndex: number; checkedInAt: Date }[];
};

async function boothResolveGuestCheckIn(
  guest: GuestForBoothCheckIn,
  eventId: string,
  dayIndex: number,
  orgSlug: string
): Promise<ActionResult<BoothCredentialResolveData>> {
  const party = await listPartyMembersForGuest(eventId, guest.id, dayIndex);
  const primaryAlready = guest.checkIns.some((c) => c.dayIndex === dayIndex);

  if (party.members.length > 0) {
    const anyUnchecked = party.members.some((m) => !m.alreadyCheckedIn) || !primaryAlready;
    if (anyUnchecked) {
      return {
        success: true,
        data: {
          kind: "select_party",
          groupName: party.groupName,
          primaryGuestId: guest.id,
          members: party.members
        }
      };
    }
    return {
      success: true,
      data: {
        kind: "checked_in",
        guestName: guest.name.trim(),
        alreadyCheckedIn: true,
        checkedInAt: boothCheckInResult(guest, dayIndex, true).checkedInAt
      }
    };
  }

  const res = await performBoothCheckIn(guest, dayIndex, eventId, orgSlug);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? "Check-in failed." };
  }
  return {
    success: true,
    data: {
      kind: "checked_in",
      guestName: res.data.guestName,
      alreadyCheckedIn: res.data.alreadyCheckedIn,
      checkedInAt: res.data.checkedInAt
    }
  };
}

async function performBoothCheckIn(
  guest: GuestForBoothCheckIn,
  dayIndex: number,
  eventId: string,
  orgSlug: string
): Promise<ActionResult<WalkInBoothCheckInData>> {
  if (guest.status === GuestStatus.DECLINED || guest.status === GuestStatus.NO_SHOW) {
    return { success: false, error: "This registration is no longer active." };
  }

  const alreadyForDay = guest.checkIns.some((c) => c.dayIndex === dayIndex);
  if (alreadyForDay) {
    if (guest.status !== GuestStatus.CHECKED_IN) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { status: GuestStatus.CHECKED_IN, mode: AttendMode.IN_PERSON }
      });
    }
    return {
      success: true,
      data: boothCheckInResult(guest, dayIndex, true)
    };
  }

  const capacity = await assertVenueCapacityForCheckIn(eventId, 1);
  if (!capacity.ok) {
    return { success: false, error: capacity.error };
  }

  try {
    const now = new Date();
    await prisma.$transaction([
      prisma.checkIn.create({
        data: {
          guestId: guest.id,
          dayIndex,
          method: "kiosk",
          source: "walk-in-booth",
          checkedInAt: now
        }
      }),
      prisma.guest.update({
        where: { id: guest.id },
        data: {
          status: GuestStatus.CHECKED_IN,
          mode: AttendMode.IN_PERSON
        }
      })
    ]);

    revalidatePath(`/o/${orgSlug}/${eventId}/checkin`);
    revalidatePath(`/events/${eventId}/checkin`);
    revalidatePath(`/events/${eventId}/guests`);
    revalidatePath(`/events/${eventId}/analytics`);
    revalidatePath(`/events/${eventId}/door`);

    void sendCheckInConfirmationNotifications(guest.id);
    void maybeNotifyOrgAdminsVenueCapacity(eventId, dayIndex);

    return {
      success: true,
      data: boothCheckInResult(guest, dayIndex, false, now)
    };
  } catch {
    return { success: false, error: "Check-in failed. Please try again or see staff at the desk." };
  }
}

function buildGuestCreateFields(
  event: {
    id: string;
    type: EventType;
    blueprintTemplate: EventBlueprintTemplate;
    internalStaffCheckInMode: InternalStaffCheckInMode;
    scheduleMode: Parameters<typeof getParsedMultiDayOrNull>[0];
    multiDayConfig: Parameters<typeof getParsedMultiDayOrNull>[1];
    zoomJoinUrl: string | null;
    zoomMeetingId: string | null;
    zoomSessionKind: ZoomSessionKind | null;
  },
  emailNorm: string | null,
  phoneNorm: string
) {
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
        : AttendMode.IN_PERSON;

  const multiCfg = getParsedMultiDayOrNull(event.scheduleMode, event.multiDayConfig);
  const perDayVirtual = multiCfg?.virtualLinkMode === "PER_DAY";
  const firstVirtualUrl = initialGuestVirtualJoinUrl({
    scheduleMode: event.scheduleMode,
    multiDayConfig: event.multiDayConfig,
    eventZoomJoinUrl: event.zoomJoinUrl
  });
  const isMeetingVirtual =
    mode === AttendMode.VIRTUAL &&
    (perDayVirtual
      ? Boolean(firstVirtualUrl)
      : Boolean(event.zoomMeetingId && event.zoomSessionKind === ZoomSessionKind.MEETING));
  const initialZoomLink: string | null = isMeetingVirtual
    ? perDayVirtual
      ? firstVirtualUrl
      : event.zoomJoinUrl
    : null;

  return { invitationToken, internalCheckInToken, mode, initialZoomLink, qrCode };
}

export type BoothPartyMember = PartyMemberRow;

export type BoothCredentialResolveData =
  | { kind: "checked_in"; guestName: string; alreadyCheckedIn: boolean; checkedInAt: string }
  | {
      kind: "select_party";
      groupName: string | null;
      primaryGuestId: string;
      members: BoothPartyMember[];
    }
  | { kind: "need_walkin"; prefillEmail?: string; prefillPhone?: string }
  | { kind: "rejected"; message: string };

export type BoothPartyCheckInData = {
  checkedInNames: string[];
  alreadyCheckedInNames: string[];
  failed: { name: string; error: string }[];
};

/** @deprecated Use {@link BoothCredentialResolveData}. */
export type BoothEmailResolveData = BoothCredentialResolveData;

function normalizeBoothCredential(
  raw: string
): { ok: true; kind: "email"; value: string } | { ok: true; kind: "phone"; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Enter your email or mobile number." };
  if (trimmed.includes("@")) {
    const emailParsed = z.string().email().safeParse(trimmed);
    if (!emailParsed.success) return { ok: false, error: "Enter a valid email address." };
    return { ok: true, kind: "email", value: trimmed.toLowerCase() };
  }
  let phone = trimmed.replace(/\s/g, "");
  if (!phone.startsWith("+")) {
    phone = `+${phone.replace(/\D/g, "")}`;
  }
  if (!isValidE164(phone)) {
    return {
      ok: false,
      error: "Enter a valid mobile number in international format (e.g. +233501234567)."
    };
  }
  return { ok: true, kind: "phone", value: phone };
}

const boothCredentialSchema = boothContextSchema.extend({
  emailOrPhone: z.string().trim().min(1, "Enter your email or mobile number.")
});

/**
 * Walk-in booth: look up by email or phone, check in existing guests / CRM contacts,
 * or ask for walk-in details when allowed.
 */
export async function boothCheckInByCredential(
  input: z.input<typeof boothCredentialSchema>
): Promise<ActionResult<BoothCredentialResolveData>> {
  const parsed = boothCredentialSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const credential = normalizeBoothCredential(parsed.data.emailOrPhone);
  if (!credential.ok) return { success: false, error: credential.error };

  const rl = boothRateLimit(parsed.data.eventId);
  if (!rl.ok) return { success: false, error: rl.error };

  const ctx = await loadBoothEvent(parsed.data.orgSlug, parsed.data.eventId);
  if (!ctx.ok) return { success: false, error: ctx.error };

  const { org, event, dayIndex } = ctx;

  const guestSelect = {
    id: true,
    name: true,
    email: true,
    status: true,
    mode: true,
    ...boothGuestCheckInInclude(dayIndex)
  } as const;

  if (credential.kind === "phone") {
    const phoneNorm = credential.value;
    const existingByPhone = await prisma.guest.findFirst({
      where: { eventId: event.id, phone: credential.value },
      select: guestSelect
    });
    if (existingByPhone) {
      return boothResolveGuestCheckIn(existingByPhone, event.id, dayIndex, parsed.data.orgSlug);
    }

    const contactByPhone = await prisma.orgContact.findFirst({
      where: { orgId: org.id, phone: credential.value },
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

    if (contactByPhone) {
      const emailNorm = contactByPhone.email?.trim().toLowerCase() || null;
      if (emailNorm) {
        const dupEmail = await prisma.guest.findFirst({
          where: { eventId: event.id, email: emailNorm },
          select: guestSelect
        });
        if (dupEmail) {
          return boothResolveGuestCheckIn(dupEmail, event.id, dayIndex, parsed.data.orgSlug);
        }
      }

      const { invitationToken, internalCheckInToken, mode, initialZoomLink, qrCode } =
        buildGuestCreateFields(event, emailNorm, phoneNorm);

      const created = await prisma.guest.create({
        data: {
          eventId: event.id,
          name: contactByPhone.name.trim(),
          email: emailNorm,
          phone: contactByPhone.phone.trim(),
          contactId: contactByPhone.id,
          staffEmployeeId: contactByPhone.staffEmployeeId?.trim() || null,
          company: contactByPhone.company?.trim() || undefined,
          jobTitle: contactByPhone.jobTitle?.trim() || undefined,
          department: contactByPhone.department?.trim() || undefined,
          branch: contactByPhone.branch?.trim() || undefined,
          tier: Tier.C,
          mode,
          status: GuestStatus.INVITED,
          joinSource: GuestJoinSource.REGISTERED,
          invitationToken,
          qrCode,
          zoomLink: initialZoomLink,
          internalCheckInToken
        },
        select: guestSelect
      });

      const res = await performBoothCheckIn(created, dayIndex, event.id, parsed.data.orgSlug);
      if (!res.success || !res.data) return { success: false, error: res.error ?? "Check-in failed." };
      return {
        success: true,
        data: {
          kind: "checked_in",
          guestName: res.data.guestName,
          alreadyCheckedIn: res.data.alreadyCheckedIn,
          checkedInAt: res.data.checkedInAt
        }
      };
    }

    if (!event.allowFlashEntry) {
      return {
        success: true,
        data: {
          kind: "rejected",
          message:
            "We don't have this mobile number on the guest list or directory. Ask staff to add you, or try your registration email."
        }
      };
    }

    return {
      success: true,
      data: { kind: "need_walkin", prefillPhone: credential.value }
    };
  }

  const emailNorm = credential.value;

  const existingGuest = await prisma.guest.findFirst({
    where: { eventId: event.id, email: emailNorm },
    select: guestSelect
  });

  if (existingGuest) {
    return boothResolveGuestCheckIn(existingGuest, event.id, dayIndex, parsed.data.orgSlug);
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
    const contactPhone = contact.phone.trim();
    const dupPhone = await prisma.guest.findFirst({
      where: { eventId: event.id, phone: contactPhone }
    });
    if (dupPhone) {
      return {
        success: false,
        error: "This contact’s phone number is already used by another guest on this event."
      };
    }

    const { invitationToken, internalCheckInToken, mode, initialZoomLink, qrCode } =
      buildGuestCreateFields(event, emailNorm, contactPhone);

    const created = await prisma.guest.create({
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
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        mode: true,
        checkIns: { where: { dayIndex }, select: { dayIndex: true, checkedInAt: true } }
      }
    });

    const res = await performBoothCheckIn(created, dayIndex, event.id, parsed.data.orgSlug);
    if (!res.success || !res.data) return { success: false, error: res.error ?? "Check-in failed." };
    return {
      success: true,
      data: {
        kind: "checked_in",
        guestName: res.data.guestName,
        alreadyCheckedIn: res.data.alreadyCheckedIn,
        checkedInAt: res.data.checkedInAt
      }
    };
  }

  if (!event.allowFlashEntry) {
    return {
      success: true,
      data: {
        kind: "rejected",
        message:
          "We don't have this email on the guest list or in your organization directory. Ask staff to add you, or use the email you registered with."
      }
    };
  }

  return { success: true, data: { kind: "need_walkin", prefillEmail: emailNorm } };
}

const boothEmailLookupSchema = boothContextSchema.extend({
  email: z.string().trim().email("Enter a valid email address.")
});

const boothPhoneLookupSchema = boothContextSchema.extend({
  phoneDialCode: z.string().min(1),
  phoneNational: z.string().trim().min(1, "Mobile number is required.")
});

/** Pre-registered booth: look up guest by email. */
export async function boothCheckInByEmail(
  input: z.input<typeof boothEmailLookupSchema>
): Promise<ActionResult<BoothCredentialResolveData>> {
  const parsed = boothEmailLookupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  return boothCheckInByCredential({
    orgSlug: parsed.data.orgSlug,
    eventId: parsed.data.eventId,
    emailOrPhone: parsed.data.email.trim().toLowerCase()
  });
}

/** Pre-registered booth: country + national mobile (Ghana default; leading 0 removed for Ghana). */
export async function boothCheckInByPhoneLookup(
  input: z.input<typeof boothPhoneLookupSchema>
): Promise<ActionResult<BoothCredentialResolveData>> {
  const parsed = boothPhoneLookupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const national = normalizeNationalDigits(parsed.data.phoneNational, parsed.data.phoneDialCode);
  if (!isValidNationalForDial(parsed.data.phoneDialCode, national)) {
    return {
      success: false,
      error: "Enter a valid mobile number for the selected country."
    };
  }

  const phoneE164 = composeE164(parsed.data.phoneDialCode, national);

  return boothCheckInByCredential({
    orgSlug: parsed.data.orgSlug,
    eventId: parsed.data.eventId,
    emailOrPhone: phoneE164
  });
}

const boothQrSchema = boothContextSchema.extend({
  qrPayload: z.string().trim().min(1, "Scan a valid QR code.")
});

/** Pre-registered booth: self-scan guest QR from confirmation email. */
export async function boothCheckInByQr(
  input: z.input<typeof boothQrSchema>
): Promise<ActionResult<BoothCredentialResolveData>> {
  const parsed = boothQrSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const qrPayload = parsed.data.qrPayload.trim();
  if (!validateGuestQrCode(qrPayload)) {
    return { success: false, error: "Invalid QR code. Use the code from your registration email." };
  }

  const rl = boothRateLimit(parsed.data.eventId);
  if (!rl.ok) return { success: false, error: rl.error };

  const ctx = await loadBoothEvent(parsed.data.orgSlug, parsed.data.eventId);
  if (!ctx.ok) return { success: false, error: ctx.error };

  const { event, dayIndex } = ctx;

  const guest = await prisma.guest.findFirst({
    where: { eventId: event.id, qrCode: qrPayload },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      mode: true,
      checkIns: { where: { dayIndex }, select: { dayIndex: true, checkedInAt: true } }
    }
  });

  if (!guest) {
    return {
      success: false,
      error: "No guest matches this QR code for this event. Try email or mobile instead."
    };
  }

  return boothResolveGuestCheckIn(guest, event.id, dayIndex, parsed.data.orgSlug);
}

const boothPartyCheckInSchema = boothContextSchema.extend({
  guestIds: z.array(z.string().min(1)).min(1).max(30)
});

/** Check in selected party / table members from the kiosk. */
export async function boothCheckInParty(
  input: z.input<typeof boothPartyCheckInSchema>
): Promise<ActionResult<BoothPartyCheckInData>> {
  const parsed = boothPartyCheckInSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const rl = boothRateLimit(parsed.data.eventId);
  if (!rl.ok) return { success: false, error: rl.error };

  const ctx = await loadBoothEvent(parsed.data.orgSlug, parsed.data.eventId);
  if (!ctx.ok) return { success: false, error: ctx.error };

  const { event, dayIndex } = ctx;
  const uniqueIds = [...new Set(parsed.data.guestIds)];

  const guests = await prisma.guest.findMany({
    where: { eventId: event.id, id: { in: uniqueIds } },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      mode: true,
      eventGuestGroupId: true,
      ...boothGuestCheckInInclude(dayIndex)
    }
  });

  if (guests.length !== uniqueIds.length) {
    return { success: false, error: "One or more guests could not be found for this event." };
  }

  const groupIds = new Set(guests.map((g) => g.eventGuestGroupId).filter(Boolean));
  if (groupIds.size > 1) {
    return { success: false, error: "Selected guests must belong to the same group." };
  }

  const needsCheckIn = guests.filter((g) => !g.checkIns.some((c) => c.dayIndex === dayIndex));
  const capacity = await assertVenueCapacityForCheckIn(event.id, needsCheckIn.length);
  if (!capacity.ok) {
    return { success: false, error: capacity.error };
  }

  const checkedInNames: string[] = [];
  const alreadyCheckedInNames: string[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const guest of guests) {
    const res = await performBoothCheckIn(guest, dayIndex, event.id, parsed.data.orgSlug);
    if (!res.success || !res.data) {
      failed.push({ name: guest.name, error: res.error ?? "Check-in failed." });
      continue;
    }
    if (res.data.alreadyCheckedIn) {
      alreadyCheckedInNames.push(res.data.guestName);
    } else {
      checkedInNames.push(res.data.guestName);
    }
  }

  revalidatePath(`/o/${parsed.data.orgSlug}`);
  revalidatePath(`/events/${event.id}/guests`);
  revalidatePath(`/events/${event.id}/door`);

  return {
    success: true,
    data: { checkedInNames, alreadyCheckedInNames, failed }
  };
}

const boothWalkInBaseSchema = boothContextSchema.extend({
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

function buildBoothWalkInSchema(emailRequired: boolean) {
  return boothWalkInBaseSchema.extend({ email: guestEmailFieldSchema(emailRequired) });
}

/**
 * Walk-in booth step 2: create a new guest and check them in immediately (no RSVP redirect).
 */
export async function boothWalkInCheckIn(
  input: z.input<ReturnType<typeof buildBoothWalkInSchema>>
): Promise<ActionResult<WalkInBoothCheckInData>> {
  const eventId =
    typeof input === "object" && input && "eventId" in input ? String(input.eventId) : "";
  const orgSlug =
    typeof input === "object" && input && "orgSlug" in input ? String(input.orgSlug) : "";

  const ctx = await loadBoothEvent(orgSlug, eventId);
  if (!ctx.ok) return { success: false, error: ctx.error };

  const { event, dayIndex } = ctx;
  const emailRequired = isEmailMandatoryForEvent(event);
  const parsed = buildBoothWalkInSchema(emailRequired).safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const rl = boothRateLimit(parsed.data.eventId);
  if (!rl.ok) return { success: false, error: rl.error };

  if (!event.allowFlashEntry) {
    return { success: false, error: "Walk-in check-in is disabled for this event." };
  }

  const emailNorm = normalizeGuestEmailInput(parsed.data.email, emailRequired);
  if (emailRequired && !emailNorm) {
    return { success: false, error: "Email is required for this event." };
  }
  const phoneNorm = parsed.data.phone.trim();

  if (emailNorm) {
    const dupEmail = await prisma.guest.findFirst({
      where: { eventId: event.id, email: emailNorm }
    });
    if (dupEmail) {
      return { success: false, error: "A guest with this email is already registered for this event." };
    }
  }

  const guestInclude = {
    checkIns: { where: { dayIndex }, select: { dayIndex: true, checkedInAt: true } }
  } as const;
  const guestSelect = {
    id: true,
    name: true,
    email: true,
    status: true,
    mode: true,
    ...guestInclude
  } as const;

  const existingByEmail = await prisma.guest.findFirst({
    where: { eventId: event.id, email: emailNorm },
    select: guestSelect
  });
  if (existingByEmail) {
    const res = await performBoothCheckIn(existingByEmail, dayIndex, event.id, parsed.data.orgSlug);
    revalidatePath(`/o/${parsed.data.orgSlug}`);
    revalidatePath(`/events/${event.id}/guests`);
    return res;
  }

  const existingByPhone = await prisma.guest.findFirst({
    where: { eventId: event.id, phone: phoneNorm },
    select: guestSelect
  });
  if (existingByPhone) {
    const res = await performBoothCheckIn(existingByPhone, dayIndex, event.id, parsed.data.orgSlug);
    revalidatePath(`/o/${parsed.data.orgSlug}`);
    revalidatePath(`/events/${event.id}/guests`);
    return res;
  }

  const contact = emailNorm
    ? await prisma.orgContact.findFirst({
        where: { orgId: ctx.org.id, email: emailNorm },
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
      })
    : null;

  if (contact) {
    const contactPhone = contact.phone.trim();
    if (contactPhone !== phoneNorm) {
      const phoneTaken = await prisma.guest.findFirst({
        where: { eventId: event.id, phone: phoneNorm }
      });
      if (phoneTaken) {
        return {
          success: false,
          error: "This mobile number is already used by another guest on this event."
        };
      }
    }

    const dupPhoneOnOther = await prisma.guest.findFirst({
      where: {
        eventId: event.id,
        phone: contactPhone,
        ...(emailNorm ? { NOT: { email: emailNorm } } : {})
      }
    });
    if (dupPhoneOnOther) {
      return {
        success: false,
        error: "This contact’s phone number is already used by another guest on this event."
      };
    }

    const { invitationToken, internalCheckInToken, mode, initialZoomLink, qrCode } =
      buildGuestCreateFields(event, emailNorm, phoneNorm);

    const fromContact = await prisma.guest.create({
      data: {
        eventId: event.id,
        name: contact.name.trim(),
        email: emailNorm,
        phone: phoneNorm || contactPhone,
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
      },
      select: guestSelect
    });

    const res = await performBoothCheckIn(fromContact, dayIndex, event.id, parsed.data.orgSlug);
    revalidatePath(`/o/${parsed.data.orgSlug}`);
    revalidatePath(`/events/${event.id}/guests`);
    return res;
  }

  const reg = parseRegistrationProfile(event.registrationProfile);
  if (reg.requireCompany && !parsed.data.company?.trim()) {
    return { success: false, error: "Company is required for this event." };
  }
  if (reg.requireJobTitle && !parsed.data.jobTitle?.trim()) {
    return { success: false, error: "Job title is required for this event." };
  }
  if (event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF) {
    if (reg.requireStaffId && !parsed.data.staffEmployeeId?.trim()) {
      return { success: false, error: "Staff ID is required for this program." };
    }
    if (reg.requireDepartment && !parsed.data.department?.trim()) {
      return { success: false, error: "Department is required for this program." };
    }
  }

  const capacityBeforeCreate = await assertVenueCapacityForCheckIn(event.id, 1);
  if (!capacityBeforeCreate.ok) {
    return { success: false, error: capacityBeforeCreate.error };
  }

  const { invitationToken, internalCheckInToken, mode, initialZoomLink, qrCode } = buildGuestCreateFields(
    event,
    emailNorm,
    phoneNorm
  );

  const created = await prisma.guest.create({
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
    },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      mode: true,
      checkIns: { where: { dayIndex }, select: { dayIndex: true, checkedInAt: true } }
    }
  });

  const res = await performBoothCheckIn(created, dayIndex, event.id, parsed.data.orgSlug);
  revalidatePath(`/o/${parsed.data.orgSlug}`);
  revalidatePath(`/events/${event.id}/guests`);
  return res;
}
