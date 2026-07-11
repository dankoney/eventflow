import type { EventFeedbackWindow } from "@/lib/event-feedback/window";

/** Label for attended guests who have not submitted feedback (exports & dashboard). */
export function feedbackPendingResponseMetricLabel(window: EventFeedbackWindow): string {
  if (window.phase === "closed") {
    return "Did not respond";
  }
  return "Awaiting response";
}

export function feedbackPendingResponseMetricHint(window: EventFeedbackWindow): string | undefined {
  if (window.phase === "closed") {
    return "Attended, no feedback before close";
  }
  if (window.phase === "open") {
    return "Attended, not submitted yet";
  }
  return undefined;
}
