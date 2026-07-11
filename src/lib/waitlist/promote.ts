import {
  AttendMode,
  EventStatus,
  GuestStatus,
  WaitlistStatus,
  type Prisma
} from "@prisma/client";
import { randomBytes } from "crypto";

import { guestHasDeliverableEmail } from "@/lib/guest/contactRequirements";
import { sendGuestInvitationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  getPublicSiteUrl,
  getRsvpAcceptAbsoluteUrl,
  getRsvpDeclineAbsoluteUrl
} from "@/lib/url";
import { formatDate, formatLocationLine } from "@/lib/utils";

export type WaitlistPromotionResult = {
  /** How many waitlisted contacts were promoted to Guests in this run. */
  promoted: number;
  /** Open in-person seats remaining (null = no in-person capacity for this event). */
  inPersonRemaining: number | null;
  /** Open virtual seats remaining (null = virtual not configured). */
  virtualRemaining: number | null;
};

const eventForPromoteInclude = {
  location: true,
  org: {
    select: {
      name: true,
      logo: true,
      defaultEventBrandLogoUrl: true,
      resendApiKey: true
    }
  }
} as const satisfies Prisma.EventInclude;

/**
 * Capacity-aware waitlist promotion. Loops through WAITING entries (FIFO by
 * `position`), promotes each into a Guest record with status `INVITED` + a
 * fresh invitation token, and dispatches the smart-invitation email. Stops when
 * either no entries remain or the event has no open seats matching anyone's
 * preferred mode.
 *
 * Returns counts so callers (e.g. submitRsvpDecline) can surface UI feedback.
 * Safe to call any time — gated by event status (PUBLISHED/LIVE only) and
 * silently no-ops on draft events.
 */
export async function promoteEventWaitlist(eventId: string): Promise<WaitlistPromotionResult> {
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    include: eventForPromoteInclude
  });
  if (!event) return { promoted: 0, inPersonRemaining: null, virtualRemaining: null };

  // Gate: never auto-invite from a draft / completed / cancelled event.
  if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.LIVE) {
    return {
      promoted: 0,
      inPersonRemaining: capacityRemaining(event.capacity, 0, event.type !== "VIRTUAL"),
      virtualRemaining: capacityRemaining(event.virtualCapacity, 0, event.type !== "IN_PERSON")
    };
  }

  let inPersonOpen = await openInPersonSeats(event.id, event.capacity, event.type);
  let virtualOpen = await openVirtualSeats(event.id, event.virtualCapacity, event.type);

  let promoted = 0;
  // Loop until no FIFO candidate fits, or queue is empty.
  while (true) {
    const next = await findNextEligibleWaiter({
      eventId: event.id,
      inPersonOpen,
      virtualOpen,
      eventType: event.type
    });
    if (!next) break;

    const created = await promoteOne(event, next);
    if (!created) break;
    promoted += 1;

    if (created.mode === AttendMode.IN_PERSON && inPersonOpen != null) inPersonOpen -= 1;
    if (created.mode === AttendMode.VIRTUAL && virtualOpen != null) virtualOpen -= 1;
    if ((inPersonOpen ?? 1) <= 0 && (virtualOpen ?? 1) <= 0) break;
  }

  return {
    promoted,
    inPersonRemaining: inPersonOpen,
    virtualRemaining: virtualOpen
  };
}

async function openInPersonSeats(
  eventId: string,
  capacity: number,
  type: string
): Promise<number | null> {
  if (type === "VIRTUAL") return null;
  if (capacity <= 0) return null;
  const taken = await prisma.guest.count({
    where: {
      eventId,
      mode: AttendMode.IN_PERSON,
      status: { not: GuestStatus.DECLINED }
    }
  });
  return Math.max(capacity - taken, 0);
}

async function openVirtualSeats(
  eventId: string,
  capacity: number,
  type: string
): Promise<number | null> {
  if (type === "IN_PERSON") return null;
  if (capacity <= 0) return null;
  const taken = await prisma.guest.count({
    where: {
      eventId,
      mode: AttendMode.VIRTUAL,
      status: { not: GuestStatus.DECLINED }
    }
  });
  return Math.max(capacity - taken, 0);
}

function capacityRemaining(capacity: number, taken: number, mode: boolean): number | null {
  if (!mode) return null;
  if (capacity <= 0) return null;
  return Math.max(capacity - taken, 0);
}

