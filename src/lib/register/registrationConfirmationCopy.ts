import { AttendMode } from "@prisma/client";

export type RegistrationConfirmationDelivery = {
  emailDelivered: boolean;
  smsDelivered: boolean;
  attendanceMode: AttendMode;
};

function attendanceDetail(attendanceMode: AttendMode): string {
  return attendanceMode === AttendMode.IN_PERSON
    ? "entry QR code and check-in details"
    : "virtual join link and event details";
}

/**
 * User-facing copy after public self-registration succeeds.
 * Accounts for email-only, SMS-only (no email on file), both, or neither.
 */
export function registrationConfirmationUserMessage(
  delivery: RegistrationConfirmationDelivery
): { tone: "success" | "warning"; message: string } {
  const detail = attendanceDetail(delivery.attendanceMode);
  const { emailDelivered, smsDelivered } = delivery;

  if (!emailDelivered && !smsDelivered) {
    return {
      tone: "warning",
      message: `Your registration was saved, but we could not send confirmation. Contact the event organizer if you need your ${detail}.`
    };
  }

  if (emailDelivered && smsDelivered) {
    return {
      tone: "success",
      message: `Check your email and phone for confirmation and your ${detail}.`
    };
  }

  if (smsDelivered) {
    return {
      tone: "success",
      message: `We sent a text to your phone with your ${detail}.`
    };
  }

  return {
    tone: "success",
    message: `Check your email for confirmation and your ${detail}.`
  };
}
