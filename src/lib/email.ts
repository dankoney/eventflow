import { EventFeedbackRating, ZoomSessionKind } from "@prisma/client";

import { renderCustomGuestMessageEmailHtml } from "./email/customGuestMessageTemplate";
import { renderEventFeedbackRequestEmailHtml } from "./email/eventFeedbackRequestTemplate";
import { renderGuestRemovedEmailHtml } from "./email/guestRemovedTemplate";
import { renderInvitationEmailHtml, type InvitationEmailParams } from "./email/invitationTemplate";
import {
  internalStaffNoticeEmailSubject,
  renderInternalStaffNoticeEmailHtml
} from "@/lib/email/internalStaffNoticeTemplate";
import { type PollEmailNotice as PollEmailNoticeShared } from "./email/pollEmailBlock";
import { renderRegistrationInPersonEmailHtml } from "./email/registrationInPersonTemplate";
import { renderRegistrationVirtualEmailHtml } from "./email/registrationVirtualTemplate";
import { resolveEmailBrandLogoUrl } from "@/lib/url";

/**
 * Re-export of the shared `PollEmailNotice` type so consumers can keep
 * importing it from `@/lib/email`.
 */
export type PollEmailNotice = PollEmailNoticeShared;

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Shown as Reply-To so the organizer can hit reply to the visitor. */
  replyTo?: string;
  /** Optional CC list. */
  cc?: string[];
  /**
   * Optional BCC list (e.g. platform owner + support on billing due alerts —
   * hidden from the primary recipient).
   */
  bcc?: string[];
  /**
   * Base64-encoded file bodies. Pass `contentId` for inline images referenced
   * in the HTML via `<img src="cid:..."/>` (Resend forwards as `content_id`).
   */
  attachments?: Array<{ filename: string; content: string; contentId?: string }>;
  /** When set, overrides RESEND_API_KEY (org-specific key). */
  resendApiKeyOverride?: string;
};

function defaultFrom() {
  return process.env.RESEND_FROM ?? "Eventflow <onboarding@resend.dev>";
}

