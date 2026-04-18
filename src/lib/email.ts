import { ZoomSessionKind } from "@prisma/client";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Base64-encoded file bodies */
  attachments?: Array<{ filename: string; content: string }>;
  /** When set, overrides RESEND_API_KEY (org-specific key). */
  resendApiKeyOverride?: string;
};

function defaultFrom() {
  return process.env.RESEND_FROM ?? "Eventflow <onboarding@resend.dev>";
}

export async function sendTransactionalEmail(input: SendEmailInput) {
  const apiKey = input.resendApiKeyOverride ?? process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");

  const body: Record<string, unknown> = {
    from: defaultFrom(),
    to: [input.to],
    subject: input.subject,
    html: input.html
  };
  if (input.attachments?.length) {
    body.attachments = input.attachments;
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
  resendApiKeyOverride?: string;
}) {
  const html = `
    <p>Hi ${escapeHtml(params.guestName)},</p>
    <p>You are registered for <strong>${escapeHtml(params.eventName)}</strong>.</p>
    <p><strong>When:</strong> ${escapeHtml(params.eventDate)}<br/>
    <strong>Where:</strong> ${escapeHtml(params.location)}</p>
    <p>Your check-in QR code is attached. Present it at the venue.</p>
    <p>— Eventflow</p>
  `;

  return sendTransactionalEmail({
    to: params.to,
    subject: `You are registered: ${params.eventName}`,
    html,
    attachments: [{ filename: "check-in-qr.png", content: params.qrPngBase64 }],
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
  meetingId: string;
  passcode: string | null;
  joinPageUrl?: string | null;
  resendApiKeyOverride?: string;
}) {
  const sessionLabel =
    params.zoomSessionKind === ZoomSessionKind.MEETING ? "virtual meeting" : "virtual webinar";
  const joinHint =
    params.zoomSessionKind === ZoomSessionKind.MEETING
      ? "Save this link — your join hub and Zoom details (you can confirm attendance there too)."
      : "Save this link — it has your personal Zoom access and lets you confirm attendance.";
  const joinBlock = params.joinPageUrl
    ? `<p><strong>Your join page:</strong> <a href="${escapeAttr(params.joinPageUrl)}">${escapeHtml(params.joinPageUrl)}</a><br/><span style="color:#64748b;font-size:14px">${joinHint}</span></p>`
    : "";

  const zoomLinkLabel = "Join Zoom (your personal link)";

  const attendanceNote = params.zoomLinkTracksAttendance
    ? "Opening the Join Zoom link above records your attendance in Eventflow, then sends you to your personal Zoom session."
    : "Attendance in Eventflow is recorded when you use your join page and tap confirm — use the same email link if your app opens Zoom directly.";

  const html = `
    <p>Hi ${escapeHtml(params.guestName)},</p>
    <p>You are registered for <strong>${escapeHtml(params.eventName)}</strong> (${sessionLabel}).</p>
    <p><strong>When:</strong> ${escapeHtml(params.eventDate)}</p>
    ${joinBlock}
    <p><strong>${zoomLinkLabel}:</strong> <a href="${escapeAttr(params.zoomJoinUrl)}">${escapeHtml(params.zoomJoinUrl)}</a></p>
    <p><strong>Meeting ID:</strong> ${escapeHtml(params.meetingId)}<br/>
    ${params.passcode ? `<strong>Passcode:</strong> ${escapeHtml(params.passcode)}` : ""}</p>
    <p style="color:#64748b;font-size:14px">${attendanceNote}</p>
    <p>— Eventflow</p>
  `;

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
