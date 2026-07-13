/**
 * Branded virtual registration confirmation email.
 *
 * Mirrors the dark-themed design used by the invitation / unified RSVP / and
 * in-person registration emails. Surfaces the personal Zoom link as the
 * primary CTA, plus the join page, meeting ID/passcode, and an attendance
 * note. Optionally appends a poll block.
 */

import {
  escapeAttr,
  escapeHtml,
  firstNameOf,
  renderBrandedEmailShell,
  renderCtaButton,
  renderEmailCard,
  renderEventDetailsCard,
  sanitizeHexColor,
  stackEmailSections
} from "./brandedEmailShell";
import { renderPollEmailBlockDark, type PollEmailNotice } from "./pollEmailBlock";

export type RegistrationVirtualEmailParams = {
  guestName: string;
  eventName: string;
  eventDateLabel: string;
  /** "virtual meeting" | "virtual webinar" — surfaces in the lede + footer. */
  sessionLabel: string;
  zoomJoinUrl: string;
  /** When true, the join link records attendance via the Eventflow gateway. */
  zoomLinkTracksAttendance: boolean;
  /** Omitted when the organizer uses per-day external links only. */
  meetingId?: string | null;
  passcode?: string | null;
  joinPageUrl?: string | null;
  orgName: string;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  poll?: PollEmailNotice | null;
};

export function renderRegistrationVirtualEmailHtml(p: RegistrationVirtualEmailParams): string {
  const accent = sanitizeHexColor(p.brandPrimaryColor) ?? "#22d3ee";
  const firstName = firstNameOf(p.guestName);

  const detailsCard = renderEventDetailsCard({
    eventName: p.eventName,
    eventDateLabel: p.eventDateLabel,
    accent
  });

  const zoomBody = [
    `<p style="margin:14px 0 0;color:#3f3f46;font-size:13px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">Your personal Zoom link works from desktop, mobile, or the Zoom app. Save this email — don't share the link.</p>`,
    `<p style="margin:18px 0 0">${renderCtaButton({ href: p.zoomJoinUrl, label: "Join Zoom", accent })}</p>`
  ].join("");
  const zoomCard = renderEmailCard({
    eyebrow: "Virtual join link",
    bodyHtml: zoomBody
  });

  const meetingLines: string[] = [];
  if (p.meetingId && p.meetingId.trim().length > 0) {
    meetingLines.push(
      `<p style="margin:0;color:#3f3f46;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif"><strong style="color:#0a0a0a">Meeting ID:</strong> ${escapeHtml(p.meetingId.trim())}</p>`
    );
    if (p.passcode && p.passcode.trim().length > 0) {
      meetingLines.push(
        `<p style="margin:4px 0 0;color:#3f3f46;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif"><strong style="color:#0a0a0a">Passcode:</strong> ${escapeHtml(p.passcode.trim())}</p>`
      );
    }
  } else {
    meetingLines.push(
      `<p style="margin:0;color:#475569;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif">Your organizer set different Zoom links per day — use your join page for the correct link on each day.</p>`
    );
  }
  const meetingCard = renderEmailCard({
    eyebrow: "Meeting details",
    bodyHtml: meetingLines.join(""),
    center: false
  });

  const joinPageCard = p.joinPageUrl
    ? renderEmailCard({
        eyebrow: "Bookmark your join page",
        bodyHtml: `<p style="margin:10px 0 0;color:#3f3f46;font-size:13px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif"><a href="${escapeAttr(p.joinPageUrl)}" style="color:${escapeAttr(accent)};font-weight:600;text-decoration:none">${escapeHtml(p.joinPageUrl)}</a></p><p style="margin:8px 0 0;color:#52525b;font-size:12px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">${p.zoomLinkTracksAttendance ? "Opening the link above records your attendance, then takes you to Zoom." : "Open your join page and confirm so we can record that you joined."}</p>`
      })
    : "";

  const pollCard = renderPollEmailBlockDark(p.poll ?? null, accent);

  const bodyHtml = stackEmailSections(detailsCard, zoomCard, meetingCard, joinPageCard, pollCard);

  return renderBrandedEmailShell({
    preheader: `Your Zoom link for ${p.eventName} (${p.eventDateLabel}).`,
    title: `Your Zoom link: ${p.eventName}`,
    orgName: p.orgName,
    brandLogoUrl: p.brandLogoUrl,
    orgLogoUrl: p.orgLogoUrl,
    orgDefaultBrandLogoUrl: p.orgDefaultBrandLogoUrl,
    brandPrimaryColor: p.brandPrimaryColor,
    headline: `You're confirmed, ${firstName}.`,
    lede: `Your seat for the ${p.sessionLabel} — ${p.eventName} — is saved. Your personal Zoom link is below; don't forward it.`,
    bodyHtml,
    footerCaption: "Save this email — your Zoom access lives in it."
  });
}
