/** Deep links and ICS payload for public event pages (add to calendar). */
export function buildPublicEventCalendarLinks(summary: {
  name: string;
  date: string;
  endDate: string;
  locationLine: string;
  description: string | null;
}) {
  const eventStart = new Date(summary.date);
  const eventEnd = new Date(summary.endDate);
  const title = encodeURIComponent(summary.name);
  const location = encodeURIComponent(summary.locationLine);
  const details = encodeURIComponent(summary.description ?? "");
  const isoStart = eventStart.toISOString();
  const isoEnd = eventEnd.toISOString();
  const isoCompactStart = isoStart.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const isoCompactEnd = isoEnd.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${isoCompactStart}/${isoCompactEnd}&location=${location}&details=${details}`;

  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&subject=${title}&startdt=${encodeURIComponent(isoStart)}&enddt=${encodeURIComponent(isoEnd)}&location=${location}&body=${details}`;

  const outlook365 = `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&subject=${title}&startdt=${encodeURIComponent(isoStart)}&enddt=${encodeURIComponent(isoEnd)}&location=${location}&body=${details}`;

  const yahoo = `https://calendar.yahoo.com/?v=60&TITLE=${title}&ST=${isoCompactStart}&ET=${isoCompactEnd}&DESC=${details}&in_loc=${location}`;

  const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Eventflow//Public Event//EN
BEGIN:VEVENT
UID:${encodeURIComponent(summary.name)}-${isoCompactStart}
DTSTAMP:${isoCompactStart}
DTSTART:${isoCompactStart}
DTEND:${isoCompactEnd}
SUMMARY:${summary.name.replace(/\n/g, " ")}
LOCATION:${summary.locationLine.replace(/\n/g, " ")}
DESCRIPTION:${(summary.description ?? "").replace(/\n/g, " ")}
END:VEVENT
END:VCALENDAR`;
  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsData)}`;

  return { google, outlook, outlook365, yahoo, icsHref, icsFilename: `${summary.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics` };
}
