/**
 * Branded "registration removed" email.
 *
 * Tone is calm and informational — not punitive. We keep the same dark
 * surface + white inner card design as the other transactional emails so
 * the guest immediately recognises the sender.
 */

import {
  escapeAttr,
  escapeHtml,
  firstNameOf,
  renderBrandedEmailShell,
  renderEmailCard,
  stackEmailSections
} from "./brandedEmailShell";

export type GuestRemovedEmailParams = {
  guestName: string;
  eventName: string;
  /** Pre-formatted date label. */
  eventDateLabel: string;
  orgName: string;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  /** Optional support email shown on the contact card. */
  supportEmail?: string | null;
};

export function renderGuestRemovedEmailHtml(p: GuestRemovedEmailParams): string {
  const firstName = firstNameOf(p.guestName);

  const summaryCard = renderEmailCard({
    eyebrow: "Registration update",
    title: p.eventName,
    subtitle: `📅 ${p.eventDateLabel}`,
    bodyHtml: `<p style="margin:14px 0 0;color:#3f3f46;font-size:13px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">Your registration for this event has been removed by the organizer. You will not receive further reminders or check-in materials.</p>`
  });

  const supportLine = p.supportEmail?.trim()
    ? `<p style="margin:10px 0 0;color:#3f3f46;font-size:13px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">If you believe this was a mistake, reply to this email or reach out to <a href="mailto:${escapeAttr(p.supportEmail.trim())}" style="color:#0a0a0a;font-weight:600;text-decoration:none">${escapeHtml(p.supportEmail.trim())}</a>.</p>`
    : `<p style="margin:10px 0 0;color:#3f3f46;font-size:13px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">If you believe this was a mistake, reply to this email and the organizer will follow up.</p>`;

  const contactCard = renderEmailCard({
    eyebrow: "Need help?",
    bodyHtml: supportLine,
    center: false
  });

  const bodyHtml = stackEmailSections(summaryCard, contactCard);

  return renderBrandedEmailShell({
    preheader: `Your registration for ${p.eventName} has been removed.`,
    title: `Registration removed: ${p.eventName}`,
    orgName: p.orgName,
    brandLogoUrl: p.brandLogoUrl,
    orgLogoUrl: p.orgLogoUrl,
    orgDefaultBrandLogoUrl: p.orgDefaultBrandLogoUrl,
    brandPrimaryColor: p.brandPrimaryColor,
    headline: `A quick note, ${firstName}.`,
    lede: `Your registration for ${p.eventName} has been removed by the organizer. We're letting you know so you don't show up expecting a seat.`,
    bodyHtml,
    footerCaption: "No further action is needed."
  });
}
