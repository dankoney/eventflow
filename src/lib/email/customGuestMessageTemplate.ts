import {
  escapeHtml,
  firstNameOf,
  renderBrandedEmailShell,
  renderEmailCard,
  renderEventDetailsCard,
  sanitizeHexColor,
  stackEmailSections
} from "./brandedEmailShell";

export type CustomGuestMessageEmailParams = {
  guestName: string;
  eventName: string;
  eventDateLabel: string;
  locationLine?: string | null;
  orgName: string;
  brandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  subject: string;
  headline: string;
  message: string;
};

export function renderCustomGuestMessageEmailHtml(p: CustomGuestMessageEmailParams): string {
  const accent = sanitizeHexColor(p.brandPrimaryColor) ?? "#22d3ee";
  const firstName = firstNameOf(p.guestName);
  const paragraphs = p.message
    .trim()
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 12px;color:#3f3f46;font-size:14px;line-height:1.6;font-family:'Inter',Helvetica,Arial,sans-serif;text-align:left">${escapeHtml(line)}</p>`
    )
    .join("");

  const messageCard = renderEmailCard({
    eyebrow: "Message",
    title: `Hi ${firstName},`,
    center: false,
    bodyHtml: paragraphs || `<p style="margin:0;color:#3f3f46;font-size:14px;line-height:1.6">&nbsp;</p>`
  });

  const eventCard = renderEventDetailsCard({
    eventName: p.eventName,
    eventDateLabel: p.eventDateLabel,
    locationLine: p.locationLine,
    accent
  });

  return renderBrandedEmailShell({
    preheader: p.headline,
    title: p.subject,
    orgName: p.orgName,
    brandLogoUrl: p.brandLogoUrl,
    brandPrimaryColor: p.brandPrimaryColor,
    headline: p.headline,
    lede: `A note from ${p.orgName} about ${p.eventName}.`,
    bodyHtml: stackEmailSections(messageCard, eventCard),
    footerCaption: "Personal message"
  });
}
