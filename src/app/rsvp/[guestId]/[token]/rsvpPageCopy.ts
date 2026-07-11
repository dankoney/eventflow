import { EventBlueprintTemplate } from "@prisma/client";

type HeroInput = {
  blueprint: EventBlueprintTemplate;
  firstName: string;
  /** True when this guest has previously confirmed (updating an RSVP). */
  alreadyConfirmed: boolean;
  /** Event status is LIVE — accept doubles as instant check-in for in-person attendees. */
  eventIsLive: boolean;
};

type Hero = {
  title: string;
  subtitle: string;
};

/**
 * Blueprint-aware hero copy for the RSVP magic-link page. Pairs with the email tones
 * in {@link import("@/lib/email").UnifiedRsvpConfirmationTone} so the page voice and
 * the confirmation email feel like one conversation.
 */
export function rsvpPageHero(input: HeroInput): Hero {
  const name = input.firstName?.trim() || "there";

  if (input.eventIsLive) {
    return {
      title: `Doors are open, ${name}.`,
      subtitle:
        "We're already running — confirm in person below and we'll check you in right now. Joining online? Pick virtual and grab the Zoom link on the next screen."
    };
  }

  if (input.alreadyConfirmed) {
    return {
      title: `You're already on the list, ${name}.`,
      subtitle:
        "Make any updates to your details, mode (in person vs virtual), or accommodation below. We'll re-send your confirmation only if something changes."
    };
  }

  switch (input.blueprint) {
    case EventBlueprintTemplate.CONFERENCE:
      return {
        title: `You're on the program, ${name}.`,
        subtitle:
          "Tell us how you'll join — in the room or streaming — and (if you need it) your accommodation preferences. We'll lock in your seat right after."
      };
    case EventBlueprintTemplate.INTERNAL_STAFF:
      return {
        title: `Quick roster check, ${name}.`,
        subtitle:
          "This program is for the team. Confirm your details so we can mark you on the roster — check-in still happens at the session itself, with your QR or personal link."
      };
    case EventBlueprintTemplate.TRAINING_WORKSHOP:
      return {
        title: `Workshop seat for ${name} — almost there.`,
        subtitle:
          "Confirm your details and how you'll join. We'll send materials, the Zoom link, and your check-in QR once you're set."
      };
    case EventBlueprintTemplate.BLANK:
    default:
      return {
        title: `Confirm your RSVP, ${name}.`,
        subtitle:
          "Pick how you'll join and double-check your details. We'll email a confirmation with your QR badge, the Zoom link, and a calendar invite."
      };
  }
}

type SuccessInput = {
  blueprint: EventBlueprintTemplate;
  /** Confirm produced a real-time check-in (LIVE + in-person). */
  checkedInNow: boolean;
  /** Confirmation email was sent successfully. */
  emailDelivered: boolean;
};

type Success = {
  title: string;
  body: string;
};

/** Post-confirm success message shown on the RSVP page itself; mirrors the email tone. */
export function rsvpAcceptSuccessCopy(input: SuccessInput): Success {
  if (input.checkedInNow) {
    return {
      title: "You're checked in.",
      body: input.emailDelivered
        ? "We just emailed your attendance badge with the check-in QR. Keep it handy — staff may scan it again during the event."
        : "Your check-in is recorded, but we couldn't send the attendance receipt right now. Your organizer can resend it from the dashboard."
    };
  }

  switch (input.blueprint) {
    case EventBlueprintTemplate.INTERNAL_STAFF:
      return {
        title: "You're on the roster.",
        body: input.emailDelivered
          ? "We emailed you a staff confirmation with your check-in QR and a calendar invite. Bring the QR (or use your personal link) at the session."
          : "Your registration is saved on the roster. We couldn't email the confirmation right now — your organizer can resend it from the dashboard."
      };
    case EventBlueprintTemplate.CONFERENCE:
      return {
        title: "You're in.",
        body: input.emailDelivered
          ? "We just sent your program pass — QR badge, Zoom backup, calendar invite, and directions if applicable."
          : "Your seat is locked in. We couldn't send the program pass email right now — your organizer can resend it from the dashboard."
      };
    case EventBlueprintTemplate.TRAINING_WORKSHOP:
      return {
        title: "Workshop confirmed.",
        body: input.emailDelivered
          ? "We emailed your workshop confirmation with check-in QR, Zoom link, and a calendar invite."
          : "Your seat is saved. We couldn't send the workshop confirmation right now — your organizer can resend it from the dashboard."
      };
    case EventBlueprintTemplate.BLANK:
    default:
      return {
        title: "You're confirmed.",
        body: input.emailDelivered
          ? "We just emailed your confirmation with a check-in QR, the Zoom link, and a calendar invite. Save them for the day."
          : "Your RSVP is saved, but we couldn't send the confirmation email right now. Your organizer can resend it from the dashboard."
      };
  }
}
