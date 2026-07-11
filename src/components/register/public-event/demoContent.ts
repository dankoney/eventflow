/** Placeholder content for the public attendee site — real data can replace these via dashboard fields later. */

export type DemoSpeaker = {
  name: string;
  title: string;
  company: string;
  bio: string;
  /** Optional photo URL when organizers add headshots. */
  imageUrl?: string | null;
};

export const DEMO_KEYNOTE_SPEAKER: DemoSpeaker = {
  name: "Dr. Amara Mensah",
  title: "Opening keynote",
  company: "North Ridge Financial",
  bio: "Leads enterprise transformation and partner ecosystems across West Africa. Former McKinsey engagement manager; guest lecturer at Ashesi.",
  imageUrl: null
};

export const DEMO_PANEL_SPEAKERS: DemoSpeaker[] = [
  {
    name: "James Okonkwo",
    title: "VP, Field Operations",
    company: "Eventflow partner org",
    bio: "Operational excellence for large-scale hybrid programs and onsite logistics.",
    imageUrl: null
  },
  {
    name: "Priya Natarajan",
    title: "Head of Digital Experience",
    company: "Summit Labs",
    bio: "Design systems, accessibility, and attendee journeys for B2B conferences.",
    imageUrl: null
  }
];

export const DEMO_AGENDA_ROWS: { time: string; title: string; detail: string }[] = [
  { time: "08:30", title: "Registration & networking breakfast", detail: "Main foyer" },
  { time: "09:30", title: "Welcome & opening remarks", detail: "Hall A" },
  { time: "10:15", title: "Keynote session", detail: "Hall A · livestream for virtual attendees" },
  { time: "11:30", title: "Breakout tracks", detail: "Rooms B1–B4" },
  { time: "13:00", title: "Hosted lunch & partner pavilion", detail: "Exhibition hall" },
  { time: "15:00", title: "Panel: future of work", detail: "Hall A" },
  { time: "17:00", title: "Closing & acknowledgements", detail: "Hall A" }
];

export const DEMO_RESOURCES: { title: string; kind: string; meta: string; hint: string }[] = [
  {
    title: "Attendee handbook",
    kind: "PDF",
    meta: "12 pages · sample layout",
    hint: "Organizers will attach final PDFs from the Eventflow dashboard when available."
  },
  {
    title: "Speaker bios & headshots",
    kind: "ZIP",
    meta: "Press kit · sample",
    hint: "Media packs and sponsor logos can live here."
  },
  {
    title: "Add to calendar",
    kind: "ICS",
    meta: "Google, Outlook, Apple",
    hint: "One-click calendar file — wire-up from event dates when enabled."
  },
  {
    title: "Code of conduct & accessibility",
    kind: "Link",
    meta: "In-app policy",
    hint: "Deep link to your org’s trust & safety page."
  }
];

export const DEMO_WIFI = {
  ssid: "Summit-Guest",
  password: "Ridge2026!",
  note: "Example only — your organizer can publish venue Wi‑Fi here when the field is added in Eventflow."
};
