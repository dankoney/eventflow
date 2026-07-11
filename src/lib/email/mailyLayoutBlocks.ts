import type { JSONContent } from "@tiptap/core";

import { mailyVariableNode } from "@/lib/email/broadcastMergeTags";

/** Email-safe stack used across broadcast templates. */
export const BROADCAST_EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const EVENT_BANNER_PLACEHOLDER_URL =
  "https://placehold.co/600x200/e2e8f0/475569?text=Replace+event+banner";

/** Raw HTML block rendered by Maily (supports {{merge}} tags in text). */
export function mailyHtmlBlock(html: string): JSONContent {
  return {
    type: "htmlCodeBlock",
    attrs: { language: "html", activeTab: "code", showIfKey: null },
    content: [{ type: "text", text: html }]
  };
}

export function mailySpacer(height = 16): JSONContent {
  return {
    type: "spacer",
    attrs: { height: String(height), showIfKey: null }
  };
}

export function mailyParagraph(...parts: JSONContent[]): JSONContent {
  return {
    type: "paragraph",
    attrs: { textAlign: "left", showIfKey: null },
    content: parts
  };
}

export function mailyHeading(level: 1 | 2 | 3, ...parts: JSONContent[]): JSONContent {
  return {
    type: "heading",
    attrs: { level, textAlign: "left", showIfKey: null },
    content: parts.length ? parts : [{ type: "text", text: "Heading" }]
  };
}

export function mailyText(value: string): JSONContent {
  return { type: "text", text: value };
}

export function mailyEventBannerImage(): JSONContent {
  return {
    type: "image",
    attrs: {
      src: EVENT_BANNER_PLACEHOLDER_URL,
      alt: "Event banner — replace in editor",
      title: null,
      width: "600",
      height: "auto",
      alignment: "center",
      externalLink: null,
      isExternalLinkVariable: false,
      isSrcVariable: false,
      showIfKey: null
    }
  };
}

/**
 * Header band: optional logo image + org name on primary color background.
 * When org_logo_url is empty at send time, strip the img in finalizeBroadcastHtml.
 */
export function mailyBrandedHeaderBlock(): JSONContent {
  const html = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:{{org_primary_color}};">
  <tr>
    <td align="center" style="padding:28px 24px 24px;font-family:${BROADCAST_EMAIL_FONT_STACK};">
      <img src="{{org_logo_url}}" alt="{{org_name}}" width="168" style="display:block;max-width:168px;max-height:56px;height:auto;margin:0 auto 10px;border:0;outline:none;text-decoration:none;" />
      <p style="margin:0;font-size:18px;font-weight:700;line-height:1.35;color:#ffffff;text-align:center;">{{org_name}}</p>
    </td>
  </tr>
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:{{org_accent_color}};height:4px;line-height:4px;font-size:4px;">
  <tr><td style="font-size:4px;line-height:4px;">&nbsp;</td></tr>
</table>`.trim();

  return mailyHtmlBlock(html);
}

/** Bulletproof CTA button using org primary color. */
export function mailyPrimaryCtaBlock(label: string, href = "{{event_url}}"): JSONContent {
  const html = `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:8px auto 4px;">
  <tr>
    <td align="center" style="border-radius:8px;background-color:{{org_primary_color}};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${BROADCAST_EMAIL_FONT_STACK};font-size:16px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:8px;background-color:{{org_primary_color}};border:1px solid {{org_primary_color}};">${label}</a>
    </td>
  </tr>
</table>`.trim();

  return mailyHtmlBlock(html);
}

/** Body content wrapper with padding and email-safe typography. */
export function mailyBodyShellBlock(innerHtml: string): JSONContent {
  const html = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;">
  <tr>
    <td style="padding:32px 28px 8px;font-family:${BROADCAST_EMAIL_FONT_STACK};color:#1e293b;">
      ${innerHtml}
    </td>
  </tr>
</table>`.trim();

  return mailyHtmlBlock(html);
}

export function mailyBodyHeading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:${BROADCAST_EMAIL_FONT_STACK};font-size:28px;line-height:1.25;font-weight:700;color:#0f172a;">${text}</h1>`;
}

export function mailyBodyParagraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${BROADCAST_EMAIL_FONT_STACK};font-size:16px;line-height:1.6;color:#334155;">${html}</p>`;
}

export { mailyVariableNode };
