/** Normalized delivery channel stored on log rows and shown in reports. */
export type StoredDeliveryChannel = "EMAIL" | "SMS";

/**
 * Resolves the actual channel for one delivery attempt.
 * Legacy rows used BOTH for guests with email+phone even when the attempt was only SMS or only email.
 */
export function resolveStoredDeliveryChannel(
  storedChannel: string,
  detail?: string | null
): StoredDeliveryChannel {
  if (storedChannel === "SMS" || storedChannel === "SMS_ONLY") return "SMS";
  if (storedChannel === "EMAIL") return "EMAIL";

  const d = (detail ?? "").toLowerCase().trim();
  if (d === "sms") return "SMS";
  if (
    d === "email" ||
    d.includes("staff check-in link") ||
    d.includes("subject:") ||
    d.includes("invitation email")
  ) {
    return "EMAIL";
  }

  return "EMAIL";
}
