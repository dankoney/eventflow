import type { JSONContent } from "@tiptap/core";

/**
 * Broadcast email merge variables — aligned to Guest / Event / Organization fields.
 *
 * | Tag id              | Source at send time                          |
 * |---------------------|----------------------------------------------|
 * | first_name          | Guest.name (first token)                     |
 * | guest_name          | Guest.name (full)                            |
 * | guest_email         | Guest.email / EmailContact.email             |
 * | event_name          | Event.name                                   |
 * | event_date          | Event.date (formatted)                       |
 * | guest_category      | Guest.tier (A/B/C)                           |
 * | company             | Guest.company or OrgContact.company          |
 * | org_name            | Organization.name                            |
 * | org_logo_url        | Organization.logoUrl (falls back to logo)    |
 * | org_primary_color   | Organization.primaryColor                    |
 * | org_accent_color    | Organization.accentColor (falls back primary)  |
 * | event_url           | Guest RSVP or public registration page         |
 */
export const BROADCAST_EMAIL_MERGE_TAGS = [
  { id: "first_name", label: "First name", fallback: "there" },
  { id: "guest_name", label: "Guest full name" },
  { id: "guest_email", label: "Guest email" },
  { id: "event_name", label: "Event name" },
  { id: "event_date", label: "Event date" },
  { id: "event_url", label: "Event page URL" },
  { id: "guest_category", label: "Guest category (A/B/C)" },
  { id: "company", label: "Company" },
  { id: "org_name", label: "Organization name" },
  { id: "org_logo_url", label: "Organization logo URL" },
  { id: "org_primary_color", label: "Organization primary color" },
  { id: "org_accent_color", label: "Organization accent color" }
] as const;

export type BroadcastMergeTagId = (typeof BROADCAST_EMAIL_MERGE_TAGS)[number]["id"];

export const RESEND_UNSUBSCRIBE_MERGE_TAG = "{{{RESEND_UNSUBSCRIBE_URL}}}";

export function mailyVariableNode(
  id: BroadcastMergeTagId | string,
  label: string,
  fallback?: string | null
): JSONContent {
  return {
    type: "variable",
    attrs: {
      id,
      label,
      fallback: fallback ?? null,
      showIfKey: null,
      required: false
    }
  };
}

export function blankMailyDocument(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1, textAlign: "left" },
        content: [{ type: "text", text: "Your email title" }]
      },
      {
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [{ type: "text", text: "Start writing your message…" }]
      }
    ]
  };
}
