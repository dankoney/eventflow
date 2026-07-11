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

function firstNameOf(name: string): string {
  const f = name.trim().split(/\s+/)[0];
  return f && f.length > 0 ? f : "there";
}

/**
 * Lightweight, top-line summary shown above the "View results" CTA in the email body
 * and embedded into the SMS. Generated server-side so individual sends stay cheap.
 */
export type PollResultsSummary = {
  ballotsCast: number;
  totalGuests: number;
  turnoutPct: number;
  positionLines: string[];
};

function renderPollResultsEmailHtml(input: {
  guestFirstName: string;
  eventName: string;
  orgName: string;
  pollTitle: string;
  resultsUrl: string;
  brandPrimaryColor: string;
  summary: PollResultsSummary;
  customMessage: string | null;
}): string {
  const accent = (input.brandPrimaryColor || "#00677e").trim() || "#00677e";
  const accentText = pickContrastTextColor(accent);
  const preview = `Results for ${input.pollTitle} are now published — ${input.summary.ballotsCast.toLocaleString()} ballots cast.`;
  const lines = input.summary.positionLines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0;color:#1b1b1b;font-size:14px;font-family:'Inter',Helvetica,Arial,sans-serif">${escapeHtml(
          l
        )}</td></tr>`
    )
    .join("");
  return `
