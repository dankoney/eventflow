import { AttendMode, EventStatus, GuestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { appendZoomJoinUrlDisplayName, guestZoomJoinDisplayLabel } from "@/lib/join/zoomJoinDisplayName";
import { getPublicSiteUrl } from "@/lib/url";

export type RecordVirtualJoinCoreResult =
  | { ok: true; zoomUrl: string; alreadyMarked: boolean }
  | { ok: false; error: string };

/**
 * Marks a virtual guest JOINED when applicable and returns the Zoom URL to open.
 * Used by the server action and by GET /join/[guestId]/open-zoom.
 */
export async function recordVirtualJoinAndGetZoomUrl(
  guestId: string
): Promise<RecordVirtualJoinCoreResult> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      name: true,
      company: true,
      eventId: true,
      mode: true,
      status: true,
      zoomLink: true,
      event: {
        select: {
          status: true,
          zoomJoinUrl: true,
          org: { select: { name: true } }
        }
      }
    }
  });

  if (!guest) return { ok: false, error: "This link is invalid." };

  if (guest.event.status === EventStatus.CANCELLED || guest.event.status === EventStatus.COMPLETED) {
    return { ok: false, error: "This event is no longer active." };
  }

  if (guest.mode !== AttendMode.VIRTUAL) {
    return { ok: false, error: "This action only applies to virtual attendance." };
  }

  if (guest.status === GuestStatus.NO_SHOW) {
    return { ok: false, error: "This registration is no longer active." };
  }

  const baseZoomUrl = guest.zoomLink ?? guest.event.zoomJoinUrl ?? null;
  if (!baseZoomUrl) {
    return { ok: false, error: "No Zoom link is available for this registration." };
  }

  const displayLabel = guestZoomJoinDisplayLabel(
    guest.name,
    guest.company,
    guest.event.org.name
  );
  const zoomUrlWithName = appendZoomJoinUrlDisplayName(baseZoomUrl, displayLabel);

  if (guest.status === GuestStatus.JOINED || guest.status === GuestStatus.CHECKED_IN) {
    return { ok: true, zoomUrl: zoomUrlWithName, alreadyMarked: true };
  }

  if (guest.status !== GuestStatus.REGISTERED && guest.status !== GuestStatus.INVITED) {
    return { ok: false, error: "This registration is not active for a virtual join." };
  }

  try {
    await prisma.guest.update({
      where: { id: guest.id },
      data: { status: GuestStatus.JOINED }
    });
    revalidatePath(`/join/${guest.id}`);
    revalidatePath(`/events/${guest.eventId}/guests`);
    revalidatePath(`/events/${guest.eventId}/analytics`);
    return { ok: true, zoomUrl: zoomUrlWithName, alreadyMarked: false };
  } catch {
    return { ok: false, error: "Could not update your status. Please try again." };
  }
}

/** HTTP redirect: record attendance then send the browser to this guest’s Zoom URL. */
export async function virtualJoinGatewayRedirect(guestId: string): Promise<NextResponse> {
  const result = await recordVirtualJoinAndGetZoomUrl(guestId);

  if (!result.ok) {
    const base = getPublicSiteUrl();
    const back = new URL(`/join/${guestId}`, base);
    back.searchParams.set("zoom", "1");
    back.searchParams.set("msg", result.error.slice(0, 200));
    return NextResponse.redirect(back, 302);
  }

  return NextResponse.redirect(result.zoomUrl, 302);
}
