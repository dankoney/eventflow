import { AttendMode, EventStatus, GuestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

export type VirtualZoomOpenResult =
  | { ok: true; zoomUrl: string; alreadyMarked: boolean }
  | { ok: false; error: string };

/**
 * Validates a virtual guest, marks JOINED when eligible, and returns their personal Zoom URL.
 * Used by the server action and the GET /join/[guestId]/open-zoom redirect.
 */
export async function resolveVirtualZoomOpen(guestId: string): Promise<VirtualZoomOpenResult> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      eventId: true,
      mode: true,
      status: true,
      zoomLink: true,
      event: { select: { status: true } }
    }
  });

  if (!guest) return { ok: false, error: "This link is invalid." };
  if (guest.event.status === EventStatus.CANCELLED || guest.event.status === EventStatus.COMPLETED) {
    return { ok: false, error: "This event is no longer active." };
  }
  if (guest.mode !== AttendMode.VIRTUAL) {
    return { ok: false, error: "This action only applies to virtual attendance." };
  }
  const zoomUrl = guest.zoomLink?.trim();
  if (!zoomUrl) {
    return { ok: false, error: "No Zoom link is available for this registration." };
  }

  const alreadyMarked =
    guest.status === GuestStatus.JOINED || guest.status === GuestStatus.CHECKED_IN;

  if (!alreadyMarked) {
    if (guest.status === GuestStatus.NO_SHOW) {
      return { ok: false, error: "This registration is no longer active." };
    }
    if (guest.status !== GuestStatus.REGISTERED && guest.status !== GuestStatus.INVITED) {
      return { ok: false, error: "This registration is not active for a virtual join." };
    }
    try {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { status: GuestStatus.JOINED }
      });
    } catch {
      return { ok: false, error: "Could not update your status. Please try again." };
    }
  }

  revalidatePath(`/join/${guest.id}`);
  revalidatePath(`/events/${guest.eventId}/guests`);
  revalidatePath(`/events/${guest.eventId}/analytics`);

  return { ok: true, zoomUrl, alreadyMarked };
}
