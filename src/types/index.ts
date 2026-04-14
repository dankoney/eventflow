export type Role = "ADMIN" | "MARKETING" | "SALES_REP";
export type Tier = "A" | "B" | "C";
export type AttendMode = "IN_PERSON" | "VIRTUAL";
export type EventType = "IN_PERSON" | "VIRTUAL" | "HYBRID";
export type EventStatus = "DRAFT" | "PUBLISHED" | "LIVE" | "COMPLETED" | "CANCELLED";
export type GuestStatus = "INVITED" | "REGISTERED" | "CHECKED_IN" | "JOINED" | "NO_SHOW";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  role: Role;
  orgId: string;
  createdAt: Date;
}

export interface Event {
  id: string;
  name: string;
  description: string | null;
  date: Date;
  endDate: Date | null;
  location: string;
  capacity: number;
  virtualCapacity: number;
  type: EventType;
  status: EventStatus;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  zoomPasscode: string | null;
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  tier: Tier;
  mode: AttendMode;
  status: GuestStatus;
  qrCode: string | null;
  zoomLink: string | null;
  dietary: string | null;
  repId: string | null;
  eventId: string;
  createdAt: Date;
}

export interface CheckIn {
  id: string;
  guestId: string;
  method: string;
  checkedInAt: Date;
}

export type ActionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
