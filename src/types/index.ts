import type { Role } from "@prisma/client";

export type { Role };
export type Tier = "A" | "B" | "C";
export type AttendMode = "IN_PERSON" | "VIRTUAL";
export type EventType = "IN_PERSON" | "VIRTUAL" | "HYBRID";
export type EventStatus = "DRAFT" | "PUBLISHED" | "LIVE" | "COMPLETED" | "CANCELLED";
export type GuestStatus =
  | "INVITED"
  | "REGISTERED"
  | "ACCEPTED"
  | "CHECKED_IN"
  | "JOINED"
  | "NO_SHOW"
  | "DECLINED";

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

export type EventScheduleMode = "SINGLE_BLOCK" | "MULTI_DAY";

export interface Event {
  id: string;
  name: string;
  description: string | null;
  date: Date;
  endDate: Date;
  scheduleMode?: EventScheduleMode;
  multiDayConfig?: unknown;
  locationId: string;
  capacity: number;
  virtualCapacity: number;
  type: EventType;
  status: EventStatus;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  zoomStartUrl?: string | null;
  zoomPasscode: string | null;
  zoomSessionKind: "WEBINAR" | "MEETING";
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type GuestJoinSource = "REGISTERED" | "EXTERNAL_JOIN" | "WALK_IN";

export interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  tier: Tier;
  /** Null for hybrid until the guest checks in onsite or joins virtually. */
  mode: AttendMode | null;
  status: GuestStatus;
  joinSource: GuestJoinSource;
  qrCode: string | null;
  zoomLink: string | null;
  dietary: string | null;
  country: string | null;
  accessibilityNotes: string | null;
  referralSource: string | null;
  staffEmployeeId: string | null;
  department: string | null;
  repId: string | null;
  eventId: string;
  createdAt: Date;
  /** Organizer invitation email delivery timestamp (null while draft / pending). */
  invitationEmailSentAt?: Date | null;
  /** Smart-invitation decline capture (Phase E). */
  declineReason?: string | null;
  declineNote?: string | null;
  declinedAt?: Date | null;
  /** When set, suppress all reminder dispatch for this guest. */
  notificationsSuppressedAt?: Date | null;
}

/** Guest returned from create flows that send confirmation email */
export type GuestWithEmailStatus = Guest & {
  emailDelivered: boolean;
  smsDelivered: boolean;
  /** Organizer-added guest on a draft event: invitation is queued until publish. */
  invitationPendingUntilPublish?: boolean;
  /**
   * Set by `publicRegisterGuest` when the registered event has an active or
   * upcoming ballot. Lets the success card render a "you qualify to vote"
   * panel + the How-to-vote popup without a second round-trip.
   */
  poll?: {
    title: string;
    instructions: string | null;
    startTimeLabel: string;
    endTimeLabel: string;
    ballotUrl: string;
    inWindow: boolean;
    upcoming: boolean;
    isAttributed: boolean;
  };
};

export interface CheckIn {
  id: string;
  guestId: string;
  dayIndex: number;
  method: string;
  checkedInAt: Date;
}

export type ActionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
