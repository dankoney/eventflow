"use server";

import {
  AttendMode,
  EventBlueprintTemplate,
  EventScheduleMode,
  EventStatus,
  EventType,
  GuestJoinSource,
  GuestStatus,
  InternalStaffCheckInMode,
  InternalStaffMealMenuScope,
  Role,
  Tier,
  type Prisma,
  type Role as RoleType
} from "@prisma/client";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { headers } from "next/headers";

import { auth } from "@/auth";
import { sendCheckInConfirmationNotifications } from "@/lib/checkin/sendCheckInConfirmation";
import {
  assertVenueCapacityForCheckIn,
  maybeNotifyOrgAdminsVenueCapacity
} from "@/lib/checkin/venueCapacity";
import { getDoorDashboardSnapshot } from "@/lib/db/doorDashboard";
import { listCheckInsForEventPaginated, searchGuestsForCheckInLookup } from "@/lib/db/checkins";
import { listPartyMembersForGuest } from "@/lib/db/checkinParty";
import { resolveWalkInBoothCheckInDayIndex } from "@/lib/checkin/walkInBoothWindow";
import { resolveCheckInDayIndexForEvent } from "@/lib/event-schedule/multiDayConfig";
import {
  guestEmailFieldSchema,
  isEmailMandatoryForEvent,
  normalizeGuestEmailInput
} from "@/lib/guest/contactRequirements";
import { prisma } from "@/lib/prisma";
import { assertEventAccess, canManageCheckInRoster, canUseCheckIn, isStaffRole } from "@/lib/permissions";
import { mealLabelsForInternalGuest, resolveMealChoiceLabel } from "@/lib/internalStaff/mealMenu";
import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";
import { createGuestQrCode, validateGuestQrCode } from "@/lib/qr";
import { hitSlidingWindow } from "@/lib/rateLimit/memorySlidingWindow";
import type { ActionResult } from "@/types";

const INTERNAL_CHECKIN_RL_MAX = 30;
const INTERNAL_CHECKIN_RL_WINDOW_MS = 600_000;

function clientIpForRateLimit(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || h.get("cf-connecting-ip")?.trim() || "unknown";
}

const checkInMethodSchema = z.enum(["qr", "manual"]);

const checkInByGuestSchema = z.object({
  eventId: z.string().min(1),
  guestId: z.string().min(1),
  method: checkInMethodSchema
});

const checkInByQrSchema = z.object({
  eventId: z.string().min(1),
  qrPayload: z.string().min(1)
});

