import { EventStatus } from "@prisma/client";

/**
 * Days after the scheduled program end that guests may submit or update feedback.
 */
export const FEEDBACK_COLLECTION_DAYS = Number(
  process.env.EVENT_FEEDBACK_COLLECTION_DAYS?.trim() || "14"
);

export type EventFeedbackWindowPhase = "unavailable" | "not_yet_open" | "open" | "closed";

export type EventFeedbackWindow = {
  phase: EventFeedbackWindowPhase;
  /** When feedback collection opens (event start — guests can respond before leaving). */
  opensAt: Date;
  /** When new submissions and edits stop. */
  closesAt: Date;
  unavailableReason?: "cancelled" | "draft";
};

export function eventFeedbackClosesAt(endDate: Date): Date {
  return new Date(endDate.getTime() + FEEDBACK_COLLECTION_DAYS * 24 * 60 * 60 * 1000);
}

export function getEventFeedbackWindow(
  event: { status: EventStatus; date: Date; endDate: Date },
  now = new Date()
): EventFeedbackWindow {
  const opensAt = event.date;
  const closesAt = eventFeedbackClosesAt(event.endDate);

  if (event.status === EventStatus.CANCELLED) {
    return { phase: "unavailable", opensAt, closesAt, unavailableReason: "cancelled" };
  }
  if (event.status === EventStatus.DRAFT) {
    return { phase: "unavailable", opensAt, closesAt, unavailableReason: "draft" };
  }

  const t = now.getTime();
  if (t < opensAt.getTime()) {
    return { phase: "not_yet_open", opensAt, closesAt };
  }
  if (t >= closesAt.getTime()) {
    return { phase: "closed", opensAt, closesAt };
  }
  return { phase: "open", opensAt, closesAt };
}

export function eventFeedbackWindowIsOpen(
  event: { status: EventStatus; date: Date; endDate: Date },
  now = new Date()
): boolean {
  return getEventFeedbackWindow(event, now).phase === "open";
}

/**
 * Admins may send feedback invitations once the event has started (through the collection window).
 */
export function eventAllowsFeedbackRequestBlast(
  event: { status: EventStatus; date: Date; endDate: Date },
  now = new Date()
): boolean {
  if (event.status === EventStatus.CANCELLED || event.status === EventStatus.DRAFT) {
    return false;
  }
  return now.getTime() >= event.date.getTime() && eventFeedbackWindowIsOpen(event, now);
}

export function guestFeedbackClosedMessage(window: EventFeedbackWindow): string {
  if (window.phase === "not_yet_open") {
    return "Feedback opens when the event starts.";
  }
  if (window.phase === "closed") {
    return `The feedback period ended on ${window.closesAt.toLocaleDateString(undefined, {
      dateStyle: "medium"
    })}. Responses can no longer be submitted or changed.`;
  }
  if (window.unavailableReason === "cancelled") {
    return "This event was cancelled. Feedback is not collected.";
  }
  return "Feedback is not available for this event.";
}
