import { EventType, InternalStaffCheckInMode, InternalStaffNoticeKind } from "@prisma/client";

import type { InternalStaffAudience } from "@/lib/internalStaff/audience";

export type InternalStaffNoticeCopy = {
  subject: string;
  sessionNoun: string;
  sessionLabel: string;
  closingLine: string;
};

const NOTICE_LABELS: Record<
  InternalStaffNoticeKind,
  { sessionNoun: string; subjectPrefix: string; closing: string }
> = {
  TRAINING: {
    sessionNoun: "training session",
    subjectPrefix: "NOTICE OF TRAINING ON",
    closing: "All staff are entreated to take note of the programme and attend as scheduled."
  },
  SENSITIZATION: {
    sessionNoun: "sensitisation session",
    subjectPrefix: "NOTICE OF SENSITISATION ON",
    closing: "All staff are entreated to take note of the programme."
  },
  MEETING: {
    sessionNoun: "staff meeting",
    subjectPrefix: "NOTICE OF STAFF MEETING —",
    closing: "All staff are entreated to take note of the meeting."
  },
  BRIEFING: {
    sessionNoun: "staff briefing",
    subjectPrefix: "STAFF BRIEFING —",
    closing: "All staff are entreated to take note of this briefing."
  }
};

export function resolveInternalStaffNoticeTo(audience: InternalStaffAudience | null | undefined): string {
  if (!audience) return "ALL STAFF";
  switch (audience.mode) {
    case "ENTIRE_ORG":
      return "ALL STAFF";
    case "DEPARTMENTS":
      return audience.departments.length
        ? `STAFF — ${audience.departments.join(", ").toUpperCase()}`
        : "ALL STAFF";
    case "RANKS":
      return audience.ranks.length ? `STAFF — ${audience.ranks.join(", ").toUpperCase()}` : "ALL STAFF";
    case "EMPLOYMENT_STATUS":
      return `STAFF — ${audience.employmentStatuses.join(", ").replace(/_/g, " ").toUpperCase()}`;
    case "CRM_KINDS":
      return "SELECTED STAFF";
    case "GROUPS":
      return "SELECTED STAFF GROUPS";
    case "MANUAL":
      return "SELECTED STAFF";
    default:
      return "ALL STAFF";
  }
}

/** Memo TO line: custom override when set, otherwise derived from audience rules. */
export function resolveMemoToForEvent(
  customTo: string | null | undefined,
  audience: InternalStaffAudience | null | undefined
): string {
  const trimmed = customTo?.trim();
  if (trimmed) return trimmed;
  return resolveInternalStaffNoticeTo(audience);
}

export function buildInternalStaffNoticeCopy(params: {
  noticeKind: InternalStaffNoticeKind;
  eventName: string;
}): InternalStaffNoticeCopy {
  const cfg = NOTICE_LABELS[params.noticeKind];
  const topic = params.eventName.trim().toUpperCase();
  const subject = `${cfg.subjectPrefix} ${topic}`;

  return {
    subject,
    sessionNoun: cfg.sessionNoun,
    sessionLabel: cfg.sessionNoun.charAt(0).toUpperCase() + cfg.sessionNoun.slice(1),
    closingLine: cfg.closing
  };
}

/** Memo subject: custom override when set, otherwise derived from notice kind + event name. */
export function resolveInternalStaffNoticeSubject(params: {
  noticeKind: InternalStaffNoticeKind;
  eventName: string;
  customSubject?: string | null;
}): string {
  const trimmed = params.customSubject?.trim();
  if (trimmed) return trimmed;
  return buildInternalStaffNoticeCopy({
    noticeKind: params.noticeKind,
    eventName: params.eventName
  }).subject;
}

export function formatMemoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d);
}

export function formatMemoDateTime(d: Date): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
    .format(d)
    .toLowerCase()
    .replace(/\s/g, "");
  return `${date} at ${time}`;
}

const MEETING_ROOM_BEGIN = "[MEETING_ROOM]";
const MEETING_ROOM_END = "[/MEETING_ROOM]";
const MEETING_ROOM_REGEX = new RegExp(
  `${MEETING_ROOM_BEGIN}\\s*([\\s\\S]*?)\\s*${MEETING_ROOM_END}`,
  "m"
);

/** Legacy: strips embedded [MEETING_ROOM] markers from notice context (pre-dedicated-column saves). */
export function stripLegacyMeetingRoomMarkers(raw: string | null | undefined): string {
  const input = raw ?? "";
  if (!input.includes(MEETING_ROOM_BEGIN)) return input.trim();
  return input.replace(MEETING_ROOM_REGEX, "").trim();
}