<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light"/><title>Election results</title></head>
<body style="margin:0;padding:0;background:#f9f9f9;color:#1b1b1b;font-family:'Inter','Manrope',Helvetica,Arial,sans-serif">
  <span style="display:none;font-size:0;color:transparent;line-height:0;max-height:0;max-width:0;overflow:hidden">${escapeHtml(
    preview
  )}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9f9f9">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        <tr><td style="padding:32px 28px 8px">
          <p style="margin:0;color:#5e5e5e;font-size:11px;letter-spacing:0.14em;font-weight:600;font-family:'Inter',Helvetica,Arial,sans-serif;text-transform:uppercase">${escapeHtml(
            input.orgName
          )} · Election results</p>
        </td></tr>
        <tr><td style="padding:8px 28px 24px">
          <h1 style="margin:16px 0 0;color:#000000;font-size:30px;line-height:1.2;letter-spacing:-0.02em;font-weight:800;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${escapeHtml(
            input.pollTitle
          )}</h1>
          <p style="margin:8px 0 0;color:#5e5e5e;font-size:14px;line-height:1.5;font-family:'Inter',Helvetica,Arial,sans-serif">${escapeHtml(
            input.eventName
          )}</p>
          <p style="margin:18px 0 0;color:#4c4546;font-size:16px;line-height:1.6;font-family:'Inter',Helvetica,Arial,sans-serif">Hi ${escapeHtml(
            input.guestFirstName
          )}, the official results for this ballot are now published.</p>
          ${
            input.customMessage?.trim()
              ? `<div style="margin:18px 0 0;padding:14px 16px;background:#f3f3f3;border:1px solid #e4e4e7;border-radius:6px;color:#1b1b1b;font-size:14px;line-height:1.6;font-family:'Inter',Helvetica,Arial,sans-serif;white-space:pre-wrap">${escapeHtml(
                  input.customMessage.trim()
                )}</div>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:0 28px 12px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;border:1px solid #e4e4e7;border-radius:6px">
            <tr><td style="padding:16px 18px">
              <p style="margin:0;color:#5e5e5e;font-size:11px;letter-spacing:0.12em;font-weight:600;text-transform:uppercase;font-family:'Inter',Helvetica,Arial,sans-serif">Turnout</p>
              <p style="margin:8px 0 0;color:#1b1b1b;font-size:18px;font-weight:700;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${input.summary.ballotsCast.toLocaleString()} of ${input.summary.totalGuests.toLocaleString()} eligible · ${input.summary.turnoutPct}%</p>
            </td></tr>
          </table>
        </td></tr>
        ${
          lines
            ? `<tr><td style="padding:0 28px 24px">
                <p style="margin:18px 0 8px;color:#5e5e5e;font-size:11px;letter-spacing:0.12em;font-weight:600;text-transform:uppercase;font-family:'Inter',Helvetica,Arial,sans-serif">Highlights</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lines}</table>
              </td></tr>`
            : ""
        }
        <tr><td align="center" style="padding:8px 28px 28px">
          <a href="${escapeHtml(
            input.resultsUrl
          )}" style="display:inline-block;padding:14px 24px;background:#000000;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;border-radius:6px">View full results</a>
          <p style="margin:14px 0 0;color:#71717a;font-size:12px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">Or open: <a href="${escapeHtml(
            input.resultsUrl
          )}" style="color:#00677e;text-decoration:underline;word-break:break-all">${escapeHtml(input.resultsUrl)}</a></p>
        </td></tr>
        <tr><td style="padding:0 28px 32px">
          <p style="margin:0;color:#71717a;font-size:12px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">Anonymous ballot — choices are not linked to voters. Sent by ${escapeHtml(
            input.orgName
          )} via Eventflow.</p>
          <span style="display:inline-block;margin-top:16px;padding:8px 14px;background:${accent};color:${accentText};border-radius:999px;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;font-weight:700;font-size:10px;letter-spacing:0.14em;text-transform:uppercase">Eventflow ballots</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderPollResultsSms(input: {
  orgName: string;
  pollTitle: string;
  resultsUrl: string;
  summary: PollResultsSummary;
}): string {
  const base = `${input.orgName}: results for ${input.pollTitle.slice(0, 60)} are out. Turnout ${input.summary.turnoutPct}% (${input.summary.ballotsCast}/${input.summary.totalGuests}).`;
  const headline = input.summary.positionLines[0] ? ` ${input.summary.positionLines[0].slice(0, 80)}.` : "";
  return `${base}${headline} View: ${input.resultsUrl}`.slice(0, 480);
}

export type PollResultsBroadcastChannel = "email" | "sms";

export type PollResultsBroadcastTarget = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type PollResultsBroadcastResult = {
  emailsAttempted: number;
  emailsSent: number;
  emailsSkipped: number;
  smsAttempted: number;
  smsSent: number;
  smsSkipped: number;
  errors: string[];
};

/**
 * Broadcast results to every targeted guest. Emails are sent individually so guests
 * don't see each other's addresses; SMS is dispatched as one bulk mNotify campaign
 * since the body is identical across recipients.
 */
export async function broadcastPollResults(input: {
  channels: PollResultsBroadcastChannel[];
  targets: PollResultsBroadcastTarget[];
  pollTitle: string;
  eventName: string;
  org: { id: string; name: string; brandPrimaryColor: string | null; resendApiKey: string | null };
  resultsUrl: string;
  summary: PollResultsSummary;
  customMessage: string | null;
}): Promise<PollResultsBroadcastResult> {
  const errors: string[] = [];
  const wantEmail = input.channels.includes("email");
  const wantSms = input.channels.includes("sms");

  let emailsAttempted = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;
  let smsAttempted = 0;
  let smsSent = 0;
  let smsSkipped = 0;

  if (wantEmail) {
    const emailKey = input.org.resendApiKey?.trim() || process.env.RESEND_API_KEY;
    if (!emailKey) {
      errors.push("Email delivery is not configured (set RESEND_API_KEY or the workspace key).");
    } else {
      const subject = `Results — ${input.pollTitle}`;
      for (const target of input.targets) {
        const to = target.email?.trim();
        if (!to) {
          emailsSkipped += 1;
          continue;
        }
        emailsAttempted += 1;
        try {
          await sendTransactionalEmail({
            to,
            subject,
            html: renderPollResultsEmailHtml({
              guestFirstName: firstNameOf(target.name),
              eventName: input.eventName,
              orgName: input.org.name,
              pollTitle: input.pollTitle,
              resultsUrl: input.resultsUrl,
              brandPrimaryColor: input.org.brandPrimaryColor ?? "#00677e",
              summary: input.summary,
              customMessage: input.customMessage
            }),
            resendApiKeyOverride: input.org.resendApiKey?.trim() || undefined
          });
          emailsSent += 1;
        } catch (err) {
          emailsSkipped += 1;
          errors.push(
            `Email to ${to}: ${err instanceof Error ? err.message.slice(0, 200) : "delivery failed"}`
          );
        }
      }
    }
  }

  if (wantSms) {
    const recipients: string[] = [];
    for (const t of input.targets) {
      const r = phoneToMnotifyRecipient(t.phone);
      if (r) recipients.push(r);
      else smsSkipped += 1;
    }
    smsAttempted = recipients.length;
    if (recipients.length === 0) {
      if (input.targets.length > 0) {
        errors.push("No SMS-ready phone numbers were found in the guest list.");
      }
    } else {
      try {
        const res = await sendOrgMnotifyQuickSms(
          input.org.id,
          recipients,
          renderPollResultsSms({
            orgName: input.org.name,
            pollTitle: input.pollTitle,
            resultsUrl: input.resultsUrl,
            summary: input.summary
          })
        );
        if (res.ok) {
          smsSent = res.totalSent ?? recipients.length;
        } else {
          errors.push(res.error ?? "mNotify rejected the SMS batch.");
        }
      } catch (err) {
        errors.push(
          `SMS broadcast: ${err instanceof Error ? err.message.slice(0, 200) : "delivery failed"}`
        );
      }
    }
  }

  return {
    emailsAttempted,
    emailsSent,
    emailsSkipped,
    smsAttempted,
    smsSent,
    smsSkipped,
    errors
  };
}

/**
 * Build the per-position highlight lines used in the email body + SMS preview. We
 * keep this small so SMS bodies stay under network length limits.
 */
export function buildPollResultsSummary(input: {
  totalGuests: number;
  ballotsCast: number;
  turnoutPct: number;
  positions: Array<{
    title: string;
    isUnopposed: boolean;
    totalVotes: number;
    candidates: Array<{ name: string; votes: number; sharePct: number }>;
    confidence: { yes: number; no: number; abstain: number } | null;
  }>;
}): PollResultsSummary {
  const positionLines = input.positions.slice(0, 5).map((p) => {
    if (p.isUnopposed) {
      const conf = p.confidence ?? { yes: 0, no: 0, abstain: 0 };
      const total = conf.yes + conf.no + conf.abstain;
      const pct = total > 0 ? Math.round((conf.yes / total) * 100) : 0;
      const verdict = conf.yes > conf.no ? "Confirmed" : "Not confirmed";
      return `${p.title}: ${verdict} (${pct}% Yes, ${conf.yes}/${total}).`;
    }
    const sorted = [...p.candidates].sort((a, b) => b.votes - a.votes);
    const leader = sorted[0];
    if (!leader || p.totalVotes === 0) {
      return `${p.title}: no votes recorded.`;
    }
    return `${p.title}: ${leader.name} leads with ${leader.sharePct}% (${leader.votes}/${p.totalVotes}).`;
  });
  return {
    totalGuests: input.totalGuests,
    ballotsCast: input.ballotsCast,
    turnoutPct: input.turnoutPct,
    positionLines
  };
}
