/** Machine-readable delivery failure / skip codes for reporting & cleanup workflows. */
export const DELIVERY_ERROR_CODES = {
  INVALID_EMAIL: "INVALID_EMAIL",
  INVALID_PHONE: "INVALID_PHONE",
  NO_EMAIL: "NO_EMAIL",
  NO_PHONE: "NO_PHONE",
  NO_CONTACT_CHANNEL: "NO_CONTACT_CHANNEL",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  PROVIDER_DISABLED: "PROVIDER_DISABLED",
  SUPPRESSED: "SUPPRESSED",
  TEMPLATE_TOO_LONG: "TEMPLATE_TOO_LONG",
  DECLINED_GUEST: "DECLINED_GUEST",
  UNKNOWN: "UNKNOWN"
} as const;

export type DeliveryErrorCode = (typeof DELIVERY_ERROR_CODES)[keyof typeof DELIVERY_ERROR_CODES];

export function classifyDeliveryError(
  detail: string | null | undefined,
  channel: "EMAIL" | "SMS"
): DeliveryErrorCode | null {
  const d = (detail ?? "").toLowerCase();
  if (!d) return null;

  if (d.includes("invalid email") || d.includes("valid email")) return DELIVERY_ERROR_CODES.INVALID_EMAIL;
  if (d.includes("no email") || d.includes("email on file")) return DELIVERY_ERROR_CODES.NO_EMAIL;
  if (d.includes("invalid phone") || d.includes("valid mobile") || d.includes("e.164")) {
    return DELIVERY_ERROR_CODES.INVALID_PHONE;
  }
  if (d.includes("no valid mobile") || d.includes("no phone")) return DELIVERY_ERROR_CODES.NO_PHONE;
  if (d.includes("no contact") || d.includes("unreachable")) return DELIVERY_ERROR_CODES.NO_CONTACT_CHANNEL;
  if (d.includes("mnotify") && d.includes("not enabled")) return DELIVERY_ERROR_CODES.PROVIDER_DISABLED;
  if (d.includes("declined")) return DELIVERY_ERROR_CODES.DECLINED_GUEST;
  if (d.includes("max") && d.includes("character")) return DELIVERY_ERROR_CODES.TEMPLATE_TOO_LONG;
  if (d.includes("suppressed")) return DELIVERY_ERROR_CODES.SUPPRESSED;

  if (
    d.includes("resend") ||
    d.includes("smtp") ||
    d.includes("provider") ||
    d.includes("sms could not") ||
    d.includes("failed")
  ) {
    return DELIVERY_ERROR_CODES.PROVIDER_ERROR;
  }

  return channel === "EMAIL" ? DELIVERY_ERROR_CODES.PROVIDER_ERROR : DELIVERY_ERROR_CODES.UNKNOWN;
}

export const DELIVERY_ERROR_LABELS: Record<DeliveryErrorCode, string> = {
  INVALID_EMAIL: "Invalid email address",
  INVALID_PHONE: "Invalid phone number",
  NO_EMAIL: "No email on file",
  NO_PHONE: "No phone on file",
  NO_CONTACT_CHANNEL: "No reachable channel",
  PROVIDER_ERROR: "Provider send failed",
  PROVIDER_DISABLED: "SMS not configured",
  SUPPRESSED: "Notifications suppressed",
  TEMPLATE_TOO_LONG: "Message too long",
  DECLINED_GUEST: "Guest declined",
  UNKNOWN: "Unknown error"
};

export const NOTIFICATION_KIND_LABELS: Record<string, string> = {
  invite: "Invitation",
  invite_resend: "Invitation resend",
  registration_confirm: "Registration confirmation",
  feedback_request: "Feedback request",
  checkin_confirm: "Check-in confirmation",
  rsvp_confirm: "RSVP confirmation",
  reminder: "Reminder",
  reminder_primary: "Primary reminder",
  reminder_final: "Final reminder",
  cancellation: "Cancellation notice",
  custom_message: "Custom message"
};

export function notificationKindLabel(kind: string): string {
  return NOTIFICATION_KIND_LABELS[kind] ?? kind.replace(/_/g, " ");
}
