import { EventStatus, GuestStatus } from "@prisma/client";

/** Published/live events: notify removals except invite-only guests who were never emailed. */
export function shouldNotifyGuestOfRemovalFromEvent(
  eventStatus: EventStatus,
  guest: { status: GuestStatus | string; invitationEmailSentAt: Date | null | undefined }
): boolean {
  if (eventStatus !== EventStatus.PUBLISHED && eventStatus !== EventStatus.LIVE) return false;
  if (guest.status === GuestStatus.INVITED && !guest.invitationEmailSentAt) return false;
  return true;
}