async function findNextEligibleWaiter(args: {
  eventId: string;
  inPersonOpen: number | null;
  virtualOpen: number | null;
  eventType: string;
}) {
  // Pick the FIFO entry whose preferredMode matches an open seat (preferredMode null
  // = "any" — accepts whichever side has space, in-person first to match Bizzabo style).
  const candidates = await prisma.eventWaitlistEntry.findMany({
    where: { eventId: args.eventId, status: WaitlistStatus.WAITING },
    orderBy: { position: "asc" },
    take: 25
  });
  for (const c of candidates) {
    if (c.preferredMode === AttendMode.IN_PERSON) {
      if ((args.inPersonOpen ?? 0) > 0) return c;
      continue;
    }
    if (c.preferredMode === AttendMode.VIRTUAL) {
      if ((args.virtualOpen ?? 0) > 0) return c;
      continue;
    }
    if ((args.inPersonOpen ?? 0) > 0) return c;
    if ((args.virtualOpen ?? 0) > 0) return c;
  }
  return null;
}

async function promoteOne(
  event: Prisma.EventGetPayload<{ include: typeof eventForPromoteInclude }>,
  entry: Prisma.EventWaitlistEntryGetPayload<{}>
) {
  const emailNorm = entry.email.trim().toLowerCase();

  // If this email is somehow already on the event (e.g. they registered manually
  // since being added to the waitlist), just mark the entry promoted without
  // creating a duplicate Guest.
  const existingGuest = await prisma.guest.findFirst({
    where: { eventId: event.id, email: emailNorm }
  });
  if (existingGuest) {
    await prisma.eventWaitlistEntry.update({
      where: { id: entry.id },
      data: {
        status: WaitlistStatus.PROMOTED,
        promotedToGuestId: existingGuest.id,
        notifiedAt: new Date()
      }
    });
    return null;
  }

  const desiredMode: AttendMode | null = entry.preferredMode ?? AttendMode.IN_PERSON;
  const invitationToken = randomBytes(24).toString("hex");

  const guest = await prisma.guest.create({
    data: {
      eventId: event.id,
      name: entry.name,
      email: emailNorm,
      phone: entry.phone,
      company: entry.company,
      mode: desiredMode,
      tier: "C",
      status: GuestStatus.INVITED,
      invitationToken
    }
  });

  await prisma.eventWaitlistEntry.update({
    where: { id: entry.id },
    data: {
      status: WaitlistStatus.PROMOTED,
      promotedToGuestId: guest.id,
      notifiedAt: new Date()
    }
  });

  // Fire smart invitation email (subject to publish gating already enforced upstream).
  if (guestHasDeliverableEmail(guest.email)) {
    try {
      const baseUrl = getPublicSiteUrl().replace(/\/$/, "");
      const acceptUrl =
        getRsvpAcceptAbsoluteUrl(guest.id, invitationToken) ??
        `${baseUrl}/rsvp/${guest.id}/${invitationToken}`;
      const declineUrl =
        getRsvpDeclineAbsoluteUrl(guest.id, invitationToken) ??
        `${baseUrl}/rsvp/${guest.id}/${invitationToken}/decline`;
      const directionsUrl = event.location?.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.location.name} ${event.location.address}`)}`
        : null;

      await sendGuestInvitationEmail({
        to: guest.email!,
        guestName: guest.name,
        eventName: event.name,
        eventDate: formatDate(event.date),
        locationLine: formatLocationLine(event.location),
        acceptUrl,
        declineUrl,
        orgName: event.org.name,
        brandLogoUrl: event.brandLogoUrl,
        orgLogoUrl: event.org.logo,
        orgDefaultBrandLogoUrl: event.org.defaultEventBrandLogoUrl,
        bannerImageUrl: event.bannerImageUrl,
        brandPrimaryColor: event.brandPrimaryColor,
        hookCopy:
          event.description?.trim() ||
          "A spot just opened up for you — confirm your attendance below.",
        directionsUrl,
        siteBaseUrl: baseUrl,
        resendApiKeyOverride: event.org.resendApiKey?.trim() || undefined
      });
      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationEmailSentAt: new Date() }
      });
    } catch (e) {
      console.error("[waitlist] promotion invitation email failed", guest.id, e);
    }
  }

  return { guestId: guest.id, mode: desiredMode };
}