function uniqueEmailsExcluding(to: string, list: string[] | undefined): string[] {
  const exclude = to.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list ?? []) {
    const email = raw.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (key === exclude || seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export async function sendTransactionalEmail(input: SendEmailInput) {
  const apiKey = input.resendApiKeyOverride ?? process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");

  const to = input.to.trim();
  const cc = uniqueEmailsExcluding(to, input.cc);
  const bcc = uniqueEmailsExcluding(to, input.bcc).filter(
    (email) => !cc.some((c) => c.toLowerCase() === email.toLowerCase())
  );

  const body: Record<string, unknown> = {
    from: defaultFrom(),
    to: [to],
    subject: input.subject,
    html: input.html
  };
  if (cc.length) {
    body.cc = cc;
  }
  if (bcc.length) {
    body.bcc = bcc;
  }
  if (input.replyTo) {
    body.reply_to = input.replyTo;
  }
  if (input.attachments?.length) {
    body.attachments = input.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      ...(a.contentId ? { content_id: a.contentId } : {})
    }));
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend ${response.status}: ${detail.slice(0, 400)}`);
  }
  return response.json() as Promise<{ id?: string }>;
}

/** Parse Resend API error JSON for admin-facing copy (no secrets). */
export function formatResendErrorForClient(error: unknown): string {
  if (!(error instanceof Error)) return "Email could not be sent.";
  const raw = error.message;
  const idx = raw.indexOf("{");
  if (idx !== -1) {
    try {
      const j = JSON.parse(raw.slice(idx)) as { message?: string };
      if (typeof j.message === "string" && j.message.length > 0) return j.message;
    } catch {
      /* ignore */
    }
  }
  return raw.replace(/^Resend \d+:\s*/, "").slice(0, 300);
}

export async function sendSignInOtpEmail(params: { to: string; code: string }) {
  const html = `
    <p>Your Eventflow sign-in code is:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;font-family:ui-monospace,monospace">${escapeHtml(params.code)}</p>
    <p style="color:#64748b;font-size:14px">This code expires in 15 minutes. If you did not request it, you can ignore this email.</p>
    <p>— Eventflow</p>
  `;

  return sendTransactionalEmail({
    to: params.to,
    subject: "Your Eventflow sign-in code",
    html
  });
}

export async function sendGuestConfirmationInPerson(params: {
  to: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  location: string;
  qrPngBase64: string;
  directionsUrl?: string | null;
  /** When set, appends a branded "Election & polling" CTA block to the email. */
  poll?: PollEmailNotice | null;
  /** Organisation branding for the email shell. Falls back to "Eventflow". */
  orgName?: string | null;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  resendApiKeyOverride?: string;
}) {
  const html = renderRegistrationInPersonEmailHtml({
    guestName: params.guestName,
    eventName: params.eventName,
    eventDateLabel: params.eventDate,
    locationLine: params.location,
    directionsUrl: params.directionsUrl ?? null,
    orgName: params.orgName?.trim() || "Eventflow",
    brandLogoUrl: params.brandLogoUrl ?? null,
    orgLogoUrl: params.orgLogoUrl ?? null,
    orgDefaultBrandLogoUrl: params.orgDefaultBrandLogoUrl ?? null,
    brandPrimaryColor: params.brandPrimaryColor ?? null,
    poll: params.poll ?? null
  });

  return sendTransactionalEmail({
    to: params.to,
    subject: `You are registered: ${params.eventName}`,
    html,
    attachments: [
      { filename: "check-in-qr.png", content: params.qrPngBase64, contentId: "check-in-qr.png" }
    ],
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

export async function sendEventFeedbackRequestEmail(params: {
  to: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  orgName: string;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  feedbackUrl: string;
  ratingUrls: Partial<Record<EventFeedbackRating, string>>;
  resendApiKeyOverride?: string;
}) {
  const html = renderEventFeedbackRequestEmailHtml({
    guestName: params.guestName,
    eventName: params.eventName,
    eventDateLabel: params.eventDate,
    orgName: params.orgName,
    brandLogoUrl: params.brandLogoUrl ?? null,
    orgLogoUrl: params.orgLogoUrl ?? null,
    orgDefaultBrandLogoUrl: params.orgDefaultBrandLogoUrl ?? null,
    brandPrimaryColor: params.brandPrimaryColor ?? null,
    feedbackUrl: params.feedbackUrl,
    ratingUrls: params.ratingUrls
  });

  return sendTransactionalEmail({
    to: params.to,
    subject: `How was ${params.eventName}? Quick feedback`,
    html,
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

export async function sendCustomGuestMessageEmail(params: {
  to: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  locationLine?: string | null;
  orgName: string;
  brandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  subject: string;
  headline: string;
  message: string;
  resendApiKeyOverride?: string;
}) {
  const html = renderCustomGuestMessageEmailHtml({
    guestName: params.guestName,
    eventName: params.eventName,
    eventDateLabel: params.eventDate,
    locationLine: params.locationLine ?? null,
    orgName: params.orgName,
    brandLogoUrl: params.brandLogoUrl ?? null,
    brandPrimaryColor: params.brandPrimaryColor ?? null,
    subject: params.subject,
    headline: params.headline,
    message: params.message
  });

  return sendTransactionalEmail({
    to: params.to,
    subject: params.subject,
    html,
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

export async function sendGuestInvitationEmail(params: {
  to: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  locationLine: string;
  acceptUrl: string;
  /** Decline / "I Can't Make It" link (Phase 1 dual-CTA). When omitted, a single CTA renders. */
  declineUrl?: string;
  /** Org & event branding for the invitational template. */
  orgName?: string;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  bannerImageUrl?: string | null;
  brandPrimaryColor?: string | null;
  hookCopy?: string | null;
  closingQuote?: string | null;
  directionsUrl?: string | null;
  siteBaseUrl?: string | null;
  resendApiKeyOverride?: string;
}) {
  const templateInput: InvitationEmailParams = {
    guestName: params.guestName,
    eventName: params.eventName,
    eventDateLabel: params.eventDate,
    locationLine: params.locationLine,
    orgName: params.orgName?.trim() || "Eventflow",
    brandLogoUrl: params.brandLogoUrl ?? null,
    orgLogoUrl: params.orgLogoUrl ?? null,
    orgDefaultBrandLogoUrl: params.orgDefaultBrandLogoUrl ?? null,
    bannerImageUrl: params.bannerImageUrl ?? null,
    brandPrimaryColor: params.brandPrimaryColor ?? null,
    acceptUrl: params.acceptUrl,
    declineUrl: params.declineUrl ?? params.acceptUrl,
    hookCopy: params.hookCopy ?? null,
    closingQuote: params.closingQuote ?? null,
    directionsUrl: params.directionsUrl ?? null,
    siteBaseUrl: params.siteBaseUrl ?? null,
    showPoweredByEventflow: true
  };

  const html = renderInvitationEmailHtml(templateInput);

  return sendTransactionalEmail({
    to: params.to,
    subject: `You're invited: ${params.eventName}`,
    html,
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

export async function sendGuestRemovedFromEventEmail(params: {
  to: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  /** Organisation branding for the email shell. Falls back to "Eventflow". */
  orgName?: string | null;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  /** Optional reply-to / support address surfaced in the "Need help?" card. */
  supportEmail?: string | null;
  resendApiKeyOverride?: string;
}) {
  const html = renderGuestRemovedEmailHtml({
    guestName: params.guestName,
    eventName: params.eventName,
    eventDateLabel: params.eventDate,
    orgName: params.orgName?.trim() || "Eventflow",
    brandLogoUrl: params.brandLogoUrl ?? null,
    orgLogoUrl: params.orgLogoUrl ?? null,
    orgDefaultBrandLogoUrl: params.orgDefaultBrandLogoUrl ?? null,
    brandPrimaryColor: params.brandPrimaryColor ?? null,
    supportEmail: params.supportEmail ?? null
  });

  return sendTransactionalEmail({
    to: params.to,
    subject: `Registration removed: ${params.eventName}`,
    html,
    replyTo: params.supportEmail?.trim() || undefined,
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

export async function sendGuestConfirmationVirtual(params: {
  to: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  zoomSessionKind: ZoomSessionKind;
  /** Shown in email; use tracked Eventflow URL when `zoomLinkTracksAttendance` is true. */
  zoomJoinUrl: string;
  /** When true, `zoomJoinUrl` is a per-guest gateway that records attendance then opens Zoom. */
  zoomLinkTracksAttendance: boolean;
  /** Omitted when the organizer uses per-day external links only. */
  meetingId?: string | null;
  passcode: string | null;
  joinPageUrl?: string | null;
  /** When set, appends a branded "Election & polling" CTA block to the email. */
  poll?: PollEmailNotice | null;
  /** Organisation branding for the email shell. Falls back to "Eventflow". */
  orgName?: string | null;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  resendApiKeyOverride?: string;
}) {
  const sessionLabel =
    params.zoomSessionKind === ZoomSessionKind.MEETING ? "virtual meeting" : "virtual webinar";

  const html = renderRegistrationVirtualEmailHtml({
    guestName: params.guestName,
    eventName: params.eventName,
    eventDateLabel: params.eventDate,
    sessionLabel,
    zoomJoinUrl: params.zoomJoinUrl,
    zoomLinkTracksAttendance: params.zoomLinkTracksAttendance,
    meetingId: params.meetingId ?? null,
    passcode: params.passcode ?? null,
    joinPageUrl: params.joinPageUrl ?? null,
    orgName: params.orgName?.trim() || "Eventflow",
    brandLogoUrl: params.brandLogoUrl ?? null,
    orgLogoUrl: params.orgLogoUrl ?? null,
    orgDefaultBrandLogoUrl: params.orgDefaultBrandLogoUrl ?? null,
    brandPrimaryColor: params.brandPrimaryColor ?? null,
    poll: params.poll ?? null
  });

  return sendTransactionalEmail({
    to: params.to,
    subject: `Your Zoom link: ${params.eventName}`,
    html,
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

export async function sendWorkspaceInviteEmail(params: {
  to: string;
  inviteeName: string;
  orgName: string;
  loginUrl: string;
  resendApiKeyOverride?: string;
}) {
  const html = `
    <p>Hi ${escapeHtml(params.inviteeName)},</p>
    <p><strong>${escapeHtml(params.orgName)}</strong> has added you to Eventflow. Sign in with this email address using a one-time code on the login page.</p>
    <p><a href="${escapeAttr(params.loginUrl)}">Open sign-in</a></p>
    <p style="color:#64748b;font-size:14px">If you did not expect this invitation, you can ignore this email.</p>
    <p>— Eventflow</p>
  `;

  return sendTransactionalEmail({
    to: params.to,
    subject: `You have been invited to ${params.orgName} on Eventflow`,
    html,
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

export async function sendSetupWelcomeEmail(params: {
  to: string;
  adminName: string;
  orgName: string;
  loginUrl: string;
  resendApiKeyOverride?: string;
}) {
  const html = `
    <p>Hi ${escapeHtml(params.adminName)},</p>
    <p>Your Eventflow workspace <strong>${escapeHtml(params.orgName)}</strong> is ready. Sign in with your email and password (or request a one-time code).</p>
    <p><a href="${escapeAttr(params.loginUrl)}">Open sign-in</a></p>
    <p>— Eventflow</p>
  `;

  return sendTransactionalEmail({
    to: params.to,
    subject: `Your Eventflow workspace is ready`,
    html,
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

/**
 * Brand-aligned activation email sent when a platform owner provisions a new
 * organization. The button hits the public `/onboard/activate` route, which
 * marks the workspace as activated and stamps `User.emailVerified` before
 * sending the admin to `/login`.
 *
 * The plan label and 7-day expiry are surfaced so the admin understands what
 * they're getting and how long the link works.
 */
export async function sendOrgActivationEmail(params: {
  to: string;
  adminName: string;
  orgName: string;
  planLabel: string;
  activationUrl: string;
  expiresInDays: number;
  resendApiKeyOverride?: string;
}) {
  const html = `
<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light"/><title>Activate your Eventflow workspace</title></head>
<body style="margin:0;padding:0;background:#f9f9f9;color:#1b1b1b;font-family:'Inter','Manrope',Helvetica,Arial,sans-serif">
  <span style="display:none;font-size:0;color:transparent;line-height:0;max-height:0;max-width:0;overflow:hidden">Activate your ${escapeHtml(params.orgName)} workspace on Eventflow.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9f9f9">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        <tr><td style="padding:32px 28px 8px">
          <p style="margin:0;color:#5e5e5e;font-size:11px;letter-spacing:0.14em;font-weight:600;font-family:'Inter',Helvetica,Arial,sans-serif;text-transform:uppercase">Eventflow Pro · Workspace activation</p>
        </td></tr>
        <tr><td style="padding:8px 28px 24px">
          <h1 style="margin:16px 0 0;color:#000000;font-size:32px;line-height:1.2;letter-spacing:-0.02em;font-weight:800;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">Activate ${escapeHtml(params.orgName)}</h1>
          <p style="margin:12px 0 0;color:#4c4546;font-size:16px;line-height:1.6;font-family:'Inter',Helvetica,Arial,sans-serif">Hi ${escapeHtml(params.adminName)}, your Eventflow workspace has been provisioned on the <strong style="color:#1b1b1b">${escapeHtml(params.planLabel)}</strong> plan. Click the button below to confirm your email and unlock sign-in.</p>
        </td></tr>
        <tr><td align="center" style="padding:8px 28px 28px">
          <a href="${escapeAttr(params.activationUrl)}" style="display:inline-block;padding:14px 28px;background:#000000;color:#ffffff;text-decoration:none;border-radius:6px;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;font-weight:700;font-size:14px;letter-spacing:0.04em">Activate workspace</a>
        </td></tr>
        <tr><td style="padding:0 28px 24px">
          <p style="margin:0;color:#5e5e5e;font-size:13px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">This link is valid for <strong>${params.expiresInDays} day${params.expiresInDays === 1 ? "" : "s"}</strong> and works once. After activation you'll be sent to the sign-in page — Eventflow will email a 6-digit code on every sign-in (no password to remember).</p>
        </td></tr>
        <tr><td style="padding:0 28px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f3f3;border:1px solid #e4e4e7;border-radius:6px">
            <tr><td style="padding:16px 18px">
              <p style="margin:0;color:#5e5e5e;font-size:11px;letter-spacing:0.12em;font-weight:600;text-transform:uppercase;font-family:'Inter',Helvetica,Arial,sans-serif">First steps after sign-in</p>
              <ol style="margin:10px 0 0;padding-left:20px;color:#4c4546;font-size:13px;line-height:1.6;font-family:'Inter',Helvetica,Arial,sans-serif">
                <li>Tweak your sample event (we seeded one as a DRAFT so the dashboard isn't empty).</li>
                <li>Invite teammates from <strong>Settings → Team</strong>.</li>
                <li>Connect Zoom, Resend, and mNotify from <strong>Settings → Integrations</strong>.</li>
                <li>Publish your first real event.</li>
              </ol>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 28px 32px">
          <p style="margin:0;color:#71717a;font-size:12px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">If you weren't expecting this email, you can safely ignore it — the workspace will be deactivated automatically when the link expires. Sent on behalf of the Eventflow platform team.</p>
          <p style="margin:14px 0 0;color:#9c9c9c;font-size:11px;line-height:1.55;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all">${escapeHtml(params.activationUrl)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return sendTransactionalEmail({
    to: params.to,
    subject: `Activate ${params.orgName} on Eventflow`,
    html,
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

export async function sendEventReminderEmail(params: {
  to: string;
  guestName: string;
  eventName: string;
  whenLabel: string;
  locationLabel: string;
  headline: string;
  zoomLink?: string | null;
  qrPayload?: string | null;
  resendApiKeyOverride?: string;
}) {
  const extra: string[] = [];
  if (params.zoomLink) {
    extra.push(`<p><strong>Virtual join:</strong> <a href="${escapeAttr(params.zoomLink)}">${escapeHtml(params.zoomLink)}</a></p>`);
  }
  if (params.qrPayload) {
    extra.push(
      `<p>Your check-in QR payload is registered. Open your original registration email for the QR image, or use the Eventflow join page.</p>`
    );
  }
  const html = `
    <p>Hi ${escapeHtml(params.guestName)},</p>
    <p>${escapeHtml(params.headline)}</p>
    <p><strong>When:</strong> ${escapeHtml(params.whenLabel)}<br/>
    <strong>Where:</strong> ${escapeHtml(params.locationLabel)}</p>
    ${extra.join("\n")}
    <p>— Eventflow</p>
  `;

  return sendTransactionalEmail({
    to: params.to,
    subject: params.headline,
    html,
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

/** Drives subject, headline, and body copy for {@link sendUnifiedRsvpConfirmationEmail}. */
export type UnifiedRsvpConfirmationTone =
  | "receipt"
  | "confirmation"
  | "internal_staff"
  | "conference"
  | "training_workshop";

function unifiedRsvpConfirmationCopy(input: {
  tone: UnifiedRsvpConfirmationTone;
  firstName: string;
  eventName: string;
  eventDate: string;
  isInPerson: boolean;
  postCheckIn?: boolean;
}): {
  subject: string;
  headline: string;
  lede: string;
  preview: string;
  qrHeader: string;
  qrCaption: string;
  calendarHint: string;
} {
  const { firstName, eventName, eventDate, isInPerson } = input;

  if (input.tone === "receipt") {
    if (input.postCheckIn && isInPerson) {
      return {
        subject: `You're checked in: ${eventName}`,
        headline: `You're checked in, ${firstName}.`,
        lede:
          "You're on-site and checked in. Your QR badge is below if staff need to scan you again at registration or session doors.",
        preview: `Check-in confirmed for ${eventName} at ${eventDate}.`,
        qrHeader: "Your attendance badge",
        qrCaption:
          "Save or screenshot this code. Show it if asked at registration or for a quick re-scan during the program.",
        calendarHint: ""
      };
    }
    return {
      subject: `You're checked in: ${eventName}`,
      headline: `You're checked in, ${firstName}.`,
      lede:
        "We've logged your presence for this session. Keep the QR badge below — staff may scan it again as you move between spaces.",
      preview: `Thanks for being there — your check-in for ${eventName} on ${eventDate} is on the books.`,
      qrHeader: "Your attendance badge",
      qrCaption:
        "Proof of attendance — save this badge or screenshot it. Staff may re-scan it during the event.",
      calendarHint: "A calendar invite (.ics) is attached for your records."
    };
  }

  if (input.tone === "internal_staff") {
    const lede = isInPerson
      ? "You're on the internal roster for this run. Keep your QR handy for self check-in at the venue — your organizer may also send a personal check-in link if that mode is enabled."
      : "You're set to join this internal session virtually. Use the Zoom link when it's time; your QR is still included if you attend on-site.";
    return {
      subject: `You're registered — ${eventName}`,
      headline: `Thanks, ${firstName}.`,
      lede,
      preview: `${eventName} — your internal registration is saved for ${eventDate}.`,
      qrHeader: "Your staff check-in QR",
      qrCaption:
        "Save or screenshot this code for a fast check-in. If your program uses personal links, you can use those instead.",
      calendarHint: `A calendar invite (.ics) is attached. Add ${eventName} so you don't miss the session.`
    };
  }

  if (input.tone === "conference") {
    const lede = isInPerson
      ? "You're in the room with us — QR, directions, and a virtual backup are below so you can flex how you experience the program."
      : "Your virtual seat is locked in. Join with Zoom when doors open; your QR is here if plans change and you join us on-site.";
    return {
      subject: `You're in — ${eventName}`,
      headline: `You're in, ${firstName}.`,
      lede,
      preview: `Program pass confirmed — ${eventName}, ${eventDate}.`,
      qrHeader: "Your check-in QR",
      qrCaption: "Keep this badge for express entry at registration and badge check.",
      calendarHint: `A calendar invite (.ics) is attached. Open it once to add ${eventName} to your calendar.`
    };
  }

  if (input.tone === "training_workshop") {
    const lede = isInPerson
      ? "Your seat for this workshop is saved. Materials, directions, and your check-in QR are below — we're looking forward to hosting you."
      : "You're confirmed for the online workshop. Use the Zoom link below at start time. Your QR stays on file if you attend on-site for any part of the day.";
    return {
      subject: `Workshop confirmed — ${eventName}`,
      headline: `All set, ${firstName}.`,
      lede,
      preview: `Workshop confirmation — ${eventName} on ${eventDate}.`,
      qrHeader: "Your workshop QR",
      qrCaption: "Bring this code for quick check-in and session access.",
      calendarHint: `A calendar invite (.ics) is attached. Open it once to add ${eventName} to your calendar.`
    };
  }

  const lede = isInPerson
    ? "We can't wait to see you at the venue. Your QR badge and a Zoom backup are below — bring whichever fits the moment."
    : "Your virtual seat is locked in. Tap the join link when it's time, and keep the QR badge handy in case you decide to swing by the venue.";
  return {
    subject: `You're confirmed: ${eventName}`,
    headline: `You're confirmed, ${firstName}.`,
    lede,
    preview: `You're confirmed for ${eventName} on ${eventDate} — ${isInPerson ? "join us at the venue" : "see you online"}.`,
    qrHeader: "Your check-in QR",
    qrCaption: "Save this email or screenshot the code. Show it at the venue door for a fast check-in.",
    calendarHint: `A calendar invite (.ics) is attached. Open it once to add ${eventName} to your calendar.`
  };
}

/**
 * Phase D unified RSVP confirmation. Always includes BOTH the QR badge and the
 * Zoom join link in the body, plus a calendar `.ics` attachment. The visual
 * primary CTA (and the email tone) adapts to the chosen mode, but every guest
 * gets every asset so they can pivot to the other mode last-minute.
 */
export async function sendUnifiedRsvpConfirmationEmail(params: {
  to: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  locationLine: string;
  attendanceMode: "IN_PERSON" | "VIRTUAL";
  /**
   * `"receipt"` — RSVP doubled as real-time check-in (LIVE + in-person).
   * `"confirmation"` — default neutral program copy.
   * Blueprint-specific tones adjust subject and lede without dropping QR / Zoom / ICS.
   */
  tone?: UnifiedRsvpConfirmationTone;
  qrPngBase64: string | null;
  zoomJoinUrl: string | null;
  joinPageUrl: string | null;
  directionsUrl: string | null;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  orgName: string;
  /** When omitted, no calendar attachment is sent. */
  icsBase64?: string | null;
  /** Post check-in receipt (walk-in booth / door) — onsite copy, no calendar. */
  postCheckIn?: boolean;
  resendApiKeyOverride?: string;
}) {
  const accent = params.brandPrimaryColor?.trim() || "#22d3ee";
  const accentText = pickContrastTextColor(accent);
  const orgInitials = (params.orgName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")) || "EV";
  const isInPerson = params.attendanceMode === "IN_PERSON";
  const firstName = firstNameOf(params.guestName);
  const emailTone: UnifiedRsvpConfirmationTone = params.tone ?? "confirmation";
  const logoUrl = resolveEmailBrandLogoUrl({
    eventBrandLogoUrl: params.brandLogoUrl,
    orgLogoUrl: params.orgLogoUrl,
    orgDefaultBrandLogoUrl: params.orgDefaultBrandLogoUrl
  });
  const copy = unifiedRsvpConfirmationCopy({
    tone: emailTone,
    firstName,
    eventName: params.eventName,
    eventDate: params.eventDate,
    isInPerson,
    postCheckIn: params.postCheckIn
  });

  const orgBlock = logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="${escapeAttr(params.orgName)}" width="48" height="48" style="display:inline-block;border-radius:12px;object-fit:cover;background:#0a0a0a"/>`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:${accent};color:${accentText};font-weight:800;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;font-size:20px">${escapeHtml(orgInitials)}</span>`;

  const qrBlock = params.qrPngBase64
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;background:#ffffff;border-radius:18px"><tr><td align="center" style="padding:20px"><p style="margin:0;color:#0a0a0a;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${escapeHtml(copy.qrHeader)}</p><img src="cid:check-in-qr.png" alt="Check-in QR code" width="220" height="220" style="margin-top:12px;display:inline-block;width:220px;height:220px;border:1px solid #f4f4f5;border-radius:12px"/><p style="margin:10px 0 0;color:#52525b;font-size:11px;font-family:'Inter',Helvetica,Arial,sans-serif">${escapeHtml(copy.qrCaption)}</p></td></tr></table>`
    : "";

  const zoomBlock = params.zoomJoinUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;background:#ffffff;border-radius:18px"><tr><td align="center" style="padding:20px"><p style="margin:0;color:#0a0a0a;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">Virtual join link</p><p style="margin:10px 0 0;color:#3f3f46;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif">Tap to enter the live session. Works from desktop, mobile, or the Zoom app.</p><p style="margin:14px 0 0"><a href="${escapeAttr(params.zoomJoinUrl)}" style="display:inline-block;padding:12px 22px;background:${accent};color:${accentText};text-decoration:none;border-radius:10px;font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">Join Zoom</a></p></td></tr></table>`
    : "";

  const joinPageBlock = params.joinPageUrl
    ? `<p style="margin:18px 24px 0;color:#a1a1aa;font-size:12px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif;text-align:center">Bookmark your join page: <a href="${escapeAttr(params.joinPageUrl)}" style="color:${accent};text-decoration:none">${escapeHtml(params.joinPageUrl)}</a></p>`
    : "";

  const directionsLink = params.directionsUrl
    ? ` · <a href="${escapeAttr(params.directionsUrl)}" style="color:${accent};font-weight:600;text-decoration:none">Get Directions ↗</a>`
    : "";

  const html = `
<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark light"/><title>${escapeHtml(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#000;color:#e4e4e7;font-family:'Inter','Manrope',Helvetica,Arial,sans-serif">
  <span style="display:none;font-size:0;color:transparent;line-height:0;max-height:0;max-width:0;overflow:hidden">${escapeHtml(copy.preview)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#000">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#000;border:1px solid #18181b;border-radius:24px">
        <tr><td align="center" style="padding:32px 24px 8px">
          ${orgBlock}
          <p style="margin:12px 0 0;color:#71717a;font-size:11px;letter-spacing:0.18em;font-weight:700;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;text-transform:uppercase">${escapeHtml(params.orgName)}</p>
        </td></tr>
        <tr><td align="center" style="padding:24px 24px 0;border-top:1px solid #18181b">
          <h1 style="margin:32px 0 0;color:#ffffff;font-size:30px;line-height:1.15;letter-spacing:-0.02em;font-weight:800;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${escapeHtml(copy.headline)}</h1>
          <p style="margin:12px 0 0;color:#a1a1aa;font-size:14px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">${escapeHtml(copy.lede)}</p>
        </td></tr>
        <tr><td style="height:24px;line-height:24px;font-size:0">&nbsp;</td></tr>
        <tr><td align="center" style="padding:0 24px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-radius:18px"><tr><td align="center" style="padding:24px">
            <p style="margin:0;color:#0a0a0a;font-size:18px;line-height:1.3;font-weight:700;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${escapeHtml(params.eventName)}</p>
            <p style="margin:10px 0 0;color:#3f3f46;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif">📅 ${escapeHtml(params.eventDate)}</p>
            <p style="margin:6px 0 0;color:#3f3f46;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif">📍 ${escapeHtml(params.locationLine)}${directionsLink}</p>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:0 24px">${qrBlock}${zoomBlock}</td></tr>
        ${joinPageBlock}
        <tr><td align="center" style="padding:32px 32px 24px;border-top:1px solid #18181b;margin-top:24px">
          ${
            copy.calendarHint
              ? `<p style="margin:0;color:#71717a;font-size:11px;line-height:1.6;letter-spacing:0.08em;font-family:'Inter',Helvetica,Arial,sans-serif;text-transform:uppercase">${escapeHtml(copy.calendarHint)}</p>`
              : ""
          }
          <p style="margin:${copy.calendarHint ? "14px" : "0"} 0 0;color:#52525b;font-size:11px;letter-spacing:0.08em;font-family:'Inter',Helvetica,Arial,sans-serif">Sent by ${escapeHtml(params.orgName)} via Eventflow.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const attachments: Array<{ filename: string; content: string; contentId?: string }> = [];
  if (params.qrPngBase64) {
    attachments.push({
      filename: "check-in-qr.png",
      content: params.qrPngBase64,
      contentId: "check-in-qr.png"
    });
  }
  if (params.icsBase64?.trim()) {
    attachments.push({
      filename: `${slugForFile(params.eventName)}.ics`,
      content: params.icsBase64
    });
  }

  return sendTransactionalEmail({
    to: params.to,
    subject: copy.subject,
    html,
    attachments,
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

function firstNameOf(name: string): string {
  const f = name.trim().split(/\s+/)[0];
  return f && f.length > 0 ? f : "there";
}

function slugForFile(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event"
  );
}

function pickContrastTextColor(hex: string): string {
  const t = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return "#ffffff";
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0a0a" : "#ffffff";
}

export async function sendInternalStaffPersonalCheckInLinkEmail(params: {
  to: string;
  guestName: string;
  eventName: string;
  whenLabel: string;
  locationLabel: string;
  checkInUrl: string;
  resendApiKeyOverride?: string;
}) {
  const html = `
    <p>Hi ${escapeHtml(params.guestName)},</p>
    <p>You are invited to <strong>${escapeHtml(params.eventName)}</strong>.</p>
    <p><strong>When:</strong> ${escapeHtml(params.whenLabel)}<br/>
    <strong>Where:</strong> ${escapeHtml(params.locationLabel)}</p>
    <p>Use your personal link below to check in. This link is for you only — do not forward it.</p>
    <p><a href="${escapeAttr(params.checkInUrl)}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Check in</a></p>
    <p style="color:#64748b;font-size:13px">If the button does not work, copy and paste this URL:<br/>
    <span style="word-break:break-all">${escapeHtml(params.checkInUrl)}</span></p>
    <p>— Eventflow</p>
  `;

  return sendTransactionalEmail({
    to: params.to,
    subject: `Check in: ${params.eventName}`,
    html,
    resendApiKeyOverride: params.resendApiKeyOverride
  });
}

export {
  internalStaffNoticeEmailSubject,
  renderInternalStaffNoticeEmailHtml
} from "@/lib/email/internalStaffNoticeTemplate";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;");
}
