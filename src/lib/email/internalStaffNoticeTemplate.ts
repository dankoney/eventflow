import { InternalStaffEmailTemplateKind, InternalStaffNoticeKind } from "@prisma/client";

import {
  buildInternalStaffNoticeCopy,
  formatMemoDate,
  formatMemoDateTime,
  resolveInternalStaffNoticeSubject
} from "@/lib/internalStaff/noticeCopy";
import type { DefaultEventBrandColors } from "@/lib/email/defaultEventBranding";
import {
  DEFAULT_EVENT_BRAND_PRIMARY,
  DEFAULT_EVENT_BRAND_SECONDARY,
  DEFAULT_EVENT_BRAND_TERTIARY
} from "@/lib/email/defaultEventBranding";
import { resolveEmailAssetUrl } from "@/lib/email/assetUrl";

export type InternalStaffNoticeEmailParams = {
  to: string;
  guestName: string;
  orgName: string;
  orgLogoUrl?: string | null;
  brandColors?: DefaultEventBrandColors;
  eventName: string;
  eventDate: Date;
  noticeKind: InternalStaffNoticeKind;
  emailTemplateKind: InternalStaffEmailTemplateKind;
  memoTo: string;
  memoFrom: string;
  memoCc?: string | null;
  memoDate: Date;
  /** When set, overrides the default subject derived from notice kind + event name. */
  memoSubject?: string | null;
  contextParagraph?: string | null;
  platformLine: string;
  checkInInstruction: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  resendApiKeyOverride?: string;
};

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

function paragraphHtml(text: string) {
  return `<p style="margin:0 0 14px;color:#1a1a1a;font-size:15px;line-height:1.7;font-family:Georgia,'Times New Roman',Times,serif;text-align:justify;text-justify:inter-word;">${escapeHtml(text)}</p>`;
}

function subjectHtml(text: string) {
  return `<span style="font-weight:700;text-decoration:underline;">${escapeHtml(text)}</span>`;
}

function resolveContrastingTextColor(bgHex: string, light = "#ffffff", dark = "#0f172a") {
  const t = bgHex.trim();
  const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(t);
  if (!hexMatch) return dark;

  const hex = hexMatch[1];
  const expanded =
    hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;

  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);

  // Simple perceived brightness; good enough for email headers.
  const brightness = r * 0.299 + g * 0.587 + b * 0.114;
  return brightness > 185 ? dark : light;
}

