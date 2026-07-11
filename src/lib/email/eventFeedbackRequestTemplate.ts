import { EventFeedbackRating } from "@prisma/client";

import {
  EVENT_FEEDBACK_RATINGS,
  EVENT_FEEDBACK_RATING_META
} from "@/lib/event-feedback/ratings";

import {
  escapeAttr,
  escapeHtml,
  firstNameOf,
  renderBrandedEmailShell,
  renderCtaButton,
  renderEmailCard,
  sanitizeHexColor,
  stackEmailSections
} from "./brandedEmailShell";

function renderEmailEmojiRatingRow(
  ratingUrls: Partial<Record<EventFeedbackRating, string>>,
  accent: string
): string {
  const emojiCells = EVENT_FEEDBACK_RATINGS.map((rating) => {
    const meta = EVENT_FEEDBACK_RATING_META[rating];
    const href = ratingUrls[rating];
    if (!href) {
      return `<td align="center" style="padding:4px 2px;vertical-align:top"><span style="font-size:32px;line-height:1" title="${escapeAttr(meta.label)}">${meta.emoji}</span></td>`;
    }
    return `<td align="center" style="padding:4px 2px;vertical-align:top">
      <a href="${escapeAttr(href)}" title="${escapeAttr(meta.label)}" style="display:inline-block;text-decoration:none;font-size:36px;line-height:1;padding:8px 8px;border-radius:12px;border:2px solid ${accent};background:#fafafa">${meta.emoji}</a>
    </td>`;
  }).join("");

  const labelCells = EVENT_FEEDBACK_RATINGS.map((rating) => {
    const meta = EVENT_FEEDBACK_RATING_META[rating];
    return `<td align="center" style="padding:2px 2px 0;vertical-align:top">
      <p style="margin:0;color:#52525b;font-size:10px;line-height:1.25;font-weight:600;font-family:'Inter',Helvetica,Arial,sans-serif">${escapeHtml(meta.label)}</p>
    </td>`;
  }).join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 0">
    <tr>${emojiCells}</tr>
    <tr>${labelCells}</tr>
    <tr>
      <td colspan="5" align="center" style="padding:10px 0 0">
        <p style="margin:0;color:#71717a;font-size:11px;line-height:1.4;font-family:'Inter',Helvetica,Arial,sans-serif">Tap an emoji to prefill your rating — labels show what each one means</p>
      </td>
    </tr>
  </table>`;
}

export function renderEventFeedbackRequestEmailHtml(params: {
  guestName: string;
  eventName: string;
  eventDateLabel: string;
  orgName: string;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  feedbackUrl: string;
  ratingUrls: Partial<Record<EventFeedbackRating, string>>;
}): string {
  const accent = sanitizeHexColor(params.brandPrimaryColor) ?? "#22d3ee";
  const firstName = firstNameOf(params.guestName);
  const emojiRow = renderEmailEmojiRatingRow(params.ratingUrls, accent);

  const messageCard = renderEmailCard({
    eyebrow: "Quick feedback",
    title: `Hi ${firstName}, how was ${params.eventName}?`,
    center: false,
    bodyHtml: `<p style="margin:0;color:#3f3f46;font-size:14px;line-height:1.6;font-family:'Inter',Helvetica,Arial,sans-serif;text-align:left">Tap an emoji to prefill your rating in the form. Then press submit to save your feedback.</p>
      ${emojiRow}
      <p style="margin:20px 0 0;text-align:center">${renderCtaButton({
        href: params.feedbackUrl,
        label: "Share feedback",
        accent
      })}</p>
      <p style="margin:12px 0 0;text-align:center;color:#71717a;font-size:11px;line-height:1.4;font-family:'Inter',Helvetica,Arial,sans-serif">The link opens a short form if you prefer to leave a written note.</p>`
  });

  const eventCard = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-radius:18px"><tr><td align="center" style="padding:20px">
    <p style="margin:0;color:#0a0a0a;font-size:16px;font-weight:700;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${escapeHtml(params.eventName)}</p>
    <p style="margin:8px 0 0;color:#3f3f46;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif">📅 ${escapeHtml(params.eventDateLabel)}</p>
  </td></tr></table>`;

  return renderBrandedEmailShell({
    preheader: `How was ${params.eventName}? Tap an emoji or share feedback.`,
    title: `Feedback: ${params.eventName}`,
    orgName: params.orgName,
    brandLogoUrl: params.brandLogoUrl,
    orgLogoUrl: params.orgLogoUrl,
    orgDefaultBrandLogoUrl: params.orgDefaultBrandLogoUrl,
    brandPrimaryColor: params.brandPrimaryColor,
    headline: "We'd love your feedback",
    lede: `Thanks for attending ${params.eventName}.`,
    bodyHtml: stackEmailSections(messageCard, eventCard),
    footerCaption: "Post-event feedback"
  });
}
