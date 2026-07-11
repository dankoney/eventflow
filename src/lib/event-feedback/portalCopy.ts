import { EventType } from "@prisma/client";

export function feedbackPortalTagline(): string {
  return "We'd love your feedback — it only takes a moment.";
}

export function feedbackPortalCredentialHint(eventType: EventType): string {
  switch (eventType) {
    case EventType.VIRTUAL:
      return "Use the same email or phone you registered or joined the stream with.";
    case EventType.IN_PERSON:
      return "Use the same email or phone you registered or checked in with.";
    case EventType.HYBRID:
    default:
      return "Use the same email or phone you registered, checked in, or joined virtually with.";
  }
}

export function feedbackPortalLookupNotFoundMessage(eventType: EventType): string {
  const attendance =
    eventType === EventType.VIRTUAL
      ? "a virtual join"
      : eventType === EventType.IN_PERSON
        ? "a check-in"
        : "a check-in or virtual join";

  return `We could not find ${attendance} for that email or phone. Use the same details you registered with, give feedback anonymously, or ask staff for help.`;
}
