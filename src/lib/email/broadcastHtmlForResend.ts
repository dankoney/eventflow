import { BROADCAST_EMAIL_MERGE_TAGS } from "@/lib/email/broadcastMergeTags";
import { substituteBroadcastMergeTags } from "@/lib/email/compileEmailTemplate";
import type { OrgEmailBranding } from "@/lib/email/orgBranding";
import { orgBrandingToMergeValues, resolveOrgEmailBranding } from "@/lib/email/orgBranding";

/** Substituted once per campaign before Resend broadcast send. */
export const BROADCAST_ORG_LEVEL_MERGE_TAGS = [
  "org_name",
  "org_logo_url",
  "org_primary_color",
  "org_accent_color"
] as const;

/** Synced to Resend contact properties; converted to {{{tag|fallback}}} in HTML. */
export const BROADCAST_PER_RECIPIENT_MERGE_TAGS = [
  "first_name",
  "guest_name",
  "guest_email",
  "event_name",
  "event_date",
  "event_url",
  "guest_category",
  "company"
] as const;

const FALLBACK_BY_TAG = new Map(
  BROADCAST_EMAIL_MERGE_TAGS.filter((t) => "fallback" in t && t.fallback).map((t) => [
    t.id,
    (t as { fallback?: string }).fallback ?? ""
  ])
);

/**
 * 1. Substitute org-level merge tags with literal values (same for all recipients).
 * 2. Convert per-recipient {{tags}} to Resend {{{tags|fallback}}} syntax.
 * Leaves {{{RESEND_UNSUBSCRIBE_URL}}} untouched.
 */
export function prepareBroadcastHtmlForResend(
  compiledHtml: string,
  org: { name: string } & Parameters<typeof resolveOrgEmailBranding>[0]
): string {
  const branding: OrgEmailBranding = resolveOrgEmailBranding(org);
  const orgValues = orgBrandingToMergeValues(branding, org.name);
  let html = substituteBroadcastMergeTags(compiledHtml, orgValues);

  for (const tag of BROADCAST_PER_RECIPIENT_MERGE_TAGS) {
    const fallback = FALLBACK_BY_TAG.get(tag) ?? "";
    const pattern = new RegExp(`\\{\\{${tag}\\}\\}`, "g");
    html = html.replace(pattern, `{{{${tag}|${fallback}}}}`);
  }

  return html;
}

export function contactPropertiesFromMergeValues(
  values: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of BROADCAST_PER_RECIPIENT_MERGE_TAGS) {
    const value = values[key];
    if (value != null && value !== "") {
      out[key] = value;
    }
  }
  return out;
}