const searchSchema = z.object({
  eventId: z.string().min(1),
  query: z.string().min(2).max(120)
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

function mayCheckInGuest(guest: { repId: string | null }, role: RoleType) {
  if (isStaffRole(role)) return true;
  return true;
}

function resolveInternalStaffMealChoiceForCheckIn(params: {
  blueprintTemplate: EventBlueprintTemplate;
  mealMenuEnabled: boolean;
  mealMenuScope: InternalStaffMealMenuScope;
  mealMenuItemsJson: Prisma.JsonValue | null;
  mealMenusByBranchJson: Prisma.JsonValue | null;
  guestBranch: string | null;
  mealChoiceInput: string | undefined;
}): { ok: true; value: string | null } | { ok: false; error: string } {
  if (params.blueprintTemplate !== EventBlueprintTemplate.INTERNAL_STAFF) {
    return { ok: true, value: null };
  }
  if (!params.mealMenuEnabled) return { ok: true, value: null };

  const items = mealLabelsForInternalGuest({
    mealMenuEnabled: true,
    mealMenuScope: params.mealMenuScope,
    mealMenuItemsJson: params.mealMenuItemsJson,
    mealMenusByBranchJson: params.mealMenusByBranchJson,
    guestBranch: params.guestBranch
  });

  if (items.length === 0) {
    if (params.mealMenuScope === InternalStaffMealMenuScope.BY_BRANCH) {
      if (!params.guestBranch?.trim()) {
        return {
          ok: false,
          error:
            "No branch is on file for this profile. Ask your organizer to set your branch (or re-sync from the staff directory) so the correct meal list can load."
        };
      }
      return {
        ok: false,
        error: "No meal menu is set up for your branch. Ask your organizer to add a menu for your location."
      };
    }
    return { ok: true, value: null };
  }

  const raw = (params.mealChoiceInput ?? "").trim();
  if (!raw) return { ok: false, error: "Choose a meal option to finish check-in." };
  const resolved = resolveMealChoiceLabel(raw, items);
  if (!resolved) return { ok: false, error: "Pick one of the meal options shown." };
  return { ok: true, value: resolved };
}

export type CheckInGuestPayload = {
  id: string;
  name: string;
  email: string | null;
  status: GuestStatus;
};

export type CheckInResult = {
  guest: CheckInGuestPayload;
  alreadyCheckedIn: boolean;
};

async function performCheckIn(
  guest: {
    id: string;
    eventId: string;
    name: string;
    email: string | null;
    status: GuestStatus;
    repId: string | null;
    checkIns: { id: string; dayIndex: number }[];
    event: {
      orgId: string;
      scheduleMode: EventScheduleMode;
      multiDayConfig: Prisma.JsonValue | null;
    };
  },
  method: "qr" | "manual",
  userId: string,
  role: RoleType,
  options?: {
    bypassRepScope?: boolean;
    mealChoice?: string | null;
    /** Staff self check-in (public page / personal link): opens 2h before start. */
    staffSelfCheckIn?: { eventDate: Date; eventEndDate: Date };
  }
): Promise<ActionResult<CheckInResult>> {
  if (!options?.bypassRepScope && !mayCheckInGuest(guest, role)) {
    return { success: false, error: "You can only check in guests assigned to you." };
  }

  const window = options?.staffSelfCheckIn
    ? resolveWalkInBoothCheckInDayIndex(
        guest.event.scheduleMode,
        guest.event.multiDayConfig,
        options.staffSelfCheckIn.eventDate,
        options.staffSelfCheckIn.eventEndDate
      )
    : resolveCheckInDayIndexForEvent(guest.event.scheduleMode, guest.event.multiDayConfig);
  if (!window.ok) {
    return { success: false, error: window.error };
  }
  const dayIndex = window.dayIndex;
  if (guest.checkIns.some((c) => c.dayIndex === dayIndex)) {
    return {
      success: true,
      data: {
        guest: {
          id: guest.id,
          name: guest.name,
          email: guest.email,
          status: guest.status
        },
        alreadyCheckedIn: true
      }
    };
  }

  const capacity = await assertVenueCapacityForCheckIn(guest.eventId, 1);
  if (!capacity.ok) {
    return { success: false, error: capacity.error };
  }

  try {
    const mealChoice = options?.mealChoice?.trim() || null;

    await prisma.$transaction([
      prisma.checkIn.create({
        data: {
          guestId: guest.id,
          dayIndex,
          method,
          ...(mealChoice ? { mealChoice } : {})
        }
      }),
      prisma.guest.update({
        where: { id: guest.id },
        data: { status: GuestStatus.CHECKED_IN, mode: AttendMode.IN_PERSON }
      })
    ]);

    const updated = await prisma.guest.findUnique({
      where: { id: guest.id },
      select: { id: true, name: true, email: true, status: true }
    });
    if (!updated) return { success: false, error: "Check-in failed" };

    revalidatePath(`/events/${guest.eventId}/checkin`);
    revalidatePath(`/events/${guest.eventId}/guests`);
    revalidatePath(`/events/${guest.eventId}/door`);

    void sendCheckInConfirmationNotifications(guest.id);
    void maybeNotifyOrgAdminsVenueCapacity(guest.eventId, dayIndex);

    return {
      success: true,
      data: {
        guest: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          status: updated.status
        },
        alreadyCheckedIn: false
      }
    };
  } catch {
    return { success: false, error: "Check-in failed" };
  }
}

const checkInBatchSchema = z.object({
  eventId: z.string().min(1),
  guestIds: z.array(z.string().min(1)).min(1).max(30),
  method: z.enum(["qr", "manual"]).default("manual")
});

export async function checkInGuestsBatch(
  input: z.input<typeof checkInBatchSchema>
): Promise<
  ActionResult<{
    checkedIn: CheckInResult[];
    alreadyCheckedIn: CheckInResult[];
    failed: { guestId: string; error: string }[];
  }>
> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canUseCheckIn(session.user.role)) return { success: false, error: "Unauthorized" };

  const parsed = checkInBatchSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  const guests = await prisma.guest.findMany({
    where: { eventId: event.id, id: { in: parsed.data.guestIds } },
    include: {
      checkIns: { select: { id: true, dayIndex: true } },
      event: {
        select: { orgId: true, scheduleMode: true, multiDayConfig: true }
      }
    }
  });

  const window = resolveCheckInDayIndexForEvent(
    guests[0]?.event.scheduleMode ?? EventScheduleMode.SINGLE_BLOCK,
    guests[0]?.event.multiDayConfig ?? null
  );
  const dayIndex = window.ok ? window.dayIndex : 1;

  const needsNew = guests.filter((g) => !g.checkIns.some((c) => c.dayIndex === dayIndex)).length;
  const capacity = await assertVenueCapacityForCheckIn(event.id, needsNew);
  if (!capacity.ok) return { success: false, error: capacity.error };

  const checkedIn: CheckInResult[] = [];
  const alreadyCheckedIn: CheckInResult[] = [];
  const failed: { guestId: string; error: string }[] = [];

  for (const guest of guests) {
    const res = await performCheckIn(
      guest,
      parsed.data.method,
      session.user.id,
      session.user.role
    );
    if (!res.success || !res.data) {
      failed.push({ guestId: guest.id, error: res.error ?? "Check-in failed." });
      continue;
    }
    if (res.data.alreadyCheckedIn) {
      alreadyCheckedIn.push(res.data);
    } else {
      checkedIn.push(res.data);
    }
  }

  revalidatePath(`/events/${event.id}/checkin`);
  revalidatePath(`/events/${event.id}/door`);

  return { success: true, data: { checkedIn, alreadyCheckedIn, failed } };
}

