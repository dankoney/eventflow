import { AttendMode, EventStatus, EventType, GuestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  getParsedMultiDayOrNull,
  isNowWithinAnySessionDay,
  resolveCheckInDayIndexForEvent
} from "@/lib/event-schedule/multiDayConfig";
import { appendZoomJoinUrlDisplayName, guestZoomJoinDisplayLabel } from "@/lib/join/zoomJoinDisplayName";
import { getPublicSiteUrl } from "@/lib/url";

export type RecordVirtualJoinCoreResult =
  | { ok: true; zoomUrl: string; alreadyMarked: boolean }
  | { ok: false; error: string };

/**
 * Returns the Zoom URL to open. Marks a virtual guest JOINED only while the event is in its
 * virtual attendance window (overall start–end for single-block; inside a scheduled session day for multi-day).
 * Outside that window the link still works but status is left unchanged so email previews do not count as joined.
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
          id: true,
          status: true,
          type: true,
          date: true,
          endDate: true,
          scheduleMode: true,
          multiDayConfig: true,
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

  if (guest.mode === AttendMode.IN_PERSON) {
    if (guest.event.type === EventType.HYBRID) {
      return { ok: true, zoomUrl: zoomUrlWithName, alreadyMarked: true };
    }
    return { ok: false, error: "This action only applies to virtual attendance." };
  }

  if (guest.status === GuestStatus.CHECKED_IN) {
    return { ok: true, zoomUrl: zoomUrlWithName, alreadyMarked: true };
  }

  // A previously JOINED guest (clicked while event was still PUBLISHED) should still
  // be upgraded to CHECKED_IN when they click again during the LIVE window — Phase 3
  // auto check-in. Outside the LIVE window we keep the current short-circuit so the
  // status is left alone.
  if (guest.status === GuestStatus.JOINED && guest.event.status !== EventStatus.LIVE) {
    return { ok: true, zoomUrl: zoomUrlWithName, alreadyMarked: true };
  }

  if (
    guest.status !== GuestStatus.REGISTERED &&
    guest.status !== GuestStatus.INVITED &&
    guest.status !== GuestStatus.ACCEPTED &&
    guest.status !== GuestStatus.JOINED
  ) {
    return { ok: false, error: "This registration is not active for a virtual join." };
  }

  const now = Date.now();
  const ev = guest.event;
  const md = getParsedMultiDayOrNull(ev.scheduleMode, ev.multiDayConfig);
  const withinVirtualAttendanceWindow = md
    ? isNowWithinAnySessionDay(md, new Date(now))
    : now >= ev.date.getTime() && now <= ev.endDate.getTime();

  try {
    if (withinVirtualAttendanceWindow) {
      // Phase 3: when the event is LIVE, opening the Zoom redirect doubles as an auto
      // check-in. The guest is set to CHECKED_IN and a CheckIn row is written with
      // method="manual" / source="open-zoom-redirect". PUBLISHED events (early click,
      // before kickoff) still get the lighter `JOINED` status without a CheckIn row.
      const isLive = ev.status === EventStatus.LIVE;
      const window = resolveCheckInDayIndexForEvent(ev.scheduleMode, ev.multiDayConfig, new Date(now));
      const writeCheckIn = isLive && window.ok;
      const nextStatus = isLive ? GuestStatus.CHECKED_IN : GuestStatus.JOINED;

      await prisma.$transaction(async (tx) => {
        await tx.guest.update({
          where: { id: guest.id },
          data: {
            status: nextStatus,
            ...(guest.mode == null ? { mode: AttendMode.VIRTUAL } : {})
          }
        });
        if (writeCheckIn) {
          const dayIndex = window.dayIndex;
          const existing = await tx.checkIn.findUnique({
            where: { guestId_dayIndex: { guestId: guest.id, dayIndex } }
          });
          if (!existing) {
            await tx.checkIn.create({
              data: {
                guestId: guest.id,
                dayIndex,
                method: "manual",
                source: "open-zoom-redirect"
              }
            });
          }
        }
      });
      revalidatePath(`/join/${guest.id}`);
      revalidatePath(`/events/${guest.eventId}/guests`);
      revalidatePath(`/events/${guest.eventId}/analytics`);
      if (writeCheckIn) {
        revalidatePath(`/events/${guest.eventId}/checkin`);
      }
    }
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
