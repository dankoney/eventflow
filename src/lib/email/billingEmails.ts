import { sendTransactionalEmail } from "@/lib/email";
import { resolveEmailAssetUrl, resolvePublicAppBaseUrlFromEnv } from "@/lib/email/assetUrl";
import {
  getBillingAlertCcEmails,
  getPlatformBillingAlertSettings
} from "@/lib/billing/platformSettings";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function eventflowLogoUrl(): string | null {
  return resolveEmailAssetUrl("/brand/eventflow-logo.png");
}

function appHomeUrl(): string {
  return resolvePublicAppBaseUrlFromEnv()?.replace(/\/$/, "") ?? "https://eventflow.cosabonita.tech";
}

type BillingEmailShellParams = {
  badgeText: string;
  badgeBackground?: string;
  badgeColor?: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  footerNote?: string;
};

/**
 * Shared Eventflow billing email layout (inline styles for client compatibility).
 * Matches the operational trial/billing notification design.
 */
export function renderBillingEmailShell(params: BillingEmailShellParams): string {
  const appUrl = escapeHtml(appHomeUrl());
  const logoSrc = eventflowLogoUrl();
  const logoBlock = logoSrc
    ? `<a href="${appUrl}" style="display:inline-block;text-decoration:none">
         <img src="${escapeHtml(logoSrc)}" alt="EventFlow" width="140" height="32" style="display:block;height:32px;width:auto;border:0;outline:none;text-decoration:none" />
       </a>`
    : `<a href="${appUrl}" style="font-size:22px;font-weight:800;letter-spacing:-0.025em;color:#111827;text-decoration:none;display:inline-flex;align-items:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
         EventFlow<span style="width:8px;height:8px;background-color:#10b981;border-radius:50%;margin-left:4px;display:inline-block"></span>
       </a>`;

  const badgeBg = params.badgeBackground ?? "#fef3c7";
  const badgeFg = params.badgeColor ?? "#d97706";
  const cta =
    params.ctaUrl && params.ctaLabel
      ? `<div style="padding:12px 0 24px 0">
           <a href="${escapeHtml(params.ctaUrl)}" style="background-color:#111827;color:#ffffff !important;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500;display:inline-block;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">${escapeHtml(params.ctaLabel)}</a>
         </div>`
      : "";

  const footer =
    params.footerNote ??
    "This is an automated operational notification regarding your EventFlow subscription workspace. If you have any questions, reply directly to this email to reach our support team.";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EventFlow</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f9fafb;color:#1f2937;margin:0;padding:0;-webkit-font-smoothing:antialiased">
  <div style="width:100%;background-color:#f9fafb;padding:40px 0">
    <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
      <div style="padding:32px 32px 20px 32px">
        ${logoBlock}
      </div>
      <div style="padding:0 32px 32px 32px;font-size:15px;line-height:1.6;color:#4b5563">
        <div style="background-color:${badgeBg};color:${badgeFg};padding:4px 10px;border-radius:9999px;font-size:12px;font-weight:600;display:inline-block;margin-bottom:20px">${escapeHtml(params.badgeText)}</div>
        <h1 style="font-size:18px;font-weight:600;color:#111827;margin-top:0;margin-bottom:16px">${params.heading}</h1>
        ${params.bodyHtml}
        ${cta}
      </div>
      <div style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;line-height:1.55">
        ${escapeHtml(footer).replaceAll("\n", "<br>")}
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendBillingTrialReminderEmail(params: {
  to: string;
  adminName: string | null;
  orgName: string;
  trialEndsAt: Date;
  daysLeft: number;
  reminderDay: number;
  billingUrl: string | null;
}) {
  const greeting = params.adminName?.trim() ? escapeHtml(params.adminName.trim()) : "there";
  const orgName = escapeHtml(params.orgName);
  const ends = escapeHtml(
    params.trialEndsAt.toLocaleDateString(undefined, {
      dateStyle: "long"
    })
  );
  const daysLeft = params.daysLeft;
  const daysLabel = `${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

  const badgeText =
    params.reminderDay >= 89
      ? `⏳ Last day — ${daysLabel} remaining`
      : params.reminderDay >= 80
        ? `⏳ Ending soon — ${daysLabel} remaining`
        : `⏳ ${daysLabel} remaining`;

  const badgeStyles =
    params.reminderDay >= 89
      ? { badgeBackground: "#fee2e2", badgeColor: "#dc2626" }
      : params.reminderDay >= 80
        ? { badgeBackground: "#ffedd5", badgeColor: "#ea580c" }
        : { badgeBackground: "#fef3c7", badgeColor: "#d97706" };

  const bodyHtml = `
    <p style="margin-top:0;margin-bottom:16px">Your <strong>${orgName}</strong> workspace is currently on a complimentary EventFlow PRO trial.</p>
    <p style="margin-top:0;margin-bottom:16px">Your trial will end on <strong>${ends}</strong> (${daysLabel} left). There is no payment card or mobile wallet on file yet—add a payment method to keep your PRO features active without interruption.</p>
    ${
      params.billingUrl
        ? ""
        : `<p style="margin-top:0;margin-bottom:16px">Sign in to your workspace and open <strong>Settings → Billing</strong> to subscribe before your trial ends.</p>`
    }
    <p style="margin-top:0;margin-bottom:16px">If you choose not to subscribe, your workspace will automatically transition to our Free plan when the trial ends. You will retain complete read-only access to your historical data, guest lists, and past templates, but new event creation and messaging modules will be paused.</p>
  `.trim();

  const html = renderBillingEmailShell({
    ...badgeStyles,
    badgeText,
    heading: `Hi ${greeting},`,
    bodyHtml,
    ctaLabel: params.billingUrl ? "Add payment method" : null,
    ctaUrl: params.billingUrl
  });

  const urgency =
    params.reminderDay >= 89 ? "Last day" : params.reminderDay >= 80 ? "Trial ending soon" : "Trial reminder";

  await sendTransactionalEmail({
    to: params.to,
    subject: `${urgency}: ${params.orgName} trial — ${daysLabel} left`,
    html,
    bcc: await getBillingAlertCcEmails(params.to)
  });
}

export async function sendBillingEnterpriseCoverageReminderEmail(params: {
  to: string;
  adminName: string | null;
  orgName: string;
  coverageEndsAt: Date;
  daysLeft: number;
  daysBefore: number;
}) {
  const greeting = params.adminName?.trim() ? escapeHtml(params.adminName.trim()) : "there";
  const orgName = escapeHtml(params.orgName);
  const ends = escapeHtml(
    params.coverageEndsAt.toLocaleDateString(undefined, { dateStyle: "long" })
  );
  const daysLabel = `${params.daysLeft} day${params.daysLeft === 1 ? "" : "s"}`;
  const { supportEmail } = await getPlatformBillingAlertSettings();
  const supportContact = supportEmail ?? "your EventFlow account manager";
  const supportHtml = supportEmail
    ? `<strong>${escapeHtml(supportEmail)}</strong>`
    : escapeHtml(supportContact);

  const badgeText =
    params.daysBefore <= 1
      ? "Coverage ends tomorrow"
      : params.daysBefore <= 7
        ? `Coverage ending soon — ${daysLabel} remaining`
        : `Coverage renewal — ${daysLabel} remaining`;

  const badgeStyles =
    params.daysBefore <= 1
      ? { badgeBackground: "#fee2e2", badgeColor: "#dc2626" }
      : params.daysBefore <= 7
        ? { badgeBackground: "#ffedd5", badgeColor: "#ea580c" }
        : { badgeBackground: "#fef3c7", badgeColor: "#d97706" };

  const bodyHtml = `
    <p style="margin-top:0;margin-bottom:16px">Your <strong>${orgName}</strong> workspace is on EventFlow <strong>Enterprise</strong>.</p>
    <p style="margin-top:0;margin-bottom:16px">Current coverage runs through <strong>${ends}</strong> (${daysLabel} left).</p>
    <p style="margin-top:0;margin-bottom:16px">We&rsquo;ll be in touch about your renewal invoice in the usual way. If a purchase order or internal approval is already in progress, no action is needed from you right now — just keep us posted if timing shifts.</p>
    <p style="margin-top:0;margin-bottom:16px">Questions? Reply to this email or contact ${supportHtml}.</p>
  `.trim();

  const html = renderBillingEmailShell({
    ...badgeStyles,
    badgeText,
    heading: `Hi ${greeting},`,
    bodyHtml,
    ctaLabel: supportEmail ? "Contact billing" : null,
    ctaUrl: supportEmail ? `mailto:${supportEmail}` : null
  });

  const subject =
    params.daysBefore <= 1
      ? `Coverage ends tomorrow — ${params.orgName}`
      : params.daysBefore <= 3
        ? `Coverage ends in ${params.daysBefore} days — ${params.orgName}`
        : params.daysBefore <= 7
          ? `Coverage renewal in ${params.daysBefore} days — ${params.orgName}`
          : params.daysBefore <= 14
            ? `Coverage renewal in 14 days — ${params.orgName}`
            : `Coverage renewal coming up — ${params.orgName} (30 days)`;

  await sendTransactionalEmail({
    to: params.to,
    subject,
    html,
    bcc: await getBillingAlertCcEmails(params.to)
  });
}

export async function sendBillingEnterpriseCoverageOverdueEmail(params: {
  to: string;
  adminName: string | null;
  orgName: string;
  coverageEndedAt: Date;
  daysOverdue: number;
}) {
  const greeting = params.adminName?.trim() ? escapeHtml(params.adminName.trim()) : "there";
  const orgName = escapeHtml(params.orgName);
  const ended = escapeHtml(
    params.coverageEndedAt.toLocaleDateString(undefined, { dateStyle: "long" })
  );
  const daysLabel = `${params.daysOverdue} day${params.daysOverdue === 1 ? "" : "s"}`;
  const { supportEmail } = await getPlatformBillingAlertSettings();
  const supportHtml = supportEmail
    ? `<strong>${escapeHtml(supportEmail)}</strong>`
    : "your EventFlow account manager";

  const bodyHtml = `
    <p style="margin-top:0;margin-bottom:16px">Your <strong>${orgName}</strong> workspace is on EventFlow <strong>Enterprise</strong>.</p>
    <p style="margin-top:0;margin-bottom:16px">Coverage through <strong>${ended}</strong> has ended (${daysLabel} overdue).</p>
    <p style="margin-top:0;margin-bottom:16px"><strong>Your access is unchanged</strong> while we arrange renewal. EventFlow will follow up about your next invoice. If a purchase order or internal approval is in progress, reply to this email with an update so we can align timing.</p>
    <p style="margin-top:0;margin-bottom:16px">Questions? Reply to this email or contact ${supportHtml}.</p>
  `.trim();

  const html = renderBillingEmailShell({
    badgeText: `Coverage ended — ${daysLabel} overdue`,
    badgeBackground: "#ffedd5",
    badgeColor: "#c2410c",
    heading: `Hi ${greeting},`,
    bodyHtml,
    ctaLabel: supportEmail ? "Contact billing" : null,
    ctaUrl: supportEmail ? `mailto:${supportEmail}` : null
  });

  await sendTransactionalEmail({
    to: params.to,
    subject: `Coverage ended — ${params.orgName} (${daysLabel} overdue)`,
    html,
    bcc: await getBillingAlertCcEmails(params.to)
  });
}

export async function sendBillingCardExpiringEmail(params: {
  to: string;
  adminName: string | null;
  orgName: string;
  cardLast4: string | null;
  billingUrl: string | null;
}) {
  const greeting = params.adminName?.trim() ? escapeHtml(params.adminName.trim()) : "there";
  const orgName = escapeHtml(params.orgName);
  const cardBit = params.cardLast4
    ? ` ending in <strong>${escapeHtml(params.cardLast4)}</strong>`
    : "";

  const bodyHtml = `
    <p style="margin-top:0;margin-bottom:16px">The payment card${cardBit} on file for <strong>${orgName}</strong> is expiring soon.</p>
    <p style="margin-top:0;margin-bottom:16px">Update your payment method so your EventFlow PRO subscription renews without interruption.</p>
    ${
      params.billingUrl
        ? ""
        : `<p style="margin-top:0;margin-bottom:16px">Sign in and open <strong>Settings → Billing</strong> to update your card.</p>`
    }
  `.trim();

  const html = renderBillingEmailShell({
    badgeText: "💳 Card expiring soon",
    badgeBackground: "#dbeafe",
    badgeColor: "#2563eb",
    heading: `Hi ${greeting},`,
    bodyHtml,
    ctaLabel: params.billingUrl ? "Update payment method" : null,
    ctaUrl: params.billingUrl
  });

  await sendTransactionalEmail({
    to: params.to,
    subject: `Action needed: update card for ${params.orgName}`,
    html,
    bcc: await getBillingAlertCcEmails(params.to)
  });
}

export async function sendBillingPaymentReceiptEmail(params: {
  to: string;
  adminName: string | null;
  receipt: import("@/lib/billing/receiptData").BillingReceiptData;
  pdfAttachment?: { filename: string; contentBase64: string };
}) {
  const greeting = params.adminName?.trim() ? escapeHtml(params.adminName.trim()) : "there";
  const orgName = escapeHtml(params.receipt.billedTo.name);
  const offlineNote =
    params.receipt.source === "MANUAL"
      ? `<p style="margin-top:0;margin-bottom:16px;font-size:13px;color:#92400e;background:#fef3c7;padding:10px 12px;border-radius:8px">Offline payment recorded by EventFlow support (not charged via Paystack).</p>`
      : "";

  const rows = params.receipt.lines
    .map(
      (line) => `
      <tr>
        <td style="padding:6px 0;color:${line.muted ? "#6b7280" : "#111827"};font-size:14px">${escapeHtml(line.label)}</td>
        <td style="padding:6px 0;text-align:right;color:${line.muted ? "#6b7280" : "#111827"};font-size:14px;font-variant-numeric:tabular-nums">${escapeHtml(line.amountLabel)}</td>
      </tr>`
    )
    .join("");

  const attachNote = params.pdfAttachment
    ? `<p style="margin-top:0;margin-bottom:16px;font-size:13px;color:#6b7280">Your Tax Invoice / Receipt PDF is attached to this email.</p>`
    : "";

  const bodyHtml = `
    <p style="margin-top:0;margin-bottom:16px">We've received payment for your <strong>${orgName}</strong> EventFlow workspace.</p>
    ${offlineNote}
    ${attachNote}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 16px">
      ${rows}
      <tr>
        <td colspan="2" style="border-top:2px solid #10b981;padding-top:10px"></td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:600;color:#111827;font-size:15px">Total</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;font-size:15px;font-variant-numeric:tabular-nums">${escapeHtml(params.receipt.totalLabel)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:13px">Plan</td>
        <td style="padding:6px 0;text-align:right;color:#111827;font-size:13px">${escapeHtml(params.receipt.planLabel)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:13px">Date</td>
        <td style="padding:6px 0;text-align:right;color:#111827;font-size:13px">${escapeHtml(params.receipt.dateLabel)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:13px">Reference</td>
        <td style="padding:6px 0;text-align:right;color:#111827;font-size:13px;font-family:ui-monospace,monospace">${escapeHtml(params.receipt.reference)}</td>
      </tr>
      ${
        params.receipt.periodLabel
          ? `<tr>
        <td style="padding:6px 0;color:#6b7280;font-size:13px">Period</td>
        <td style="padding:6px 0;text-align:right;color:#111827;font-size:13px">${escapeHtml(params.receipt.periodLabel)}</td>
      </tr>`
          : ""
      }
    </table>
    <p style="margin-top:0;margin-bottom:16px;font-size:13px;color:#6b7280">This receipt confirms payment to EventFlow. Keep it for your records. If you didn't authorize this charge, reply to this email.</p>
  `.trim();

  const { supportEmail } = await getPlatformBillingAlertSettings();
  const supportNote = supportEmail
    ? `Questions: reply to billing emails / ${supportEmail}`
    : "Questions: reply to billing emails.";

  const html = renderBillingEmailShell({
    badgeText: "Payment received",
    badgeBackground: "#d1fae5",
    badgeColor: "#047857",
    heading: `Hi ${greeting},`,
    bodyHtml,
    ctaLabel: params.receipt.billingUrl ? "View billing history" : null,
    ctaUrl: params.receipt.billingUrl,
    footerNote: [
      "EventFlow is a product of Cosabonita.",
      supportNote,
      "EventFlow — this is an electronically generated receipt."
    ].join("\n")
  });

  await sendTransactionalEmail({
    to: params.to,
    subject: `Tax Invoice / Receipt — ${params.receipt.totalLabel} · ${params.receipt.billedTo.name}`,
    html,
    attachments: params.pdfAttachment
      ? [
          {
            filename: params.pdfAttachment.filename,
            content: params.pdfAttachment.contentBase64
          }
        ]
      : undefined
  });
}

export type EnterprisePayableInvoiceEmailLine = {
  label: string;
  amountLabel: string;
  muted?: boolean;
};

export async function sendBillingEnterprisePayableInvoiceEmail(params: {
  to: string;
  adminName: string | null;
  orgName: string;
  totalLabel: string;
  dueDateLabel: string;
  reference: string;
  paymentPageUrl: string;
  lines: EnterprisePayableInvoiceEmailLine[];
}) {
  const greeting = params.adminName?.trim() ? escapeHtml(params.adminName.trim()) : "there";
  const orgName = escapeHtml(params.orgName);

  const rows = params.lines
    .map(
      (line) => `
      <tr>
        <td style="padding:6px 0;color:${line.muted ? "#6b7280" : "#111827"};font-size:14px">${escapeHtml(line.label)}</td>
        <td style="padding:6px 0;text-align:right;color:${line.muted ? "#6b7280" : "#111827"};font-size:14px;font-variant-numeric:tabular-nums">${escapeHtml(line.amountLabel)}</td>
      </tr>`
    )
    .join("");

  const bodyHtml = `
    <p style="margin-top:0;margin-bottom:16px">You have a new EventFlow invoice for <strong>${orgName}</strong>.</p>
    <p style="margin-top:0;margin-bottom:16px">Please review the details below and pay by <strong>${escapeHtml(params.dueDateLabel)}</strong>.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 16px">
      ${rows}
      <tr>
        <td colspan="2" style="border-top:2px solid #10b981;padding-top:10px"></td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:600;color:#111827;font-size:15px">Total due</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;font-size:15px;font-variant-numeric:tabular-nums">${escapeHtml(params.totalLabel)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:13px">Due date</td>
        <td style="padding:6px 0;text-align:right;color:#111827;font-size:13px">${escapeHtml(params.dueDateLabel)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:13px">Reference</td>
        <td style="padding:6px 0;text-align:right;color:#111827;font-size:13px;font-family:ui-monospace,monospace">${escapeHtml(params.reference)}</td>
      </tr>
    </table>
    <p style="margin-top:0;margin-bottom:0;font-size:13px;color:#6b7280">If you've already paid, you can ignore this email — you'll receive a separate Tax Invoice / Receipt once payment clears.</p>
  `.trim();

  const { supportEmail } = await getPlatformBillingAlertSettings();
  const supportNote = supportEmail
    ? `Questions: reply to billing emails / ${supportEmail}`
    : "Questions: reply to billing emails.";

  const html = renderBillingEmailShell({
    badgeText: "Invoice",
    badgeBackground: "#e0e7ff",
    badgeColor: "#3730a3",
    heading: `Hi ${greeting},`,
    bodyHtml,
    ctaLabel: "Pay now",
    ctaUrl: params.paymentPageUrl,
    footerNote: [
      "EventFlow is a product of Cosabonita.",
      supportNote,
      "EventFlow — this is an electronically generated invoice."
    ].join("\n")
  });

  await sendTransactionalEmail({
    to: params.to,
    subject: `Invoice from EventFlow — action required · ${params.totalLabel} · ${params.orgName}`,
    html
  });
}