const doorDashboardSchema = z.object({
  eventId: z.string().min(1)
});

export async function fetchDoorDashboard(
  input: z.input<typeof doorDashboardSchema>
): Promise<ActionResult<NonNullable<Awaited<ReturnType<typeof getDoorDashboardSnapshot>>>>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canUseCheckIn(session.user.role)) return { success: false, error: "Unauthorized" };

  const parsed = doorDashboardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const snap = await getDoorDashboardSnapshot(parsed.data.eventId, session.user.orgId);
  if (!snap) return { success: false, error: "Event not found." };

  return { success: true, data: snap };
}

const checkInsPageSchema = z.object({
  eventId: z.string().min(1),
  query: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(20),
  dayIndex: z.coerce.number().int().min(1).optional()
});

export async function fetchCheckInsPage(
  input: z.input<typeof checkInsPageSchema>
): Promise<ActionResult<Awaited<ReturnType<typeof listCheckInsForEventPaginated>>>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canUseCheckIn(session.user.role)) return { success: false, error: "Unauthorized" };

  const parsed = checkInsPageSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  const data = await listCheckInsForEventPaginated(
    parsed.data.eventId,
    session.user.orgId,
    session.user.id,
    session.user.role,
    {
      query: parsed.data.query,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      dayIndex: parsed.data.dayIndex
    }
  );

  return { success: true, data };
}

const partyMembersSchema = z.object({
  eventId: z.string().min(1),
  guestId: z.string().min(1)
});

export async function fetchPartyMembersForGuest(
  input: z.input<typeof partyMembersSchema>
): Promise<
  ActionResult<{ groupName: string | null; members: Awaited<ReturnType<typeof listPartyMembersForGuest>>["members"] }>
> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canUseCheckIn(session.user.role)) return { success: false, error: "Unauthorized" };

  const parsed = partyMembersSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, scheduleMode: true, multiDayConfig: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  const window = resolveCheckInDayIndexForEvent(event.scheduleMode, event.multiDayConfig);
  const dayIndex = window.ok ? window.dayIndex : 1;

  const party = await listPartyMembersForGuest(event.id, parsed.data.guestId, dayIndex);
  return { success: true, data: party };
}

export async function searchGuestsForCheckIn(
  input: z.input<typeof searchSchema>
): Promise<
  ActionResult<{
    guests: { id: string; name: string; email: string | null; company: string | null; jobTitle: string | null }[];
  }>
> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canUseCheckIn(session.user.role)) return { success: false, error: "Unauthorized" };

  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guests = await searchGuestsForCheckInLookup(
    parsed.data.eventId,
    session.user.orgId,
    session.user.id,
    session.user.role,
    parsed.data.query
  );

  return { success: true, data: { guests } };
}

export async function checkInGuestById(
  input: z.input<typeof checkInByGuestSchema>
): Promise<ActionResult<CheckInResult>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canUseCheckIn(session.user.role)) return { success: false, error: "Unauthorized" };

  const parsed = checkInByGuestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guest = await prisma.guest.findFirst({
    where: {
      id: parsed.data.guestId,
      eventId: parsed.data.eventId,
      event: { orgId: session.user.orgId }
    },
    include: {
      checkIns: { select: { id: true, dayIndex: true } },
      event: {
        select: { orgId: true, scheduleMode: true, multiDayConfig: true }
      }
    }
  });

  if (!guest) return { success: false, error: "Guest not found" };

  return performCheckIn(guest, parsed.data.method, session.user.id, session.user.role);
}

