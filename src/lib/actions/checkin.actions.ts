"use server";

import { GuestStatus, type Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { searchGuestsForCheckInLookup } from "@/lib/db/checkins";
import { prisma } from "@/lib/prisma";
import { canUseCheckIn, isRepScopedRole } from "@/lib/permissions";
import { validateGuestQrCode } from "@/lib/qr";
import type { ActionResult } from "@/types";

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

function repScopedMayCheckInGuest(guest: { repId: string | null }, userId: string, role: Role) {
  if (!isRepScopedRole(role)) return true;
  return !!guest.repId && guest.repId === userId;
}

export type CheckInGuestPayload = {
  id: string;
  name: string;
  email: string;
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
    email: string;
    status: GuestStatus;
    repId: string | null;
    checkIn: { id: string } | null;
    event: { orgId: string };
  },
  method: "qr" | "manual",
  userId: string,
  role: Role
): Promise<ActionResult<CheckInResult>> {
  if (!repScopedMayCheckInGuest(guest, userId, role)) {
    return { success: false, error: "You can only check in guests assigned to you." };
  }

  if (guest.checkIn) {
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

  try {
    await prisma.$transaction([
      prisma.checkIn.create({
        data: {
          guestId: guest.id,
          method
        }
      }),
      prisma.guest.update({
        where: { id: guest.id },
        data: { status: GuestStatus.CHECKED_IN }
      })
    ]);

    const updated = await prisma.guest.findUnique({
      where: { id: guest.id },
      select: { id: true, name: true, email: true, status: true }
    });
    if (!updated) return { success: false, error: "Check-in failed" };

    revalidatePath(`/events/${guest.eventId}/checkin`);
    revalidatePath(`/events/${guest.eventId}/guests`);

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

export async function searchGuestsForCheckIn(
  input: z.input<typeof searchSchema>
): Promise<ActionResult<{ guests: { id: string; name: string; email: string }[] }>> {
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
      checkIn: { select: { id: true } },
      event: { select: { orgId: true } }
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
      checkIn: { select: { id: true } },
      event: { select: { orgId: true } }
    }
  });

  if (!guest) {
    return { success: false, error: "No guest matches this QR code for this event." };
  }

  return performCheckIn(guest, "qr", session.user.id, session.user.role);
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
