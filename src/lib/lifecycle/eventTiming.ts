import { EventStatus } from "@prisma/client";

/** Hours after scheduled end before status becomes COMPLETED. */
export const COMPLETION_GRACE_HOURS = 6;

export function eventCompletionAt(endDate: Date): Date {
  return new Date(endDate.getTime() + COMPLETION_GRACE_HOURS * 60 * 60 * 1000);
}

/** Guest invitation emails may be resent only while the event is open and before the completion window. */
export function eventAllowsGuestInvitationResend(
  event: { status: EventStatus; endDate: Date },
  now = new Date()
): boolean {
  if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.LIVE) {
    return false;
  }
  if (now.getTime() >= eventCompletionAt(event.endDate).getTime()) {
    return false;
  }
  return true;
}

/** @deprecated Use `eventFeedbackWindowIsOpen` from `@/lib/event-feedback/window`. */
export { eventFeedbackWindowIsOpen as eventAllowsPostEventFeedback } from "@/lib/event-feedback/window";
