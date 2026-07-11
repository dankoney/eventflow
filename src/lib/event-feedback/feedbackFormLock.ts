import { EventStatus } from "@prisma/client";

/**
 * When true, organizers cannot change the guest form template (questions / anonymous mode).
 * Answers are keyed by question id; changing the template after responses would orphan data.
 */
export function isEventFeedbackFormLocked(input: {
  eventStatus: EventStatus;
  feedbackResponseCount: number;
}): boolean {
  if (input.eventStatus === EventStatus.CANCELLED) return true;
  return input.feedbackResponseCount > 0;
}

export const FEEDBACK_FORM_LOCKED_MESSAGE =
  "The guest form is locked because at least one person has already submitted feedback. Changing questions would hide their answers in exports. Set up your form before sending requests or collecting the first response.";
