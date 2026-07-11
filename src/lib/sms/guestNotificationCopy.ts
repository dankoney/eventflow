import { AttendMode } from "@prisma/client";
import { formatDate } from "@/lib/utils";

const SMS_MAX = 300;

export type GuestSmsInviteContext = {
  eventName: string;
  eventDate: Date;
  hasEmail: boolean;
  /** RSVP accept URL for phone-only guests. */
  rsvpUrl?: string | null;
  /** Join hub / portal URL for registered guests without email. */
  portalUrl?: string | null;
  /** Per-guest tracked Zoom join URL (virtual attendance). */
  virtualJoinUrl?: string | null;
  attendanceMode?: AttendMode | null;
  pollSuffix?: string;
};

function clip(body: string): string {
  return body.slice(0, SMS_MAX);
}

/** Organizer invite companion SMS. */
export function renderGuestInviteSms(ctx: GuestSmsInviteContext): string {
  const dateLabel = formatDate(ctx.eventDate);
  if (ctx.hasEmail) {
    return clip(`You're invited to ${ctx.eventName} on ${dateLabel}. Check your email to accept.`);
  }
  const link = ctx.rsvpUrl?.trim();
  if (link) {
    return clip(`You're invited to ${ctx.eventName} on ${dateLabel}. Accept here: ${link}`);
  }
  return clip(`You're invited to ${ctx.eventName} on ${dateLabel}.`);
}

/** Public / organizer registration confirmation SMS. */
export function renderGuestRegistrationConfirmSms(ctx: GuestSmsInviteContext): string {
  const dateLabel = formatDate(ctx.eventDate);
  const poll = ctx.pollSuffix ?? "";
  if (ctx.hasEmail) {
    return clip(
      `Registration confirmed: ${ctx.eventName} on ${dateLabel}. Check your email for full event details.${poll}`
    );
  }
  const inPerson = ctx.attendanceMode === AttendMode.IN_PERSON;
  const virtual = ctx.attendanceMode === AttendMode.VIRTUAL;
  const link =
    (virtual ? ctx.virtualJoinUrl?.trim() : null) ||
    ctx.portalUrl?.trim() ||
    ctx.rsvpUrl?.trim();
  if (link) {
  if (inPerson) {
      return clip(`Confirmed: ${ctx.eventName} · ${dateLabel}. Your pass: ${link}${poll}`);
    }
    if (virtual) {
      return clip(`Confirmed: ${ctx.eventName} · ${dateLabel}. Join: ${link}${poll}`);
    }
    return clip(`Confirmed: ${ctx.eventName} · ${dateLabel}. Details: ${link}${poll}`);
  }
  return clip(`Registration confirmed: ${ctx.eventName} on ${dateLabel}.${poll}`);
}

/** Manual SMS resend reminder. */
export function renderGuestReminderSms(ctx: GuestSmsInviteContext): string {
  const dateLabel = formatDate(ctx.eventDate);
  if (ctx.hasEmail) {
    return clip(
      `Reminder: ${ctx.eventName} on ${dateLabel}. Check your email for QR, venue, and join details.`
    );
  }
  const link = ctx.portalUrl?.trim() || ctx.rsvpUrl?.trim();
  if (link) {
    return clip(`Reminder: ${ctx.eventName} on ${dateLabel}. Event details: ${link}`);
  }
  return clip(`Reminder: ${ctx.eventName} on ${dateLabel}.`);
}

/** Event reminder SMS (cron / manual). */
export function renderEventReminderSms(opts: {
  eventName: string;
  whenLabel: string;
  hasEmail: boolean;
  joinUrl?: string | null;
  isFinal?: boolean;
}): string {
  if (opts.isFinal) {
    if (opts.hasEmail) {
      return clip(`Final reminder: ${opts.eventName} at ${opts.whenLabel}. Your QR was emailed.`);
    }
    const link = opts.joinUrl?.trim();
    if (link) {
      return clip(`Final reminder: ${opts.eventName} at ${opts.whenLabel}. Join: ${link}`);
    }
    return clip(`Final reminder: ${opts.eventName} at ${opts.whenLabel}.`);
  }
  if (!opts.hasEmail) {
    const link = opts.joinUrl?.trim();
    if (link) {
      return clip(`Reminder: ${opts.eventName} at ${opts.whenLabel}. Details: ${link}`);
    }
  }
  return clip(`Reminder: ${opts.eventName} at ${opts.whenLabel}.`);
}
