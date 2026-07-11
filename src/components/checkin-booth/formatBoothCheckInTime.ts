/** Format check-in timestamp for kiosk displays (event local time). */
export function formatBoothCheckInTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export type BoothCheckInChannel = "email" | "phone" | "qr" | "walkin";

export function alreadySignedInChannelMessage(channel: BoothCheckInChannel): string {
  switch (channel) {
    case "email":
      return "This email address is already signed in for this session.";
    case "phone":
      return "This mobile number is already signed in for this session.";
    case "qr":
      return "This QR code is already signed in for this session.";
    default:
      return "This registration is already signed in for this session.";
  }
}