export async function checkInGuestByQr(
  input: z.input<typeof checkInByQrSchema>
): Promise<ActionResult<CheckInResult>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canUseCheckIn(session.user.role)) return { success: false, error: "Unauthorized" };

  const parsed = checkInByQrSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const raw = parsed.data.qrPayload.trim();
  if (!validateGuestQrCode(raw)) {
    return { success: false, error: "Invalid QR code." };
  }

  const guest = await prisma.guest.findFirst({
    where: {
      qrCode: raw,
      eventId: parsed.data.eventId,
      event: { orgId: session.user.orgId }
    },
    include: {
      checkIns: { select: { id: true, dayIndex: true } },
      event: {
        select: { orgId: true, scheduleMode: true, multiDayConfig: true }
      }
    }
  });

  if (!guest) {
    return { success: false, error: "No guest matches this QR code for this event." };
  }

  return performCheckIn(guest, "qr", session.user.id, session.user.role);
}

const publicInternalStaffCheckInSchema = z.object({
  eventId: z.string().min(1),
  credential: z.string().min(1).max(200),
  mealChoice: z.string().max(120).optional()
});

export type PublicInternalStaffCheckInData = CheckInResult & {
  displayNameHint: string;
  zoomJoinUrl: string | null;
};

/** Invite-only internal staff events: staff self check-in with work email or staff ID (no session). */
export async function checkInGuestPublicInternalStaff(
  input: z.input<typeof publicInternalStaffCheckInSchema>
): Promise<ActionResult<PublicInternalStaffCheckInData>> {
  const parsed = publicInternalStaffCheckInSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const ip = clientIpForRateLimit();
  const rl = hitSlidingWindow(
    `internal-staff-checkin:${parsed.data.eventId}:${ip}`,
    INTERNAL_CHECKIN_RL_MAX,
    INTERNAL_CHECKIN_RL_WINDOW_MS
  );
  if (!rl.ok) {
    const sec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { success: false, error: `Too many check-in attempts from this network. Try again in about ${sec}s.` };
  }

  const event = await prisma.event.findFirst({
    where: {
      id: parsed.data.eventId,
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] },
      allowPublicRegistration: false,
      blueprintTemplate: EventBlueprintTemplate.INTERNAL_STAFF
    },
    select: {
      id: true,
      date: true,
      endDate: true,
      zoomJoinUrl: true,
      blueprintTemplate: true,
      internalStaffMealMenuEnabled: true,
      internalStaffMealMenuScope: true,
      internalStaffMealMenuItems: true,
      internalStaffMealMenusByBranch: true
    }
  });
  if (!event) {
    return { success: false, error: "Self check-in is not available for this event." };
  }

  const raw = parsed.data.credential.trim();
  const treatAsEmail = raw.includes("@");

  const guest = await prisma.guest.findFirst({
    where: {
      eventId: event.id,
      OR: treatAsEmail
        ? [{ email: { equals: raw, mode: "insensitive" } }]
        : [
            { staffEmployeeId: { equals: raw, mode: "insensitive" } },
            { email: { equals: raw, mode: "insensitive" } }
          ]
    },
    select: {
      id: true,
      eventId: true,
      name: true,
      email: true,
      status: true,
      repId: true,
      branch: true,
      checkIns: { select: { id: true, dayIndex: true } },
      event: { select: { orgId: true, scheduleMode: true, multiDayConfig: true } }
    }
  });

  if (!guest) {
    return { success: false, error: "No matching record. Use your work email on file." };
  }

  const mealRes = resolveInternalStaffMealChoiceForCheckIn({
    blueprintTemplate: event.blueprintTemplate,
    mealMenuEnabled: event.internalStaffMealMenuEnabled,
    mealMenuScope: event.internalStaffMealMenuScope,
    mealMenuItemsJson: event.internalStaffMealMenuItems,
    mealMenusByBranchJson: event.internalStaffMealMenusByBranch,
    guestBranch: guest.branch,
    mealChoiceInput: parsed.data.mealChoice
  });
  if (!mealRes.ok) return { success: false, error: mealRes.error };

  const res = await performCheckIn(guest, "manual", "public-self-checkin", Role.ADMIN, {
    bypassRepScope: true,
    mealChoice: mealRes.value,
    staffSelfCheckIn: { eventDate: event.date, eventEndDate: event.endDate }
  });
  if (!res.success) {
    return { success: false, error: res.error ?? "Check-in failed" };
  }
  if (!res.data) return { success: false, error: "Check-in failed" };

  revalidatePath(`/register/${parsed.data.eventId}`);

  return {
    success: true,
    data: {
      ...res.data,
      displayNameHint: guest.name.trim(),
      zoomJoinUrl: event.zoomJoinUrl
    }
  };
}

