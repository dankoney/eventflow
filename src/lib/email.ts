type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Base64-encoded file bodies */
  attachments?: Array<{ filename: string; content: string }>;
};

function defaultFrom() {
  return process.env.RESEND_FROM ?? "Eventflow <onboarding@resend.dev>";
}

export async function sendTransactionalEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
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

  if (!response.ok) throw new Error("Failed to send email");
  return response.json() as Promise<{ id?: string }>;
}

export async function sendGuestConfirmationInPerson(params: {
  to: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  location: string;
  qrPngBase64: string;
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
    attachments: [{ filename: "check-in-qr.png", content: params.qrPngBase64 }]
  });
}

export async function sendGuestConfirmationVirtual(params: {
  to: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  zoomJoinUrl: string;
  meetingId: string;
  passcode: string | null;
  joinPageUrl?: string | null;
}) {
  const joinBlock = params.joinPageUrl
    ? `<p><strong>Your join page:</strong> <a href="${escapeAttr(params.joinPageUrl)}">${escapeHtml(params.joinPageUrl)}</a><br/><span style="color:#64748b;font-size:14px">Save this link — it has your Zoom details and lets you confirm attendance.</span></p>`
    : "";

  const html = `
    <p>Hi ${escapeHtml(params.guestName)},</p>
    <p>You are registered for <strong>${escapeHtml(params.eventName)}</strong> (virtual).</p>
    <p><strong>When:</strong> ${escapeHtml(params.eventDate)}</p>
    ${joinBlock}
    <p><strong>Join Zoom:</strong> <a href="${escapeAttr(params.zoomJoinUrl)}">${escapeHtml(params.zoomJoinUrl)}</a></p>
    <p><strong>Meeting ID:</strong> ${escapeHtml(params.meetingId)}<br/>
    ${params.passcode ? `<strong>Passcode:</strong> ${escapeHtml(params.passcode)}` : ""}</p>
    <p>— Eventflow</p>
  `;

  return sendTransactionalEmail({
    to: params.to,
    subject: `Your Zoom link: ${params.eventName}`,
    html
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
