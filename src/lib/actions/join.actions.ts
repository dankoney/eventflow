"use server";

import { AttendMode, GuestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const recordJoinSchema = z.object({
  guestId: z.string().min(1)
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

/**
 * Marks a virtual guest as JOINED (self-service from /join/[guestId]).
 * Idempotent for JOINED / CHECKED_IN. No auth — guest id is the capability token.
 */
export async function recordVirtualJoin(
  input: z.input<typeof recordJoinSchema>
): Promise<ActionResult<{ alreadyMarked: boolean }>> {
  const parsed = recordJoinSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guest = await prisma.guest.findUnique({
    where: { id: parsed.data.guestId },
    select: { id: true, eventId: true, mode: true, status: true }
  });

  if (!guest) return { success: false, error: "This link is invalid." };

  if (guest.mode !== AttendMode.VIRTUAL) {
    return { success: false, error: "This action only applies to virtual attendance." };
  }

  if (guest.status === GuestStatus.JOINED || guest.status === GuestStatus.CHECKED_IN) {
    return { success: true, data: { alreadyMarked: true } };
  }

  if (guest.status === GuestStatus.NO_SHOW) {
    return { success: false, error: "This registration is no longer active." };
  }

  if (guest.status !== GuestStatus.REGISTERED && guest.status !== GuestStatus.INVITED) {
    return { success: false, error: "This registration is not active for a virtual join." };
  }

  try {
    await prisma.guest.update({
      where: { id: guest.id },
      data: { status: GuestStatus.JOINED }
    });
    revalidatePath(`/join/${guest.id}`);
    revalidatePath(`/events/${guest.eventId}/guests`);
    revalidatePath(`/events/${guest.eventId}/analytics`);
    return { success: true, data: { alreadyMarked: false } };
  } catch {
    return { success: false, error: "Could not update your status. Please try again." };
  }
}