const internalMagicCheckInSchema = z.object({
  eventId: z.string().min(1),
  token: z.string().min(16).max(140),
  mealChoice: z.string().max(120).optional()
});

/** Personal link check-in for internal staff (no session). */
export async function checkInGuestByInternalMagicToken(
  input: z.input<typeof internalMagicCheckInSchema>
): Promise<ActionResult<PublicInternalStaffCheckInData>> {
  const parsed = internalMagicCheckInSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: {
      id: parsed.data.eventId,
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] },
      allowPublicRegistration: false,
      blueprintTemplate: EventBlueprintTemplate.INTERNAL_STAFF,
      internalStaffCheckInMode: InternalStaffCheckInMode.PERSONAL_LINK
    },
    select: {
      id: true,
      date: true,
      endDate: true,
      zoomJoinUrl: true,
      blueprintTemplate: true,
      internalStaffMealMenuEnabled: true,
      internalStaffMealMenuScope: true,
      internalStaffMealMenuItems: true,
      internalStaffMealMenusByBranch: true
    }
  });
  if (!event) {
    return { success: false, error: "This check-in link is not valid for this event." };
  }

  const token = parsed.data.token.trim();
  const guest = await prisma.guest.findFirst({
    where: {
      eventId: event.id,
      internalCheckInToken: token,
      qrCode: null,
      zoomLink: null
    },
    select: {
      id: true,
      eventId: true,
      name: true,
      email: true,
      status: true,
      repId: true,
      branch: true,
      checkIns: { select: { id: true, dayIndex: true } },
      event: { select: { orgId: true, scheduleMode: true, multiDayConfig: true } }
    }
  });

  if (!guest) {
    const ip = clientIpForRateLimit();
    const rl = hitSlidingWindow(
      `internal-magic-checkin:${parsed.data.eventId}:${ip}`,
      INTERNAL_CHECKIN_RL_MAX,
      INTERNAL_CHECKIN_RL_WINDOW_MS
    );
    if (!rl.ok) {
      const sec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
      return {
        success: false,
        error: `Too many attempts from this network. Try again in about ${sec}s.`
      };
    }
    return { success: false, error: "This link is invalid or no longer active. Ask your organizer for a new link." };
  }

  const checkInWindow = resolveWalkInBoothCheckInDayIndex(
    guest.event.scheduleMode,
    guest.event.multiDayConfig,
    event.date,
    event.endDate
  );
  const dayIndex = checkInWindow.ok ? checkInWindow.dayIndex : null;

  // Idempotency: re-opening the same link after logging out should not
  // be treated as an error (and should not hit the rate limiter).
  if (dayIndex != null && guest.checkIns.some((c) => c.dayIndex === dayIndex)) {
    return {
      success: true,
      data: {
        guest: {
          id: guest.id,
          name: guest.name,
          email: guest.email,
          status: guest.status
        },
        alreadyCheckedIn: true,
        displayNameHint: guest.name.trim(),
        zoomJoinUrl: event.zoomJoinUrl
      }
    };
  }

  if (!checkInWindow.ok) {
    return { success: false, error: checkInWindow.error };
  }

  const ip = clientIpForRateLimit();
  const rl = hitSlidingWindow(
    `internal-magic-checkin:${parsed.data.eventId}:${ip}`,
    INTERNAL_CHECKIN_RL_MAX,
    INTERNAL_CHECKIN_RL_WINDOW_MS
  );
  if (!rl.ok) {
    const sec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { success: false, error: `Too many attempts from this network. Try again in about ${sec}s.` };
  }

  const mealRes = resolveInternalStaffMealChoiceForCheckIn({
    blueprintTemplate: event.blueprintTemplate,
    mealMenuEnabled: event.internalStaffMealMenuEnabled,
    mealMenuScope: event.internalStaffMealMenuScope,
    mealMenuItemsJson: event.internalStaffMealMenuItems,
    mealMenusByBranchJson: event.internalStaffMealMenusByBranch,
    guestBranch: guest.branch,
    mealChoiceInput: parsed.data.mealChoice
  });
  if (!mealRes.ok) return { success: false, error: mealRes.error };

  const res = await performCheckIn(guest, "manual", "public-internal-magic", Role.ADMIN, {
    bypassRepScope: true,
    mealChoice: mealRes.value,
    staffSelfCheckIn: { eventDate: event.date, eventEndDate: event.endDate }
  });
  if (!res.success) {
    return { success: false, error: res.error ?? "Check-in failed" };
  }
  if (!res.data) return { success: false, error: "Check-in failed" };

  revalidatePath(`/register/${parsed.data.eventId}`);

  return {
    success: true,
    data: {
      ...res.data,
      displayNameHint: guest.name.trim(),
      zoomJoinUrl: event.zoomJoinUrl
    }
  };
}

