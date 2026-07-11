/**
 * Branded "Election & Polling" block for the dark-themed transactional emails
 * (registration confirmations, etc.).
 *
 * The legacy `renderPollEmailBlock` in `email.ts` rendered a light callout that
 * looked broken on the dark shell. This version produces a white inner card
 * matching the shell's design language (mirrors `renderEventDetailsCard` /
 * `renderEmailCard`).
 *
 * Returns an empty string when `poll` is null / undefined, so the caller can
 * pass the result straight to `stackEmailSections(...)` without guards.
 */

import { escapeAttr, escapeHtml, renderCtaButton, sanitizeHexColor } from "./brandedEmailShell";

/**
 * Voter-facing poll context attached to the confirmation email/SMS when the
 * registered event has an active or upcoming ballot.
 *
 * `inWindow` is true only when voting is open *right now*; `upcoming` is true
 * when the ballot is active but `now < startTime`. Past/inactive polls are not
 * passed in.
 */
export type PollEmailNotice = {
  title: string;
  instructions: string | null;
  /** Pre-formatted "voting opens" label. */
  startTimeLabel: string;
  /** Pre-formatted "voting closes" label. */
  endTimeLabel: string;
  ballotUrl: string;
  inWindow: boolean;
  upcoming: boolean;
  /** Mirrors `Poll.isAnonymous === false`. Triggers the "your vote will be linked to you" notice. */
  isAttributed: boolean;
};

/** Dark-shell variant: white inner card. */
export function renderPollEmailBlockDark(
  poll: PollEmailNotice | null | undefined,
  accent: string
): string {
  if (!poll) return "";
  const safeAccent = sanitizeHexColor(accent) ?? "#22d3ee";

  const headlineCopy = poll.inWindow
    ? "Voting is open now"
    : poll.upcoming
      ? "Voting opens soon"
      : "Voting window";
  const ctaLabel = poll.inWindow ? "Cast your ballot" : "Open ballot page";

  const instructionsBlock = poll.instructions?.trim()
    ? `<div style="margin-top:14px;padding:12px 14px;border-left:4px solid ${escapeAttr(safeAccent)};background:#fffbeb;border-radius:8px;text-align:left">
         <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#92400e;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">How to vote</p>
         <p style="margin:6px 0 0;white-space:pre-wrap;font-size:13px;line-height:1.55;color:#1e293b;font-family:'Inter',Helvetica,Arial,sans-serif">${escapeHtml(poll.instructions.trim())}</p>
       </div>`
    : "";

  const attribution = poll.isAttributed
    ? `<p style="margin:14px 0 0;font-size:12px;color:#92400e;font-family:'Inter',Helvetica,Arial,sans-serif">Note: this is an <strong>attributed ballot</strong> — the organizer can see how each guest voted, and you'll receive a copy of your selections after submitting.</p>`
    : `<p style="margin:14px 0 0;font-size:12px;color:#475569;font-family:'Inter',Helvetica,Arial,sans-serif">Your ballot is anonymous — only a participation flag is stored against your profile.</p>`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-radius:18px"><tr><td align="center" style="padding:22px 24px">
    <p style="margin:0;color:${escapeAttr(safeAccent)};font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">Election &amp; polling</p>
    <p style="margin:8px 0 0;color:#0a0a0a;font-size:18px;font-weight:700;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${escapeHtml(poll.title)}</p>
    <p style="margin:6px 0 0;color:#3f3f46;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif"><strong>${escapeHtml(headlineCopy)}.</strong> Window: ${escapeHtml(poll.startTimeLabel)} → ${escapeHtml(poll.endTimeLabel)}</p>
    ${instructionsBlock}
    <p style="margin:18px 0 0">${renderCtaButton({ href: poll.ballotUrl, label: ctaLabel, accent: safeAccent })}</p>
    ${attribution}
  </td></tr></table>`;
}
