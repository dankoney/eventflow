import type { JSONContent } from "@tiptap/core";

import { mailyVariableNode } from "@/lib/email/broadcastMergeTags";

/**
 * Merge variables for internal staff notice blank (Maily) emails.
 */
export const STAFF_NOTICE_EMAIL_MERGE_TAGS = [
  { id: "first_name", label: "First name", fallback: "Colleague" },
  { id: "guest_name", label: "Staff full name" },
  { id: "guest_email", label: "Staff email" },
  { id: "check_in_link", label: "Personal check-in link" },
  { id: "event_name", label: "Event / programme name" },
  { id: "event_date", label: "Event date" },
  { id: "event_time", label: "Event time" },
  { id: "session_datetime", label: "Session date & time" },
  { id: "memo_to", label: "Memo TO line" },
  { id: "memo_from", label: "Memo FROM line" },
  { id: "memo_cc", label: "Memo CC line" },
  { id: "memo_subject", label: "Memo subject" },
  { id: "memo_date", label: "Memo date" },
  { id: "meeting_room", label: "Meeting room" },
  { id: "venue_line", label: "Venue / platform line" },
  { id: "org_name", label: "Organization name" },
  { id: "org_logo_url", label: "Organization logo URL" }
] as const;

export type StaffNoticeMergeTagId = (typeof STAFF_NOTICE_EMAIL_MERGE_TAGS)[number]["id"];

export function blankStaffNoticeMailyDocument(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1, textAlign: "left" },
        content: [{ type: "text", text: "Staff notice" }]
      },
      {
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [
          { type: "text", text: "Dear " },
          mailyVariableNode("first_name", "First name", "Colleague"),
          { type: "text", text: "," }
        ]
      },
      {
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [{ type: "text", text: "Write your full memo here…" }]
      }
    ]
  };
}
