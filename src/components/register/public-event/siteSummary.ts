import type { EventType } from "@prisma/client";

/** Shared between public register shell layouts. */
export type PublicEventSiteSummary = {
  name: string;
  description: string | null;
  date: string;
  endDate: string;
  periodLabel: string;
  type: EventType;
  capacity: number;
  virtualCapacity: number;
  bannerImageUrl: string | null;
  headerLogo: string | null;
  orgName: string;
  locationLine: string;
  location: {
    name: string;
    address: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    facilityImageUrl: string | null;
  };
  programDays: Array<{ dayIndex: number; label: string }>;
  statusMessage: string;
  registerTabLabel: string;
  /** Event id for public actions (enquiry, etc.). */
  eventId: string;
  /** Human-readable seats still open (optional, for marketing footer). */
  remainingSeatsSummary?: string | null;
};
