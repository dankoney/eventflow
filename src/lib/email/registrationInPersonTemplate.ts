/**
 * Branded in-person registration confirmation email.
 *
 * Visually mirrors the unified RSVP / invitation template — black surface,
 * white inner cards, Manrope headline, Inter body. The QR PNG is referenced
 * via a Content-ID attachment (`cid:check-in-qr.png`) so it renders inline.
 */

import {
  escapeAttr,
  escapeHtml,
  firstNameOf,
  renderBrandedEmailShell,
  renderEmailCard,
  renderEventDetailsCard,
  sanitizeHexColor,
  stackEmailSections
} from "./brandedEmailShell";
import { renderPollEmailBlockDark, type PollEmailNotice } from "./pollEmailBlock";

export type RegistrationInPersonEmailParams = {
  guestName: string;
  eventName: string;
  /** Pre-formatted date/time label (e.g. "Nov 14, 2026 · 9:00 AM"). */
  eventDateLabel: string;
  /** Pre-formatted location line (e.g. "Accra · Marriott Hotel"). */
  locationLine: string;
  /** Optional "Get directions" URL appended after the location line. */
  directionsUrl?: string | null;
  orgName: string;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  /** Optional poll info appended below the QR card. */
  poll?: PollEmailNotice | null;
};

export function renderRegistrationInPersonEmailHtml(p: RegistrationInPersonEmailParams): string {
  const accent = sanitizeHexColor(p.brandPrimaryColor) ?? "#22d3ee";
  const firstName = firstNameOf(p.guestName);

  const detailsCard = renderEventDetailsCard({
    eventName: p.eventName,
    eventDateLabel: p.eventDateLabel,
    locationLine: p.locationLine,
    directionsUrl: p.directionsUrl,
    accent
  });

  const qrCard = renderEmailCard({
    eyebrow: "Your check-in QR",
    bodyHtml: `<img src="cid:check-in-qr.png" alt="Check-in QR code" width="220" height="220" style="margin-top:14px;display:inline-block;width:220px;height:220px;border:1px solid #f4f4f5;border-radius:12px"/><p style="margin:12px 0 0;color:#52525b;font-size:11px;font-family:'Inter',Helvetica,Arial,sans-serif">Save this email or screenshot the badge. Staff will scan it at the venue door for a fast check-in.</p>`
  });

  const pollCard = renderPollEmailBlockDark(p.poll ?? null, accent);

  const bodyHtml = stackEmailSections(detailsCard, qrCard, pollCard);

  return renderBrandedEmailShell({
    preheader: `You're registered for ${p.eventName} on ${p.eventDateLabel}.`,
    title: `You're registered: ${p.eventName}`,
    orgName: p.orgName,
    brandLogoUrl: p.brandLogoUrl,
    orgLogoUrl: p.orgLogoUrl,
    orgDefaultBrandLogoUrl: p.orgDefaultBrandLogoUrl,
    brandPrimaryColor: p.brandPrimaryColor,
    headline: `You're registered, ${firstName}.`,
    lede: `Your spot for ${p.eventName} is locked in. The QR badge below is your fast-lane check-in — bring it on your phone.`,
    bodyHtml,
    footerCaption: "Show this email at the door for a fast check-in."
  });
}

// Re-export helpers to keep email.ts imports tight.
export { escapeAttr, escapeHtml };
