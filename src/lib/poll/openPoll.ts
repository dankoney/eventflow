import type { Poll } from "@prisma/client";

/**
 * Discriminated reason a public poll surface is currently inaccessible. Mapped to
 * user-facing copy by the consumer; centralised here so the OTP request action and
 * the public ballot page agree on which states are recoverable.
 */
export type PollWindowResult =
  | { state: "open"; poll: Poll }
  | { state: "missing" }
  | { state: "inactive"; poll: Poll }
  | { state: "not_started"; poll: Poll }
  | { state: "ended"; poll: Poll };

/**
 * Pure (no I/O) classifier for the poll's open window. The caller passes the Poll
 * row (or `null` if absent) plus an optional `now` for testability.
 */
export function classifyPollWindow(poll: Poll | null, now: Date = new Date()): PollWindowResult {
  if (!poll) return { state: "missing" };
  if (!poll.isActive) return { state: "inactive", poll };
  if (now < poll.startTime) return { state: "not_started", poll };
  if (now >= poll.endTime) return { state: "ended", poll };
  return { state: "open", poll };
}

/** Friendly copy for non-`open` states — used by both the action and the page. */
export function pollWindowMessage(state: Exclude<PollWindowResult["state"], "open">): string {
  switch (state) {
    case "missing":
      return "This event does not have a poll set up yet.";
    case "inactive":
      return "The poll for this event is currently closed by the organizer.";
    case "not_started":
      return "The poll has not opened yet. Try again at the scheduled start time.";
    case "ended":
      return "The poll for this event has closed.";
  }
}

/**
 * True when the poll is active and `now` falls in `[startTime, endTime)`. Use for
 * lightweight queries that only select timing fields.
 */
export function isPollBallotWindowOpen(
  poll: Pick<Poll, "isActive" | "startTime" | "endTime"> | null,
  now: Date = new Date()
): boolean {
  if (!poll) return false;
  if (!poll.isActive) return false;
  if (now < poll.startTime) return false;
  if (now >= poll.endTime) return false;
  return true;
}
