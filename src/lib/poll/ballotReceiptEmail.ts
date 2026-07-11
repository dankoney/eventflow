import { sendTransactionalEmail } from "@/lib/email";
import { phoneToMnotifyRecipient, sendOrgMnotifyQuickSms } from "@/lib/mnotify";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pickContrastTextColor(hex: string): string {
  const t = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return "#ffffff";
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0a0a" : "#ffffff";
}

/**
 * A single per-position line as it will appear on the attributed-mode receipt.
 * - `positionTitle`: contest name (e.g. "President").
 * - `selection`: pre-rendered human label (e.g. "Jane Doe", "Yes — confidence",
 *   "No — confidence", "Abstain"). The caller is responsible for the wording so
 *   admin-side admin-only nuances (candidate role lines, etc.) stay out.
 */
export type BallotReceiptChoiceLine = {
  positionTitle: string;
  selection: string;
};

function renderChoicesBlock(choices: BallotReceiptChoiceLine[], accent: string): string {
  if (choices.length === 0) return "";
  const rows = choices
    .map(
      (c) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #ececec;color:#5e5e5e;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;width:38%;vertical-align:top">${escapeHtml(c.positionTitle)}</td>
              <td style="padding:10px 0 10px 12px;border-bottom:1px solid #ececec;color:#1b1b1b;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.4;font-weight:700">${escapeHtml(c.selection)}</td>
            </tr>`
    )
    .join("");
  return `
        <tr><td style="padding:0 28px 8px">
          <p style="margin:0 0 8px;color:#5e5e5e;font-size:11px;letter-spacing:0.14em;font-weight:600;text-transform:uppercase;font-family:'Inter',Helvetica,Arial,sans-serif">Your selections</p>
        </td></tr>
        <tr><td style="padding:0 28px 24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e4e4e7;border-radius:6px;background:#ffffff">
            <tr><td style="padding:4px 18px 4px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rows}
              </table>
              <p style="margin:14px 0 4px;color:${accent};font-size:12px;font-weight:600;font-family:'Inter',Helvetica,Arial,sans-serif">This poll is not anonymous — the organizer can see how you voted.</p>
            </td></tr>
          </table>
        </td></tr>`;
}

function renderPollBallotReceiptEmailHtml(input: {
  guestFirstName: string;
  eventName: string;
  orgName: string;
  pollTitle: string;
  receiptRef: string;
  brandPrimaryColor: string;
  /** When provided, renders the attributed-mode receipt with selections. */
  choices: BallotReceiptChoiceLine[] | null;
}): string {
  const accent = (input.brandPrimaryColor || "#00677e").trim() || "#00677e";
  const accentText = pickContrastTextColor(accent);
  const preview = `Your ballot for ${input.eventName} was recorded.`;
  const hasChoices = input.choices !== null && input.choices.length > 0;
  const anonymityNote = hasChoices
    ? `<p style="margin:14px 0 0;color:#5e5e5e;font-size:12px;font-weight:500;font-family:'Inter',Helvetica,Arial,sans-serif">Quote this ID if you need the organizer to look up your ballot.</p>`
    : `<p style="margin:14px 0 0;color:#00677e;font-size:12px;font-weight:600;font-family:'Inter',Helvetica,Arial,sans-serif">Your vote is anonymized. We record that you participated, not how you voted.</p>`;
  return `
<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light"/><title>Vote recorded</title></head>
<body style="margin:0;padding:0;background:#f9f9f9;color:#1b1b1b;font-family:'Inter','Manrope',Helvetica,Arial,sans-serif">
  <span style="display:none;font-size:0;color:transparent;line-height:0;max-height:0;max-width:0;overflow:hidden">${escapeHtml(preview)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9f9f9">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        <tr><td style="padding:32px 28px 8px">
          <p style="margin:0;color:#5e5e5e;font-size:11px;letter-spacing:0.14em;font-weight:600;font-family:'Inter',Helvetica,Arial,sans-serif;text-transform:uppercase">${escapeHtml(input.orgName)} · Ballot receipt</p>
        </td></tr>
        <tr><td style="padding:8px 28px 24px">
          <h1 style="margin:16px 0 0;color:#000000;font-size:32px;line-height:1.2;letter-spacing:-0.02em;font-weight:800;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">Vote recorded</h1>
          <p style="margin:12px 0 0;color:#4c4546;font-size:16px;line-height:1.6;font-family:'Inter',Helvetica,Arial,sans-serif">Hi ${escapeHtml(input.guestFirstName)}, your selections for <strong style="color:#1b1b1b">${escapeHtml(input.pollTitle)}</strong> on <strong style="color:#1b1b1b">${escapeHtml(input.eventName)}</strong> were received.</p>
        </td></tr>
        ${hasChoices ? renderChoicesBlock(input.choices!, accent) : ""}
        <tr><td style="padding:0 28px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f3f3;border:1px solid #e4e4e7;border-radius:6px">
            <tr><td style="padding:16px 18px">
              <p style="margin:0;color:#5e5e5e;font-size:11px;letter-spacing:0.12em;font-weight:600;text-transform:uppercase;font-family:'Inter',Helvetica,Arial,sans-serif">Submission reference</p>
              <p style="margin:10px 0 0;color:#4c4546;font-size:13px;line-height:1.5;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all">${escapeHtml(input.receiptRef)}</p>
              ${anonymityNote}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 28px 32px">
          <p style="margin:0;color:#71717a;font-size:12px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">Keep this email for your records. If you did not submit this ballot, contact the event organizer immediately. Sent by ${escapeHtml(input.orgName)} via Eventflow.</p>
          <span style="display:inline-block;margin-top:16px;padding:8px 14px;background:${accent};color:${accentText};border-radius:999px;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;font-weight:700;font-size:10px;letter-spacing:0.14em;text-transform:uppercase">Eventflow ballots</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Best-effort confirmation after a successful ballot. Failures are logged only — the
 * vote is already committed. Pass `choices: null` for anonymous polls (no per-vote
 * detail is rendered); pass `choices: [...]` for attributed polls to echo the voter's
 * selections back to them.
 */
export async function sendPollBallotReceiptEmail(input: {
  to: string;
  guestFirstName: string;
  eventName: string;
  orgName: string;
  pollTitle: string;
  receiptRef: string;
  brandPrimaryColor: string | null;
  choices: BallotReceiptChoiceLine[] | null;
  resendApiKeyOverride?: string;
}): Promise<void> {
  const trimmed = input.to.trim();
  if (!trimmed) return;

  const emailKey = input.resendApiKeyOverride?.trim() || process.env.RESEND_API_KEY;
  if (!emailKey) return;

  await sendTransactionalEmail({
    to: trimmed,
    subject: `Vote recorded — ${input.eventName}`,
    html: renderPollBallotReceiptEmailHtml({
      guestFirstName: input.guestFirstName,
      eventName: input.eventName,
      orgName: input.orgName,
      pollTitle: input.pollTitle,
      receiptRef: input.receiptRef,
      brandPrimaryColor: input.brandPrimaryColor ?? "#00677e",
      choices: input.choices
    }),
    resendApiKeyOverride: input.resendApiKeyOverride?.trim() || undefined
  });
}

/**
 * Best-effort SMS echo of an attributed ballot. Skips silently when no phone,
 * mNotify is off, or the message would be empty. Keep under ~300 chars for a
 * single GSM segment when possible.
 */
export function buildPollBallotReceiptSmsBody(input: {
  eventName: string;
  pollTitle: string;
  receiptRef: string;
  choices: BallotReceiptChoiceLine[];
}): string {
  const parts = input.choices.map((c) => {
    const pos = c.positionTitle.slice(0, 24);
    const sel = c.selection.slice(0, 40);
    return `${pos}: ${sel}`;
  });
  let body = `Eventflow: Vote recorded for ${input.pollTitle.slice(0, 40)} @ ${input.eventName.slice(0, 36)}. `;
  body += parts.join(" | ");
  body += ` Ref ${input.receiptRef.slice(0, 8)}…`;
  if (body.length > 480) {
    body = body.slice(0, 477) + "...";
  }
  return body;
}

export async function sendPollBallotReceiptSms(input: {
  orgId: string;
  phone: string | null | undefined;
  eventName: string;
  pollTitle: string;
  receiptRef: string;
  choices: BallotReceiptChoiceLine[];
}): Promise<void> {
  const recipient = phoneToMnotifyRecipient(input.phone);
  if (!recipient || input.choices.length === 0) return;
  const message = buildPollBallotReceiptSmsBody({
    eventName: input.eventName,
    pollTitle: input.pollTitle,
    receiptRef: input.receiptRef,
    choices: input.choices
  });
  const res = await sendOrgMnotifyQuickSms(input.orgId, [recipient], message);
  if (!res.ok) {
    console.error("[sendPollBallotReceiptSms]", res.error ?? "unknown");
  }
}