const lookupInternalStaffMealSchema = z.object({
  eventId: z.string().min(1),
  credential: z.string().min(1).max(200)
});

/** Resolve meal options after credential lookup (per-branch menus only). */
export async function lookupInternalStaffGuestMealMenu(
  input: z.input<typeof lookupInternalStaffMealSchema>
): Promise<ActionResult<{ guestName: string; mealMenuItems: string[] }>> {
  const parsed = lookupInternalStaffMealSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: {
      id: parsed.data.eventId,
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] },
      allowPublicRegistration: false,
      blueprintTemplate: EventBlueprintTemplate.INTERNAL_STAFF,
      internalStaffMealMenuEnabled: true,
      internalStaffMealMenuScope: InternalStaffMealMenuScope.BY_BRANCH
    },
    select: {
      id: true,
      internalStaffMealMenuItems: true,
      internalStaffMealMenusByBranch: true,
      internalStaffMealMenuScope: true,
      internalStaffMealMenuEnabled: true
    }
  });
  if (!event) {
    return {
      success: false,
      error: "Meal preview is only available for published internal programs that use branch-specific meal menus."
    };
  }

  const raw = parsed.data.credential.trim();
  const treatAsEmail = raw.includes("@");

  const guest = await prisma.guest.findFirst({
    where: {
      eventId: event.id,
      OR: treatAsEmail
        ? [{ email: { equals: raw, mode: "insensitive" } }]
        : [
            { staffEmployeeId: { equals: raw, mode: "insensitive" } },
            { email: { equals: raw, mode: "insensitive" } }
          ]
    },
    select: { name: true, branch: true }
  });
  if (!guest) {
    const ip = clientIpForRateLimit();
    const rl = hitSlidingWindow(
      `internal-staff-meal-lookup:${parsed.data.eventId}:${ip}`,
      INTERNAL_CHECKIN_RL_MAX,
      INTERNAL_CHECKIN_RL_WINDOW_MS
    );
    if (!rl.ok) {
      const sec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
      return {
        success: false,
        error: `Too many attempts from this network. Try again in about ${sec}s.`
      };
    }
    return { success: false, error: "No matching record. Use your work email on file." };
  }

  const items = mealLabelsForInternalGuest({
    mealMenuEnabled: true,
    mealMenuScope: InternalStaffMealMenuScope.BY_BRANCH,
    mealMenuItemsJson: event.internalStaffMealMenuItems,
    mealMenusByBranchJson: event.internalStaffMealMenusByBranch,
    guestBranch: guest.branch
  });

  if (items.length === 0) {
    if (!guest.branch?.trim()) {
      return {
        success: false,
        error:
          "No branch is on file for your profile. Ask your organizer to set your branch (or re-sync from the staff directory)."
      };
    }
    return {
      success: false,
      error: "No meal menu is set up for your branch. Ask your organizer to add a menu for your location."
    };
  }

  return { success: true, data: { guestName: guest.name, mealMenuItems: items } };
}

const magicMealMenuLookupSchema = z.object({
  eventId: z.string().min(1),
  token: z.string().min(16).max(140)
});

