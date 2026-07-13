import { EventBlueprintTemplate } from "@prisma/client";

type AttendOptions = {
  allowsInPerson: boolean;
  allowsVirtual: boolean;
  /** Conference blueprint + accommodation is offered (in-person path). */
  offersAccommodation: boolean;
};

type HeroInput = {
  blueprint: EventBlueprintTemplate;
  firstName: string;
  /** True when this guest has previously confirmed (returning to update). */
  alreadyConfirmed: boolean;
  /** Event status is LIVE — accept doubles as instant check-in for in-person attendees. */
  eventIsLive: boolean;
} & AttendOptions;

type Hero = {
  title: string;
  subtitle: string;
};

function joinModePhrase(opts: AttendOptions): string | null {
  if (opts.allowsInPerson && opts.allowsVirtual) {
    return "how you'll join (in person or online)";
  }
  if (opts.allowsInPerson) return null;
  if (opts.allowsVirtual) return null;
  return null;
}

function updateDetailsList(opts: AttendOptions): string {
  const parts = ["your details"];
  if (opts.allowsInPerson && opts.allowsVirtual) {
    parts.push("how you'll join");
  }
  if (opts.offersAccommodation) {
    parts.push("accommodation");
  }
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} or ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, or ${parts[parts.length - 1]}`;
}

/**
 * Blueprint- and mode-aware hero copy for the RSVP magic-link page.
 * Avoids mentioning in-person / virtual / accommodation when those options
 * are not actually available (cognitive load + trust).
 */
export function rsvpPageHero(input: HeroInput): Hero {
  const name = input.firstName?.trim() || "there";
  const hybrid = input.allowsInPerson && input.allowsVirtual;

  if (input.eventIsLive) {
    if (input.allowsInPerson && input.allowsVirtual) {
      return {
        title: `Doors are open, ${name}.`,
        subtitle:
          "Confirm in person below and we'll check you in now. Joining online? Choose virtual and we'll show your Zoom link next."
      };
    }
    if (input.allowsVirtual && !input.allowsInPerson) {
      return {
        title: `We're live, ${name}.`,
        subtitle: "Confirm below to lock in your virtual seat and get your join link."
      };
    }
    return {
      title: `Doors are open, ${name}.`,
      subtitle: "Confirm below and we'll check you in for this session right away."
    };
  }

  if (input.alreadyConfirmed) {
    return {
      title: `You're confirmed, ${name}.`,
      subtitle: `Need a change? Update ${updateDetailsList(input)} below. We'll only re-send your confirmation if something changes.`
    };
  }

  switch (input.blueprint) {
    case EventBlueprintTemplate.CONFERENCE: {
      const modeBit = hybrid
        ? "Tell us how you'll join — in the room or online"
        : input.allowsVirtual
          ? "Confirm your details for the online session"
          : "Confirm your details for the program";
      const lodgingBit = input.offersAccommodation
        ? ", and share accommodation needs if you have them"
        : "";
      return {
        title: `You're invited, ${name}.`,
        subtitle: `${modeBit}${lodgingBit}. We'll lock in your spot right after.`
      };
    }
    case EventBlueprintTemplate.INTERNAL_STAFF:
      return {
        title: `Confirm your registration, ${name}.`,
        subtitle: hybrid
          ? "Confirm your details and how you'll join so we can mark you as attending. Check-in still happens at the session with your QR or personal link."
          : "Confirm your details so we can mark you as attending. Check-in still happens at the session with your QR or personal link."
      };
    case EventBlueprintTemplate.TRAINING_WORKSHOP:
      return {
        title: `Workshop seat for ${name} — almost there.`,
        subtitle: hybrid
          ? "Confirm your details and how you'll join. We'll send materials, your Zoom link if needed, and your check-in QR once you're set."
          : input.allowsVirtual
            ? "Confirm your details. We'll send materials, your Zoom link, and your check-in QR once you're set."
            : "Confirm your details. We'll send materials and your check-in QR once you're set."
      };
    case EventBlueprintTemplate.BLANK:
    default: {
      const modeBit = joinModePhrase(input);
      return {
        title: `Confirm your spot, ${name}.`,
        subtitle: modeBit
          ? `Double-check your details and pick ${modeBit}. We'll email a confirmation with what you need for the day.`
          : "Double-check your details below. We'll email a confirmation with what you need for the day."
      };
    }
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
        : "Your check-in is recorded, but we couldn't send the attendance receipt right now. Ask the event organizer to resend it if you need another copy."
    };
  }

  switch (input.blueprint) {
    case EventBlueprintTemplate.INTERNAL_STAFF:
      return {
        title: "You're confirmed.",
        body: input.emailDelivered
          ? "We emailed you a staff confirmation with your check-in QR and a calendar invite. Bring the QR (or use your personal link) at the session."
          : "Your registration is saved. We couldn't email the confirmation right now — ask the event organizer to resend it."
      };
    case EventBlueprintTemplate.CONFERENCE:
      return {
        title: "You're in.",
        body: input.emailDelivered
          ? "We just sent your program pass — QR badge, Zoom backup if needed, calendar invite, and directions if applicable."
          : "Your seat is locked in. We couldn't send the program pass email right now — ask the event organizer to resend it."
      };
    case EventBlueprintTemplate.TRAINING_WORKSHOP:
      return {
        title: "Workshop confirmed.",
        body: input.emailDelivered
          ? "We emailed your workshop confirmation with check-in QR, Zoom link if needed, and a calendar invite."
          : "Your seat is saved. We couldn't send the workshop confirmation right now — ask the event organizer to resend it."
      };
    case EventBlueprintTemplate.BLANK:
    default:
      return {
        title: "You're confirmed.",
        body: input.emailDelivered
          ? "We just emailed your confirmation with everything you need for the day. Save it for easy access."
          : "Your RSVP is saved, but we couldn't send the confirmation email right now. Ask the event organizer to resend it."
      };
  }
}