/** @deprecated Use internalStaffMeetingRoom column. Legacy extraction for old embedded saves. */
export function extractMeetingRoomFromNoticeContext(raw: string | null | undefined): {
  noticeContext: string;
  meetingRoom: string;
} {
  const input = raw ?? "";
  const match = input.match(MEETING_ROOM_REGEX);
  const meetingRoom = match?.[1]?.trim() || "";
  const cleaned = stripLegacyMeetingRoomMarkers(input);
  return { noticeContext: cleaned, meetingRoom };
}

/** Returns context paragraph safe for email display (legacy markers stripped). */
export function cleanNoticeContextForDisplay(raw: string | null | undefined): string | null {
  const cleaned = stripLegacyMeetingRoomMarkers(raw);
  return cleaned || null;
}

/** Resolves meeting room from dedicated column, with legacy fallback from embedded context. */
export function resolveInternalStaffMeetingRoom(params: {
  meetingRoom?: string | null;
  noticeContext?: string | null;
}): string | null {
  const fromColumn = params.meetingRoom?.trim();
  if (fromColumn) return fromColumn;
  const legacy = extractMeetingRoomFromNoticeContext(params.noticeContext).meetingRoom.trim();
  return legacy || null;
}

export function resolvePlatformLine(params: {
  eventType: EventType;
  zoomJoinUrl?: string | null;
  locationLabel: string;
  noticeKind?: InternalStaffNoticeKind;
  locationName?: string | null;
  locationAddress?: string | null;
  meetingRoom?: string | null;
}): string {
  void params.zoomJoinUrl;
  void params.noticeKind;
  void params.locationName;
  void params.locationAddress;

  if (params.eventType === EventType.VIRTUAL) {
    return "Venue: Virtual";
  }

  const meetingRoom = params.meetingRoom?.trim() || null;
  const locationLabel = params.locationLabel?.trim();
  const hasLocation = Boolean(locationLabel && locationLabel !== "Venue TBD");

  if (hasLocation) {
    if (meetingRoom) return `Venue: ${meetingRoom}, ${locationLabel}`;
    return `Venue: ${locationLabel}`;
  }

  if (meetingRoom) return `Venue: ${meetingRoom}`;
  return "Venue details will be communicated before the session.";
}

/** Check-in instruction paragraph for staff notice emails (empty for in-person). */
export function resolveStaffNoticeCheckInInstruction(params: {
  eventType: EventType;
  checkInMode: InternalStaffCheckInMode;
  hasPersonalLink: boolean;
}): string {
  if (params.eventType === EventType.IN_PERSON) return "";

  if (params.eventType === EventType.HYBRID) {
    if (params.hasPersonalLink) {
      return "Staff attending in person should check in at the venue on the day. Staff connecting online should use their personal check-in link below on the day of the session. This link is assigned to you only.";
    }
    if (params.checkInMode === InternalStaffCheckInMode.PERSONAL_LINK) {
      return "Staff attending in person should check in at the venue on the day. Staff connecting online will receive a personal check-in link before the session.";
    }
    return "Staff attending in person should check in at the venue on the day. Staff connecting online should check in using their staff ID or work email on the staff check-in page.";
  }

  if (params.hasPersonalLink) {
    return "Use your personal check-in link below on the day of the session. This link is assigned to you only.";
  }

  if (params.checkInMode === InternalStaffCheckInMode.PERSONAL_LINK) {
    return "A personal check-in link will be issued to you before the session.";
  }

  return "On the day of the session, check in using your work email on the staff check-in page.";
}

/** Personal check-in URL for hybrid/virtual; none for in-person only. */
export function resolveStaffNoticeActionUrl(params: {
  eventType: EventType;
  eventId: string;
  personalCheckInUrl: string | null;
  sharedCheckInUrl: string | null;
}): string | null {
  if (params.eventType === EventType.IN_PERSON) return null;
  return params.personalCheckInUrl ?? params.sharedCheckInUrl;
}

export function resolveStaffNoticeActionLabel(params: {
  eventType: EventType;
  hasActionUrl: boolean;
}): string | null {
  if (!params.hasActionUrl) return null;
  if (params.eventType === EventType.HYBRID) {
    return "Your online check-in link";
  }
  return "Your personal Zoom link";
}

export function defaultInternalStaffNoticeFrom(orgName: string): string {
  const name = orgName.trim();
  return name ? `HEAD, ${name.toUpperCase()}` : "HUMAN RESOURCES & ADMINISTRATION";
}
