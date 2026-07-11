import { InternalStaffSmsTemplateKind, type InternalStaffNoticeKind } from "@prisma/client";

import { buildInternalStaffNoticeCopy, formatMemoDateTime } from "@/lib/internalStaff/noticeCopy";

const SMS_MAX = 320;

function clip(body: string): string {
  return body.slice(0, SMS_MAX);
}

export type InternalStaffNoticeSmsContext = {
  noticeKind: InternalStaffNoticeKind;
  eventName: string;
  eventDate: Date;
  hasPersonalLink: boolean;
  actionUrl?: string | null;
  smsTemplateKind: InternalStaffSmsTemplateKind;
  smsCustomText: string | null | undefined;
};

/** Mandatory-attendance staff notice SMS (not an RSVP invite). */
export function renderInternalStaffNoticeSms(ctx: InternalStaffNoticeSmsContext): string {
  const when = formatMemoDateTime(ctx.eventDate);
  const copy = buildInternalStaffNoticeCopy({ noticeKind: ctx.noticeKind, eventName: ctx.eventName });
  const link = ctx.actionUrl?.trim() || null;

  if (ctx.smsTemplateKind === InternalStaffSmsTemplateKind.BLANK) {
    const raw = ctx.smsCustomText?.trim() || "";
    if (!raw) {
      // Fallback to standard template if blank draft has no content.
      return clip(
        `${copy.sessionLabel}: ${ctx.eventName} on ${when}. ${link ? "Check-in: " + link + "." : "Check your email for full notice."}`
      );
    }
    const resolved = raw
      .replaceAll("{eventName}", ctx.eventName)
      .replaceAll("{when}", when)
      .replaceAll("{link}", link ?? "")
      .replaceAll("{sessionLabel}", copy.sessionLabel);
    return clip(resolved);
  }

  if (ctx.smsTemplateKind === InternalStaffSmsTemplateKind.SHORT) {
    const base = link
      ? `${copy.sessionLabel}: ${ctx.eventName}. Check-in: ${link}`
      : `${copy.sessionLabel}: ${ctx.eventName}. Attendance expected. Check your email for full notice.`;
    return clip(base);
  }

  // STANDARD
  if (link) {
    if (ctx.hasPersonalLink) {
      return clip(
        `${copy.sessionLabel}: ${ctx.eventName} on ${when}. Your personal Zoom link: ${link}`
      );
    }
    return clip(`${copy.sessionLabel}: ${ctx.eventName} on ${when}. Staff check-in: ${link}`);
  }

  return clip(`${copy.sessionLabel}: ${ctx.eventName} on ${when}. Check your email for full notice. Attendance expected.`);
}
