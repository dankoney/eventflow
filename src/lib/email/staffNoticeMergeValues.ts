import type { InternalStaffNoticeKind } from "@prisma/client";

import { resolveEmailAssetUrl } from "@/lib/email/assetUrl";
import {
  formatMemoDate,
  formatMemoDateTime,
  resolveInternalStaffNoticeSubject
} from "@/lib/internalStaff/noticeCopy";
import { formatDate } from "@/lib/utils";

export type StaffNoticeMergeGuestContext = {
  name: string;
  email: string | null;
};

export type StaffNoticeMergeEventContext = {
  name: string;
  date: Date;
  noticeKind: InternalStaffNoticeKind;
  noticeSubject?: string | null;
};

export type StaffNoticeMergeMemoContext = {
  memoTo: string;
  memoFrom: string;
  memoCc?: string | null;
  memoDate: Date;
  meetingRoom?: string | null;
  venueLine: string;
};

function formatEventTime(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
    .format(d)
    .toLowerCase()
    .replace(/\s/g, "");
}

function firstName(fullName: string): string {
  const token = fullName.trim().split(/\s+/)[0];
  return token || "Colleague";
}

export function resolveStaffNoticeMergeValues(params: {
  guest: StaffNoticeMergeGuestContext;
  event: StaffNoticeMergeEventContext;
  orgName: string;
  orgLogoUrl?: string | null;
  checkInLink?: string | null;
  memo: StaffNoticeMergeMemoContext;
}): Record<string, string> {
  const memoSubject = resolveInternalStaffNoticeSubject({
    noticeKind: params.event.noticeKind,
    eventName: params.event.name,
    customSubject: params.event.noticeSubject
  });

  return {
    first_name: firstName(params.guest.name),
    guest_name: params.guest.name.trim() || "Staff",
    guest_email: params.guest.email?.trim() ?? "",
    check_in_link: params.checkInLink?.trim() ?? "",
    event_name: params.event.name,
    event_date: formatDate(params.event.date),
    event_time: formatEventTime(params.event.date),
    session_datetime: formatMemoDateTime(params.event.date),
    memo_to: params.memo.memoTo,
    memo_from: params.memo.memoFrom,
    memo_cc: params.memo.memoCc?.trim() ?? "",
    memo_subject: memoSubject,
    memo_date: formatMemoDate(params.memo.memoDate),
    meeting_room: params.memo.meetingRoom?.trim() ?? "",
    venue_line: params.memo.venueLine,
    org_name: params.orgName,
    org_logo_url: resolveEmailAssetUrl(params.orgLogoUrl) ?? ""
  };
}

export function sampleStaffNoticeMergeValues(
  overrides?: Partial<Record<string, string>>
): Record<string, string> {
  return {
    first_name: "Alex",
    guest_name: "Alex Morgan",
    guest_email: "alex@example.com",
    check_in_link: "https://eventflow.cosabonita.tech/register/ev123/i/abc123",
    event_name: "Annual compliance training",
    event_date: "March 15, 2026",
    event_time: "9:00 AM",
    session_datetime: "Saturday, 15 March 2026 at 9:00 AM",
    memo_to: "ALL STAFF",
    memo_from: "HEAD, HUMAN RESOURCES",
    memo_cc: "CHIEF EXECUTIVE OFFICER",
    memo_subject: "Mandatory staff training",
    memo_date: "Monday, 10 March 2026",
    meeting_room: "Committee Room 2",
    venue_line: "Venue: Committee Room 2, Head Office — 12 Independence Ave",
    org_name: "Summit Organizers",
    org_logo_url: "https://eventflow.cosabonita.tech/brand/eventflow-logo.png",
    ...overrides
  };
}