/** Load meal options for a personal check-in link when menus are per branch. */
export async function getInternalStaffMagicCheckInMealMenu(
  input: z.input<typeof magicMealMenuLookupSchema>
): Promise<ActionResult<{ guestName: string; mealMenuItems: string[] }>> {
  const parsed = magicMealMenuLookupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const ip = clientIpForRateLimit();
  const rl = hitSlidingWindow(
    `internal-magic-meal-lookup:${parsed.data.eventId}:${ip}`,
    INTERNAL_CHECKIN_RL_MAX,
    INTERNAL_CHECKIN_RL_WINDOW_MS
  );
  if (!rl.ok) {
    const sec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { success: false, error: `Too many attempts from this network. Try again in about ${sec}s.` };
  }

  const event = await prisma.event.findFirst({
    where: {
      id: parsed.data.eventId,
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] },
      allowPublicRegistration: false,
      blueprintTemplate: EventBlueprintTemplate.INTERNAL_STAFF,
      internalStaffCheckInMode: InternalStaffCheckInMode.PERSONAL_LINK,
      internalStaffMealMenuEnabled: true,
      internalStaffMealMenuScope: InternalStaffMealMenuScope.BY_BRANCH
    },
    select: {
      id: true,
      date: true,
      endDate: true,
      scheduleMode: true,
      multiDayConfig: true,
      internalStaffMealMenuItems: true,
      internalStaffMealMenusByBranch: true
    }
  });
  if (!event) {
    return { success: false, error: "Meal preview is not available for this link or event." };
  }

  const token = parsed.data.token.trim();
  const guest = await prisma.guest.findFirst({
    where: {
      eventId: event.id,
      internalCheckInToken: token,
      qrCode: null,
      zoomLink: null
    },
    select: { name: true, branch: true }
  });
  if (!guest) {
    return { success: false, error: "This link is invalid or no longer active." };
  }

  const mealWindow = resolveWalkInBoothCheckInDayIndex(
    event.scheduleMode,
    event.multiDayConfig,
    event.date,
    event.endDate
  );
  if (!mealWindow.ok) {
    return { success: false, error: mealWindow.error };
  }

  const items = mealLabelsForInternalGuest({
    mealMenuEnabled: true,
    mealMenuScope: InternalStaffMealMenuScope.BY_BRANCH,
    mealMenuItemsJson: event.internalStaffMealMenuItems,
    mealMenusByBranchJson: event.internalStaffMealMenusByBranch,
    guestBranch: guest.branch
  });

  if (items.length === 0) {
    if (!guest.branch?.trim()) {
      return {
        success: false,
        error:
          "No branch is on file for your profile. Ask your organizer to set your branch (or re-sync from the staff directory)."
      };
    }
    return {
      success: false,
      error: "No meal menu is set up for your branch. Ask your organizer to add a menu for your location."
    };
  }

  return { success: true, data: { guestName: guest.name, mealMenuItems: items } };
}

const revokeCheckInSchema = z.object({
  eventId: z.string().min(1),
  checkInId: z.string().min(1)
});

/** Admin/marketing: remove one check-in record and revert guest status when appropriate. */
export async function revokeCheckInForOrganizer(
  input: z.input<typeof revokeCheckInSchema>
): Promise<ActionResult<{ guestId: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canManageCheckInRoster(session.user.role)) {
    return { success: false, error: "You do not have permission to undo check-ins." };
  }

  const parsed = revokeCheckInSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const row = await prisma.checkIn.findFirst({
    where: {
      id: parsed.data.checkInId,
      guest: { eventId: parsed.data.eventId, event: { orgId: session.user.orgId } }
    },
    select: { id: true, guestId: true }
  });
  if (!row) return { success: false, error: "Check-in not found." };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.checkIn.delete({ where: { id: row.id } });
      const remaining = await tx.checkIn.count({ where: { guestId: row.guestId } });
      if (remaining === 0) {
        const g = await tx.guest.findUnique({
          where: { id: row.guestId },
          select: { qrCode: true, zoomLink: true }
        });
        const fallback = g?.qrCode || g?.zoomLink ? GuestStatus.REGISTERED : GuestStatus.INVITED;
        await tx.guest.update({
          where: { id: row.guestId },
          data: { status: fallback }
        });
      }
    });
    revalidatePath(`/events/${parsed.data.eventId}/checkin`);
    revalidatePath(`/events/${parsed.data.eventId}/guests`);
    return { success: true, data: { guestId: row.guestId } };
  } catch {
    return { success: false, error: "Could not revoke check-in." };
  }
}

const offlineSyncSchema = z.object({
  eventId: z.string().min(1),
  items: z.array(
    z.object({
      guestId: z.string().min(1),
      method: z.enum(["qr", "manual"])
    })
  )
});

/** Replay check-ins captured offline (PWA). Idempotent for already-checked-in guests. */
export async function syncOfflineCheckIns(
  input: z.input<typeof offlineSyncSchema>
): Promise<ActionResult<{ synced: number; skipped: number; errors: string[] }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canUseCheckIn(session.user.role)) return { success: false, error: "Unauthorized" };

  const parsed = offlineSyncSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of parsed.data.items) {
    const res = await checkInGuestById({
      eventId: parsed.data.eventId,
      guestId: item.guestId,
      method: item.method
    });
    if (res.success) {
      if (res.data?.alreadyCheckedIn) skipped += 1;
      else synced += 1;
    } else {
      errors.push(res.error ?? "Failed");
    }
  }

  return { success: true, data: { synced, skipped, errors } };
}

const staffWalkInSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(2, "Name is required.").max(160),
  email: z.string().trim().optional(),
  phoneDialCode: z.string().min(1),
  phoneNational: z.string().trim().min(1, "Mobile number is required."),
  company: z.string().trim().max(200).optional()
});

function staffWalkInPhoneE164(dialCode: string, national: string): string | null {
  const digits = national.replace(/\D/g, "");
  if (!digits) return null;
  const code = dialCode.replace(/\D/g, "");
  const e164 = `+${code}${digits}`;
  return isValidE164(e164) ? e164 : null;
}

/** Staff desk: register a walk-in attendee and check them in (session-scoped PII). */
export async function registerStaffWalkInAndCheckIn(
  input: z.input<typeof staffWalkInSchema>
): Promise<ActionResult<CheckInResult>> {
  const session = await auth();
  if (!session?.user?.orgId || !canUseCheckIn(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  if (!isStaffRole(session.user.role)) {
    return { success: false, error: "Walk-in registration is limited to staff at the check-in desk." };
  }
  if (!session.sessionId) {
    return { success: false, error: "Session expired. Sign in again to register walk-ins." };
  }

  const parsed = staffWalkInSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const access = await assertEventAccess(parsed.data.eventId, session.user.orgId, {
    userId: session.user.id,
    role: session.user.role,
    orgId: session.user.orgId,
    sessionId: session.sessionId
  });
  if (!access) return { success: false, error: "You are not on the team for this event." };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: {
      id: true,
      type: true,
      emailMandatoryForRegistration: true,
      status: true
    }
  });
  if (!event) return { success: false, error: "Event not found." };
  if (event.status === EventStatus.CANCELLED || event.status === EventStatus.COMPLETED) {
    return { success: false, error: "This event is no longer accepting check-ins." };
  }

  const emailSchema = guestEmailFieldSchema(isEmailMandatoryForEvent(event));
  const emailParsed = emailSchema.safeParse(parsed.data.email ?? "");
  if (!emailParsed.success) {
    return { success: false, error: emailParsed.error.issues[0]?.message ?? "Invalid email." };
  }
  const emailNorm = normalizeGuestEmailInput(emailParsed.data, isEmailMandatoryForEvent(event));
  const phoneNorm = staffWalkInPhoneE164(parsed.data.phoneDialCode, parsed.data.phoneNational);
  if (!phoneNorm) {
    return { success: false, error: "Enter a valid mobile number." };
  }

  if (emailNorm) {
    const dupEmail = await prisma.guest.findFirst({
      where: { eventId: event.id, email: emailNorm },
      select: { id: true }
    });
    if (dupEmail) {
      return {
        success: false,
        error: "A guest with this email is already on the roster. Search and check them in instead."
      };
    }
  }

  const dupPhone = await prisma.guest.findFirst({
    where: { eventId: event.id, phone: phoneNorm },
    select: { id: true }
  });
  if (dupPhone) {
    return {
      success: false,
      error: "A guest with this phone number is already on the roster. Search and check them in instead."
    };
  }

  const capacity = await assertVenueCapacityForCheckIn(event.id, 1);
  if (!capacity.ok) return { success: false, error: capacity.error };

  const qrIdentifier = emailNorm || phoneNorm;
  const invitationToken = randomBytes(24).toString("hex");
  const qrCode = createGuestQrCode(event.id, qrIdentifier);
  const mode =
    event.type === EventType.VIRTUAL
      ? AttendMode.VIRTUAL
      : AttendMode.IN_PERSON;

  const guest = await prisma.guest.create({
    data: {
      eventId: event.id,
      name: parsed.data.name.trim(),
      email: emailNorm,
      phone: phoneNorm,
      company: parsed.data.company?.trim() || undefined,
      tier: Tier.C,
      mode,
      status: GuestStatus.INVITED,
      joinSource: GuestJoinSource.WALK_IN,
      repId: null,
      createdByUserId: session.user.id,
      staffVisibleSessionId: session.sessionId,
      invitationToken,
      qrCode
    },
    include: {
      checkIns: { select: { id: true, dayIndex: true } },
      event: {
        select: { orgId: true, scheduleMode: true, multiDayConfig: true }
      }
    }
  });

  const checkInRes = await performCheckIn(guest, "manual", session.user.id, session.user.role, {
    bypassRepScope: true
  });

  if (checkInRes.success) {
    revalidatePath(`/events/${event.id}/checkin`);
    revalidatePath(`/events/${event.id}/guests`);
    revalidatePath(`/events/${event.id}/door`);
  }

  return checkInRes;
}