export function renderInternalStaffNoticeEmailHtml(p: InternalStaffNoticeEmailParams): string {
  const copy = buildInternalStaffNoticeCopy({ noticeKind: p.noticeKind, eventName: p.eventName });
  const memoSubject = resolveInternalStaffNoticeSubject({
    noticeKind: p.noticeKind,
    eventName: p.eventName,
    customSubject: p.memoSubject
  });
  const memoDate = formatMemoDate(p.memoDate);
  const sessionWhen = formatMemoDateTime(p.eventDate);
  const greeting = p.guestName.trim() ? `Dear ${p.guestName.trim()},` : "Dear Colleague,";

  const primary = p.brandColors?.primary ?? DEFAULT_EVENT_BRAND_PRIMARY;
  const secondary = p.brandColors?.secondary ?? DEFAULT_EVENT_BRAND_SECONDARY;
  const tertiary = p.brandColors?.tertiary ?? DEFAULT_EVENT_BRAND_TERTIARY;

  const isBlank = p.emailTemplateKind === InternalStaffEmailTemplateKind.BLANK;
  const isNotice = p.emailTemplateKind === InternalStaffEmailTemplateKind.NOTICE;
  const headerLabel = isNotice ? "Notice" : "Memorandum";

  const context = !isBlank
    ? p.contextParagraph?.trim() ||
      `Management wishes to inform all staff that an internal ${copy.sessionNoun} on ${p.eventName.trim()} has been scheduled.`
    : p.contextParagraph?.trim() || "";

  const sessionParagraph = !isBlank ? `The internal ${copy.sessionNoun} is scheduled for ${sessionWhen}.` : "";

  const actionBlock = p.actionUrl?.trim()
    ? `<p style="margin:20px 0 0;">
        <a href="${escapeAttr(p.actionUrl.trim())}" style="display:inline-block;padding:11px 18px;background:${escapeAttr(primary)};color:${escapeAttr(
          resolveContrastingTextColor(primary)
        )};text-decoration:none;border-radius:4px;font-weight:600;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;">
          ${escapeHtml(p.actionLabel?.trim() || "Open check-in")}
        </a>
      </p>
      <p style="margin:12px 0 0;color:#64748b;font-size:12px;line-height:1.5;font-family:'Inter',Helvetica,Arial,sans-serif;word-break:break-all;text-align:justify;text-justify:inter-word;">
        ${escapeHtml(p.actionUrl.trim())}
      </p>`
    : "";

  const metaRow = (label: string, value: string, subjectStyle = false) => `
    <tr>
      <td style="padding:5px 16px 5px 0;vertical-align:top;width:80px;font-size:13px;font-weight:700;color:#1a1a1a;font-family:Georgia,'Times New Roman',Times,serif;">${escapeHtml(label)}:</td>
      <td style="padding:5px 0;font-size:14px;color:#1a1a1a;font-family:Georgia,'Times New Roman',Times,serif;text-align:justify;text-justify:inter-word;">${
        subjectStyle ? subjectHtml(value) : escapeHtml(value)
      }</td>
    </tr>`;

  const departmentBand = p.memoFrom
    .trim()
    .replace(/^HEAD\s*,\s*/i, "")
    .replace(/\.$/, "")
    .trim();

  const bandLabel = (departmentBand || p.orgName).toUpperCase();
  const logoSrc = resolveEmailAssetUrl(p.orgLogoUrl);

  const orgLogoHtml = logoSrc
    ? `<img src="${escapeAttr(logoSrc)}" alt="${escapeAttr(p.orgName)}" width="64" height="64" style="display:block;border-radius:50%;border:4px solid #ffffff;object-fit:cover;background:#ffffff;"/>`
    : `<span style="display:inline-block;width:64px;height:64px;line-height:56px;text-align:center;border-radius:50%;border:4px solid #ffffff;background:${escapeAttr(tertiary)};color:${escapeAttr(
        resolveContrastingTextColor(tertiary)
      )};font-weight:800;font-family:Inter,Helvetica,Arial,sans-serif;font-size:16px;">${escapeHtml(
        p.orgName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((s) => s[0]?.toUpperCase())
          .join("") || "EF"
      )}</span>`;

  const closingLine = isBlank ? "" : copy.closingLine;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(memoSubject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border:1px solid #d4d4d4;">
          <tr>
            <td style="padding:0;background:${escapeAttr(primary)};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="100" style="padding:16px 0 16px 24px;vertical-align:middle;">
                    ${orgLogoHtml}
                  </td>
                  <td style="padding:16px 24px 16px 8px;vertical-align:middle;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:${escapeAttr(secondary)};padding:10px 20px;text-align:center;">
                          <span style="color:${escapeAttr(
                            resolveContrastingTextColor(secondary)
                          )};font-weight:700;letter-spacing:0.12em;text-transform:uppercase;font-size:12px;font-family:Inter,Helvetica,Arial,sans-serif;line-height:1.4;">
                            ${escapeHtml(bandLabel)}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 8px;">
              <p style="margin:0;font-size:32px;font-weight:700;color:#1a1a1a;font-family:Georgia,'Times New Roman',Times,serif;">
                ${escapeHtml(headerLabel)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${metaRow("TO", p.memoTo)}
                ${metaRow("FROM", p.memoFrom)}
                ${p.memoCc?.trim() ? metaRow("CC", p.memoCc.trim()) : ""}
                ${metaRow("DATE", memoDate)}
                ${metaRow("SUBJECT", memoSubject, true)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 32px;">
              ${isBlank ? "" : paragraphHtml(greeting)}
              ${context ? paragraphHtml(context) : ""}
              ${sessionParagraph ? paragraphHtml(sessionParagraph) : ""}
              ${paragraphHtml(p.platformLine)}
              ${p.checkInInstruction.trim() ? paragraphHtml(p.checkInInstruction) : ""}
              ${closingLine ? paragraphHtml(closingLine) : ""}
              ${actionBlock}
              <p style="margin:28px 0 0;color:#737373;font-size:11px;line-height:1.5;font-family:'Inter',Helvetica,Arial,sans-serif;">
                ${escapeHtml(p.orgName)} — internal staff programme notice.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function internalStaffNoticeEmailSubject(
  noticeKind: InternalStaffNoticeKind,
  eventName: string,
  customSubject?: string | null
): string {
  return resolveInternalStaffNoticeSubject({ noticeKind, eventName, customSubject });
}
