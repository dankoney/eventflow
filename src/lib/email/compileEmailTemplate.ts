import type { JSONContent } from "@tiptap/core";
import { Maily } from "@maily-to/render";

import {
  BROADCAST_EMAIL_MERGE_TAGS,
  RESEND_UNSUBSCRIBE_MERGE_TAG
} from "@/lib/email/broadcastMergeTags";
import {
  BROADCAST_EMAIL_FONT_STACK,
  EVENT_BANNER_PLACEHOLDER_URL
} from "@/lib/email/mailyLayoutBlocks";
import {
  DEFAULT_ORG_PRIMARY_COLOR,
  type OrgEmailBranding,
  resolveOrgEmailBranding
} from "@/lib/email/orgBranding";

const BROADCAST_EMAIL_MAX_WIDTH_PX = 600;

const COMPLIANCE_FOOTER_HTML = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:8px;background-color:#f8fafc;">
  <tr>
    <td align="center" style="padding:20px 24px;font-size:12px;line-height:20px;color:#64748b;font-family:${BROADCAST_EMAIL_FONT_STACK};">
      <p style="margin:0 0 8px 0;font-family:${BROADCAST_EMAIL_FONT_STACK};">You are receiving marketing email from {{org_name}}.</p>
      <p style="margin:0;font-family:${BROADCAST_EMAIL_FONT_STACK};">
        <a href="${RESEND_UNSUBSCRIBE_MERGE_TAG}" style="color:{{org_accent_color}};text-decoration:underline;font-family:${BROADCAST_EMAIL_FONT_STACK};">Unsubscribe</a>
      </p>
    </td>
  </tr>
</table>`;

export function compiledHtmlIncludesUnsubscribeTag(html: string): boolean {
  return html.includes(RESEND_UNSUBSCRIBE_MERGE_TAG);
}

export function compiledHtmlHasEventBannerPlaceholder(html: string): boolean {
  return html.includes(EVENT_BANNER_PLACEHOLDER_URL);
}

export type BroadcastSendValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Gate before dispatching a broadcast — mirrors the unsubscribe-tag enforcement
 * and blocks sends that still contain the default banner placeholder.
 */
export function validateBroadcastHtmlForSend(html: string): BroadcastSendValidationResult {
  const errors: string[] = [];

  if (!compiledHtmlIncludesUnsubscribeTag(html)) {
    errors.push("Compiled template is missing the Resend unsubscribe merge tag.");
  }

  if (compiledHtmlHasEventBannerPlaceholder(html)) {
    errors.push(
      "Template still uses the default event banner placeholder. Replace the banner image before sending."
    );
  }

  return { valid: errors.length === 0, errors };
}

export function assertBroadcastReadyToSend(html: string): void {
  const result = validateBroadcastHtmlForSend(html);
  if (!result.valid) {
    throw new Error(result.errors.join(" "));
  }
}

export function ensureResendUnsubscribeFooter(html: string): string {
  if (compiledHtmlIncludesUnsubscribeTag(html)) {
    return html;
  }
  const lower = html.toLowerCase();
  const bodyClose = lower.lastIndexOf("</body>");
  if (bodyClose !== -1) {
    return html.slice(0, bodyClose) + COMPLIANCE_FOOTER_HTML + html.slice(bodyClose);
  }
  return html + COMPLIANCE_FOOTER_HTML;
}

/**
 * Maily already emits a ~600px inner table for most layouts; this adds a
 * defensive outer shell when that constraint is missing.
 */
export function ensureBroadcastEmailOuterShell(html: string): string {
  if (/max-width:\s*600px/i.test(html)) {
    return html;
  }

  const lower = html.toLowerCase();
  const bodyOpen = lower.indexOf("<body");
  const bodyClose = lower.lastIndexOf("</body>");
  if (bodyOpen === -1 || bodyClose === -1 || bodyClose <= bodyOpen) {
    return html;
  }

  const bodyOpenEnd = html.indexOf(">", bodyOpen);
  if (bodyOpenEnd === -1) return html;

  const inner = html.slice(bodyOpenEnd + 1, bodyClose);
  const wrapped = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="background-color:#f1f5f9;">
  <tr>
    <td align="center" style="padding:16px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:${BROADCAST_EMAIL_MAX_WIDTH_PX}px;width:100%;background-color:#ffffff;">
        <tr>
          <td>${inner}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  return html.slice(0, bodyOpenEnd + 1) + wrapped + html.slice(bodyClose);
}

/** Remove broken logo img when org has no logo URL (after merge substitution). */
export function stripEmptyLogoImage(html: string): string {
  return html.replace(
    /<img\b[^>]*\bsrc=(["'])\s*\1[^>]*>/gi,
    ""
  );
}

/**
 * Renders Maily editor JSON to HTML with merge-tag placeholders and compliance footer.
 * Branding tags (org_logo_url, org_primary_color, org_accent_color) remain as {{placeholders}}
 * until substituted at send/preview time via {@link substituteBroadcastMergeTags}.
 */
export async function compileEmailTemplateHtml(editorState: JSONContent): Promise<string> {
  const maily = new Maily(editorState);
  maily.setShouldReplaceVariableValues(false);
  maily.setVariableFormatter(({ variable }) => `{{${variable}}}`);

  const html = await maily.render({ pretty: false });
  const withFooter = ensureResendUnsubscribeFooter(html);
  const withShell = ensureBroadcastEmailOuterShell(withFooter);

  if (!compiledHtmlIncludesUnsubscribeTag(withShell)) {
    throw new Error("Compiled template is missing the Resend unsubscribe merge tag.");
  }

  return withShell;
}

/** Sample values for admin HTML preview / tests only. */
export function sampleBroadcastMergeValues(
  branding?: Partial<OrgEmailBranding> & { org_name?: string }
): Record<string, string> {
  const primary = branding?.primaryColor ?? DEFAULT_ORG_PRIMARY_COLOR;
  const accent = branding?.accentColor ?? primary;

  return {
    first_name: "Alex",
    guest_name: "Alex Morgan",
    guest_email: "alex@example.com",
    event_name: "Annual Leadership Summit",
    event_date: "March 15, 2026",
    event_url: "https://eventflow.cosabonita.tech/register/cmp123example",
    guest_category: "A",
    company: "Acme Corp",
    org_name: branding?.org_name ?? "Summit Organizers",
    org_logo_url: branding?.logoUrl ?? "https://eventflow.cosabonita.tech/brand/eventflow-logo.png",
    org_primary_color: primary,
    org_accent_color: accent
  };
}

export function sampleOrgBranding(): OrgEmailBranding {
  return {
    logoUrl: "https://eventflow.cosabonita.tech/brand/eventflow-logo.png",
    primaryColor: "#4F46E5",
    accentColor: "#6366F1"
  };
}

export function substituteBroadcastMergeTags(
  html: string,
  values: Record<string, string>
): string {
  let out = html;
  for (const [key, value] of Object.entries(values)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return stripEmptyLogoImage(out);
}

export function substituteBroadcastMergeTagsForPreview(
  html: string,
  branding?: Partial<OrgEmailBranding> & { org_name?: string }
): string {
  return substituteBroadcastMergeTags(html, sampleBroadcastMergeValues(branding));
}

export const BROADCAST_MERGE_TAG_IDS = BROADCAST_EMAIL_MERGE_TAGS.map((t) => t.id);

export { resolveOrgEmailBranding };
