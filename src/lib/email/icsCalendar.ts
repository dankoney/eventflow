/**
 * Minimal RFC 5545 .ics generator for the unified RSVP confirmation email.
 * Includes both the venue address and the Zoom join URL in the description so
 * Outlook / Google Calendar surface both options regardless of attendance mode.
 */

export type IcsEventInput = {
  uid: string;
  title: string;
  description?: string | null;
  /** Local-name / address text for the LOCATION property. */
  locationLine: string;
  /** ISO start time. */
  starts: Date;
  /** ISO end time (defaults to starts + 1 hour when omitted). */
  ends?: Date | null;
  /** Optional Zoom or virtual join URL appended to the description. */
  virtualJoinUrl?: string | null;
  /** Optional venue postal address used in description footer. */
  venueAddress?: string | null;
  organizer?: { name: string; email?: string | null } | null;
  attendee?: { name: string; email: string } | null;
};

export function buildIcsContent(input: IcsEventInput): string {
  const dtStart = formatIcsDate(input.starts);
  const dtEnd = formatIcsDate(input.ends ?? new Date(input.starts.getTime() + 60 * 60 * 1000));
  const stamp = formatIcsDate(new Date());

  const descriptionPieces: string[] = [];
  if (input.description?.trim()) descriptionPieces.push(input.description.trim());
  if (input.venueAddress?.trim()) descriptionPieces.push(`Venue: ${input.venueAddress.trim()}`);
  if (input.virtualJoinUrl?.trim()) descriptionPieces.push(`Virtual join: ${input.virtualJoinUrl.trim()}`);
  const description = escapeIcsText(descriptionPieces.join("\n\n"));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Eventflow//RSVP Confirmation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `LOCATION:${escapeIcsText(input.locationLine)}`,
    description ? `DESCRIPTION:${description}` : "",
    input.virtualJoinUrl ? `URL:${escapeIcsText(input.virtualJoinUrl)}` : "",
    input.organizer
      ? `ORGANIZER;CN=${escapeIcsText(input.organizer.name)}:mailto:${input.organizer.email ?? "noreply@eventflow.app"}`
      : "",
    input.attendee
      ? `ATTENDEE;CN=${escapeIcsText(input.attendee.name)};RSVP=TRUE:mailto:${input.attendee.email}`
      : "",
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return foldIcsLines(lines.filter(Boolean).join("\r\n")) + "\r\n";
}

export function buildIcsBase64(input: IcsEventInput): string {
  const ics = buildIcsContent(input);
  return Buffer.from(ics, "utf8").toString("base64");
}

function formatIcsDate(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF + space. */
function foldIcsLines(content: string): string {
  return content
    .split("\r\n")
    .map((line) => {
      if (line.length <= 73) return line;
      const chunks: string[] = [];
      let i = 0;
      chunks.push(line.slice(i, i + 73));
      i += 73;
      while (i < line.length) {
        chunks.push(" " + line.slice(i, i + 72));
        i += 72;
      }
      return chunks.join("\r\n");
    })
    .join("\r\n");
}
