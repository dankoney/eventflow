import { sendTransactionalEmail } from "@/lib/email";
import { phoneToMnotifyRecipient, sendOrgMnotifyQuickSms } from "@/lib/mnotify";

export type PollOtpDeliveryChannel = "email" | "sms";

/**
 * Build the light, brand-aligned OTP email (Manrope headlines, Inter body).
 */
function renderPollOtpEmailHtml(input: {
  guestName: string;
  eventName: string;
  orgName: string;
  code: string;
  brandPrimaryColor: string;
  expiresMinutes: number;
  isAnonymous: boolean;
}): string {
  const { guestName, eventName, orgName, code, brandPrimaryColor, expiresMinutes, isAnonymous } = input;
  const accent = (brandPrimaryColor || "#00677e").trim() || "#00677e";
  const accentText = pickContrastTextColor(accent);
  const preview = `Your ${expiresMinutes}-minute voting code for ${eventName}.`;
  const ballotPrivacy = isAnonymous
    ? "Enter this code on the voting page to cast your ballot. Your vote is anonymous — we only record that you participated, never how you voted."
    : "Enter this code on the voting page to cast your ballot. This poll is not anonymous — the organizer can see how each guest voted.";
  return `
<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light"/><title>Your voting code</title></head>
<body style="margin:0;padding:0;background:#f9f9f9;color:#1b1b1b;font-family:'Inter','Manrope',Helvetica,Arial,sans-serif">
  <span style="display:none;font-size:0;color:transparent;line-height:0;max-height:0;max-width:0;overflow:hidden">${escapeHtml(preview)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9f9f9">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        <tr><td align="center" style="padding:28px 24px 8px">
          <p style="margin:0;color:#5e5e5e;font-size:11px;letter-spacing:0.14em;font-weight:600;font-family:'Inter',Helvetica,Arial,sans-serif;text-transform:uppercase">${escapeHtml(orgName)} · Identity verification</p>
        </td></tr>
        <tr><td align="center" style="padding:16px 24px 0">
          <h1 style="margin:8px 0 0;color:#000000;font-size:28px;line-height:1.2;letter-spacing:-0.02em;font-weight:800;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">Your voting code</h1>
          <p style="margin:12px 0 0;color:#4c4546;font-size:15px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">Hi ${escapeHtml(firstNameOf(guestName))}, use this one-time code to open your ballot for <strong style="color:#1b1b1b">${escapeHtml(eventName)}</strong>.</p>
        </td></tr>
        <tr><td style="height:20px;line-height:20px;font-size:0">&nbsp;</td></tr>
        <tr><td align="center" style="padding:0 24px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f3f3;border:1px solid #e4e4e7;border-radius:6px"><tr><td align="center" style="padding:24px 20px">
            <p style="margin:0;color:#5e5e5e;font-size:11px;letter-spacing:0.12em;font-weight:600;text-transform:uppercase;font-family:'Inter',Helvetica,Arial,sans-serif">Verification code</p>
            <p style="margin:14px 0 0;color:#1b1b1b;font-size:36px;letter-spacing:0.28em;font-weight:800;font-family:ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace">${escapeHtml(code)}</p>
            <p style="margin:12px 0 0;color:#71717a;font-size:12px;font-family:'Inter',Helvetica,Arial,sans-serif">Expires in ${expiresMinutes} minutes</p>
          </td></tr></table>
        </td></tr>
        <tr><td align="center" style="padding:22px 28px 0">
          <p style="margin:0;color:#4c4546;font-size:14px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">${escapeHtml(ballotPrivacy)}</p>
        </td></tr>
        <tr><td align="center" style="padding:24px 28px 32px">
          <p style="margin:0;color:#71717a;font-size:11px;line-height:1.5;font-family:'Inter',Helvetica,Arial,sans-serif">If you did not request this code, you can ignore this email. The code stops working in ${expiresMinutes} minutes. Sent by ${escapeHtml(orgName)} via Eventflow.</p>
          <span style="display:inline-block;margin-top:14px;padding:8px 14px;background:${accent};color:${accentText};border-radius:999px;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;font-weight:700;font-size:10px;letter-spacing:0.14em;text-transform:uppercase">Eventflow ballots</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderPollOtpSmsBody(input: {
  eventName: string;
  code: string;
  expiresMinutes: number;
  isAnonymous: boolean;
}): string {
  const privacy = input.isAnonymous
    ? "Anonymous ballot."
    : "Attributed ballot — organizer can see your vote.";
  return `Your Eventflow voting code for ${input.eventName.slice(0, 50)} is ${input.code}. Expires in ${input.expiresMinutes} min. ${privacy} Do not share.`;
}

/**
 * Attempt both delivery channels in parallel. Returns the list of channels that
 * actually succeeded so the UI can label the resend button accurately. Errors from
 * individual channels are swallowed and reported as "channel did not succeed" —
 * callers should reject the action when `channels.length === 0`.
 */
export async function deliverPollOtp(input: {
  code: string;
  expiresMinutes: number;
  guest: { name: string; email: string | null; phone: string | null };
  event: { name: string };
  org: { id: string; name: string; resendApiKey: string | null; brandPrimaryColor: string | null };
  isAnonymous: boolean;
}): Promise<{ channels: PollOtpDeliveryChannel[]; errors: Record<PollOtpDeliveryChannel, string | null> }> {
  const errors: Record<PollOtpDeliveryChannel, string | null> = { email: null, sms: null };
  const channels: PollOtpDeliveryChannel[] = [];

  const emailKey = input.org.resendApiKey?.trim() || process.env.RESEND_API_KEY;
  const smsRecipient = phoneToMnotifyRecipient(input.guest.phone);

  const emailJob: Promise<void> = (async () => {
    if (!emailKey) {
      errors.email = "Email delivery is not configured for this workspace.";
      return;
    }
    const trimmedEmail = (input.guest.email ?? "").trim();
    if (!trimmedEmail) {
      errors.email = "No email address on file for this guest.";
      return;
    }
    try {
      await sendTransactionalEmail({
        to: trimmedEmail,
        subject: `Your voting code for ${input.event.name}`,
        html: renderPollOtpEmailHtml({
          guestName: input.guest.name,
          eventName: input.event.name,
          orgName: input.org.name,
          code: input.code,
          brandPrimaryColor: input.org.brandPrimaryColor ?? "#00677e",
          expiresMinutes: input.expiresMinutes,
          isAnonymous: input.isAnonymous
        }),
        resendApiKeyOverride: input.org.resendApiKey?.trim() || undefined
      });
      channels.push("email");
    } catch (error) {
      errors.email = error instanceof Error ? error.message.slice(0, 240) : "Email delivery failed.";
    }
  })();

  const smsJob: Promise<void> = (async () => {
    if (!smsRecipient) {
      errors.sms = "No usable phone number on file for this guest.";
      return;
    }
    try {
      const res = await sendOrgMnotifyQuickSms(input.org.id, [smsRecipient], renderPollOtpSmsBody({
        eventName: input.event.name,
        code: input.code,
        expiresMinutes: input.expiresMinutes,
        isAnonymous: input.isAnonymous
      }));
      if (res.ok) {
        channels.push("sms");
      } else {
        errors.sms = res.error ?? "mNotify rejected the SMS.";
      }
    } catch (error) {
      errors.sms = error instanceof Error ? error.message.slice(0, 240) : "SMS delivery failed.";
    }
  })();

  await Promise.all([emailJob, smsJob]);

  return { channels, errors };
}

function firstNameOf(name: string): string {
  const f = name.trim().split(/\s+/)[0];
  return f && f.length > 0 ? f : "there";
}

function pickContrastTextColor(hex: string): string {
  const t = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return "#ffffff";
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0a0a" : "#ffffff";
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
