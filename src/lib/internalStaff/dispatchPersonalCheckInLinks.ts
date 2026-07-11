import {
  EventBlueprintTemplate,
  EventStatus,
  EventType,
  GuestStatus,
  InternalStaffCheckInMode,
  InternalStaffEmailTemplateKind,
  type Prisma
} from "@prisma/client";

import { logMnotifySmsDelivery } from "@/lib/delivery/providerDelivery";
import { sendTransactionalEmail } from "@/lib/email";
import { resolveDefaultEventBranding } from "@/lib/email/defaultEventBranding";
import {
  compileStaffNoticeEmailTemplateHtml,
  renderStaffNoticeEmailFromTemplate,
  wrapStaffNoticeEmailDocument
} from "@/lib/email/compileStaffNoticeEmail";
import {
  renderInternalStaffNoticeEmailHtml
} from "@/lib/email/internalStaffNoticeTemplate";
import { resolveStaffNoticeMergeValues } from "@/lib/email/staffNoticeMergeValues";
import { parseInternalStaffEmailMailyJson } from "@/lib/internalStaff/emailMailyJson";
import { guestHasDeliverableEmail } from "@/lib/guest/contactRequirements";
import { internalStaffAudienceForPrisma } from "@/lib/internalStaff/audience";
import {
  buildInternalStaffNoticeCopy,
  cleanNoticeContextForDisplay,
  defaultInternalStaffNoticeFrom,
  resolveInternalStaffMeetingRoom,
  resolveInternalStaffNoticeSubject,
  resolveMemoToForEvent,
  resolvePlatformLine,
  resolveStaffNoticeActionLabel,
  resolveStaffNoticeActionUrl,
  resolveStaffNoticeCheckInInstruction
} from "@/lib/internalStaff/noticeCopy";
import { resolveStaffNoticeSmsUrl } from "@/lib/internalStaff/staffNoticeSmsLink";
import { phoneToMnotifyRecipient, sendOrgMnotifyQuickSms } from "@/lib/mnotify";
import { prisma } from "@/lib/prisma";
import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";
import { renderInternalStaffNoticeSms } from "@/lib/sms/internalStaffNoticeSms";
import { getEventRegistrationAbsoluteUrl, getInternalStaffMagicCheckInUrl } from "@/lib/url";
import { formatLocationLine } from "@/lib/utils";
import { sendOrgWhatsAppText } from "@/lib/whatsapp";

import { newInternalCheckInToken } from "./personalLinkToken";

const eventSelect = {
  id: true,
  name: true,
  date: true,
  status: true,
  type: true,
  description: true,
  blueprintTemplate: true,
  internalStaffCheckInMode: true,
  internalStaffAudience: true,
  internalStaffNoticeKind: true,
  internalStaffNoticeTo: true,
  internalStaffNoticeFrom: true,
  internalStaffNoticeCc: true,
  internalStaffNoticeContext: true,
  internalStaffNoticeSubject: true,
  internalStaffMeetingRoom: true,
  internalStaffEmailTemplateKind: true,
  internalStaffSmsTemplateKind: true,
  internalStaffSmsCustomText: true,
  internalStaffEmailMailyJson: true,
  brandLogoUrl: true,
  brandPrimaryColor: true,
  zoomJoinUrl: true,
  orgId: true,
  location: { select: { name: true, address: true, city: true } },
  org: {
    select: {
      name: true,
      logo: true,
      logoUrl: true,
      defaultEventBrandLogoUrl: true,
      defaultEventBrandPrimaryColor: true,
      defaultEventBrandSecondaryColor: true,
      defaultEventBrandTertiaryColor: true,
      resendApiKey: true,
      whatsappEnabled: true,
      internalStaffFooterContact: true
    }
  }
} satisfies Prisma.EventSelect;

type StaffEventRow = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

export type DispatchRosterNoticesOptions = {
  onlyUnnotified?: boolean;
  forceResend?: boolean;
};

export type DispatchRosterNoticesResult = {
  emailed: number;
  smsSent: number;
  whatsappSent: number;
  skippedNoUrl: number;
  skippedNoContact: number;
};

export async function ensurePersonalLinkTokensForDirectoryGuests(eventId: string): Promise<number> {
  const rows = await prisma.guest.findMany({
    where: {
      eventId,
      qrCode: null,
      zoomLink: null,
      internalCheckInToken: null
    },
    select: { id: true }
  });
  let updated = 0;
  for (const r of rows) {
    await prisma.guest.update({
      where: { id: r.id },
      data: { internalCheckInToken: newInternalCheckInToken() }
    });
    updated += 1;
  }
  return updated;
}

function isDirectoryRosterGuest(g: {
  qrCode: string | null;
  zoomLink: string | null;
  invitationToken: string | null;
}) {
  return !g.qrCode && !g.zoomLink && !g.invitationToken;
}

function resolveMemoFrom(event: StaffEventRow): string {
  return (
    event.internalStaffNoticeFrom?.trim() ||
    event.org.internalStaffFooterContact?.trim() ||
    defaultInternalStaffNoticeFrom(event.org.name)
  );
}

async function sendNoticeToGuest(
  event: StaffEventRow,
  guest: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    internalCheckInToken: string | null;
  },
  audienceTo: string,
  options?: { blankEmailTemplateHtml?: string | null }
): Promise<{ emailed: boolean; smsSent: boolean; whatsappSent: boolean; skippedNoUrl: boolean; skippedNoContact: boolean }> {
  const resendKey = event.org.resendApiKey?.trim() || undefined;
  const personalMode = event.internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK;

  const personalUrl =
    personalMode && guest.internalCheckInToken
      ? getInternalStaffMagicCheckInUrl(event.id, guest.internalCheckInToken)
      : null;

  const sharedUrl = getEventRegistrationAbsoluteUrl(event.id);

  const storedContext = event.internalStaffNoticeContext;
  const resolvedMeetingRoom = resolveInternalStaffMeetingRoom({
    meetingRoom: event.internalStaffMeetingRoom,
    noticeContext: storedContext
  });

  const actionUrl = resolveStaffNoticeActionUrl({
    eventType: event.type,
    eventId: event.id,
    personalCheckInUrl: personalUrl,
    sharedCheckInUrl: sharedUrl
  });

  const hasPersonalLink = Boolean(personalUrl);

  if (!actionUrl && event.type !== EventType.IN_PERSON) {
    return { emailed: false, smsSent: false, whatsappSent: false, skippedNoUrl: true, skippedNoContact: false };
  }

  const smsActionUrl =
    event.type === EventType.IN_PERSON
      ? null
      : (await resolveStaffNoticeSmsUrl({
          guestId: guest.id,
          eventId: event.id,
          internalCheckInMode: event.internalStaffCheckInMode,
          internalCheckInToken: guest.internalCheckInToken
        })) ?? actionUrl;

  const branding = resolveDefaultEventBranding(event.org, {
    brandLogoUrl: event.brandLogoUrl,
    brandPrimaryColor: event.brandPrimaryColor
  });

  const locationLabel = formatLocationLine(event.location ?? { name: "", address: "" });
  const platformLine = resolvePlatformLine({
    eventType: event.type,
    locationLabel,
    meetingRoom: resolvedMeetingRoom
  });
  const fallbackContext =
    cleanNoticeContextForDisplay(storedContext) || event.description?.trim() || null;
  const context =
    event.internalStaffEmailTemplateKind === InternalStaffEmailTemplateKind.BLANK
      ? cleanNoticeContextForDisplay(storedContext)
      : fallbackContext;
  const copy = buildInternalStaffNoticeCopy({
    noticeKind: event.internalStaffNoticeKind,
    eventName: event.name
  });

  let emailed = false;
  let smsSent = false;
  let whatsappSent = false;

  if (guestHasDeliverableEmail(guest.email)) {
    try {
      const subject = resolveInternalStaffNoticeSubject({
        noticeKind: event.internalStaffNoticeKind,
        eventName: event.name,
        customSubject: event.internalStaffNoticeSubject
      });
      const memoFrom = resolveMemoFrom(event);

      let html: string;
      if (
        event.internalStaffEmailTemplateKind === InternalStaffEmailTemplateKind.BLANK &&
        options?.blankEmailTemplateHtml
      ) {
        const mergeValues = resolveStaffNoticeMergeValues({
          guest: { name: guest.name, email: guest.email },
          event: {
            name: event.name,
            date: event.date,
            noticeKind: event.internalStaffNoticeKind,
            noticeSubject: event.internalStaffNoticeSubject
          },
          orgName: event.org.name,
          orgLogoUrl: branding.logoUrl,
          checkInLink: actionUrl,
          memo: {
            memoTo: audienceTo,
            memoFrom,
            memoCc: event.internalStaffNoticeCc,
            memoDate: new Date(),
            meetingRoom: resolvedMeetingRoom,
            venueLine: platformLine
          }
        });
        html = renderStaffNoticeEmailFromTemplate(options.blankEmailTemplateHtml, mergeValues, subject);
      } else if (event.internalStaffEmailTemplateKind === InternalStaffEmailTemplateKind.BLANK) {
        html = wrapStaffNoticeEmailDocument({
          subject,
          bodyHtml:
            '<p style="margin:0;padding:24px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;color:#1a1a1a;">No custom email content has been configured for this programme.</p>'
        });
      } else {
        html = renderInternalStaffNoticeEmailHtml({
          to: guest.email!,
          guestName: guest.name,
          orgName: event.org.name,
          orgLogoUrl: branding.logoUrl,
          brandColors: {
            primary: branding.primary,
            secondary: branding.secondary,
            tertiary: branding.tertiary
          },
          eventName: event.name,
          eventDate: event.date,
          noticeKind: event.internalStaffNoticeKind,
          emailTemplateKind: event.internalStaffEmailTemplateKind,
          memoTo: audienceTo,
          memoFrom,
          memoCc: event.internalStaffNoticeCc,
          memoDate: new Date(),
          memoSubject: event.internalStaffNoticeSubject,
          contextParagraph: context,
          platformLine,
          checkInInstruction: resolveStaffNoticeCheckInInstruction({
            eventType: event.type,
            checkInMode: event.internalStaffCheckInMode,
            hasPersonalLink
          }),
          actionUrl,
          actionLabel: resolveStaffNoticeActionLabel({
            eventType: event.type,
            hasActionUrl: Boolean(actionUrl)
          }),
          resendApiKeyOverride: resendKey
        });
      }
      await sendTransactionalEmail({
        to: guest.email!,
        subject,
        html,
        resendApiKeyOverride: resendKey
      });
      emailed = true;
    } catch {
      /* best effort */
    }
  }

  const smsBody = renderInternalStaffNoticeSms({
    noticeKind: event.internalStaffNoticeKind,
    eventName: event.name,
    eventDate: event.date,
    hasPersonalLink,
    actionUrl: smsActionUrl,
    smsTemplateKind: event.internalStaffSmsTemplateKind,
    smsCustomText: event.internalStaffSmsCustomText
  });
  const smsRecipient = phoneToMnotifyRecipient(guest.phone);
  if (smsRecipient) {
    const smsRes = await sendOrgMnotifyQuickSms(event.orgId, [smsRecipient], smsBody);
    await logMnotifySmsDelivery({
      orgId: event.orgId,
      guestId: guest.id,
      eventId: event.id,
      kind: "staff_notice",
      recipient: guest.phone ?? smsRecipient,
      messageBody: smsBody,
      smsRes
    });
    if (smsRes.ok) smsSent = true;
  }

  const phone = guest.phone?.trim();
  const wantWa = event.org.whatsappEnabled && phone && isValidE164(phone);
  if (wantWa) {
    const wa = await sendOrgWhatsAppText(
      event.orgId,
      phone,
      event.type === EventType.IN_PERSON
        ? `${copy.sessionLabel}: ${event.name}. ${platformLine}`
        : smsActionUrl
          ? `${copy.sessionLabel}: ${event.name}. ${hasPersonalLink ? "Your personal Zoom link: " : "Check-in: "}${smsActionUrl}`
          : `${copy.sessionLabel}: ${event.name}. Check your email for full notice.`
    );
    if (wa.ok) whatsappSent = true;
  }

  const skippedNoContact = !emailed && !smsSent && !whatsappSent;

  if (emailed || smsSent) {
    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        ...(emailed ? { staffBriefingSentAt: new Date() } : {}),
        ...(smsSent ? { staffBriefingSmsSentAt: new Date() } : {})
      }
    });
  }

  return { emailed, smsSent, whatsappSent, skippedNoUrl: false, skippedNoContact };
}

export async function dispatchInternalStaffRosterNotices(
  eventId: string,
  options?: DispatchRosterNoticesOptions
): Promise<DispatchRosterNoticesResult> {
  const forceResend = options?.forceResend ?? false;
  const onlyUnnotified = options?.onlyUnnotified ?? !forceResend;

  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: eventSelect
  });

  const empty: DispatchRosterNoticesResult = {
    emailed: 0,
    smsSent: 0,
    whatsappSent: 0,
    skippedNoUrl: 0,
    skippedNoContact: 0
  };

  if (!event) return empty;
  if (event.blueprintTemplate !== EventBlueprintTemplate.INTERNAL_STAFF) return empty;
  if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.LIVE) return empty;

  if (event.internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK) {
    await ensurePersonalLinkTokensForDirectoryGuests(eventId);
  }

  const audience = internalStaffAudienceForPrisma(
    EventBlueprintTemplate.INTERNAL_STAFF,
    event.internalStaffAudience
  );
  const audienceTo = resolveMemoToForEvent(event.internalStaffNoticeTo, audience);

  let blankEmailTemplateHtml: string | null = null;
  if (event.internalStaffEmailTemplateKind === InternalStaffEmailTemplateKind.BLANK) {
    try {
      const mailyDoc = parseInternalStaffEmailMailyJson(event.internalStaffEmailMailyJson);
      blankEmailTemplateHtml = await compileStaffNoticeEmailTemplateHtml(mailyDoc);
    } catch {
      blankEmailTemplateHtml = null;
    }
  }

  const guests = await prisma.guest.findMany({
    where: {
      eventId,
      status: { not: GuestStatus.DECLINED },
      notificationsSuppressedAt: null,
      ...(onlyUnnotified && !forceResend ? { staffBriefingSentAt: null } : {})
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      internalCheckInToken: true,
      qrCode: true,
      zoomLink: true,
      invitationToken: true
    }
  });

  const rosterGuests = guests.filter(isDirectoryRosterGuest);

  let emailed = 0;
  let smsSent = 0;
  let whatsappSent = 0;
  let skippedNoUrl = 0;
  let skippedNoContact = 0;

  for (const g of rosterGuests) {
    const res = await sendNoticeToGuest(event, g, audienceTo, { blankEmailTemplateHtml });
    if (res.emailed) emailed += 1;
    if (res.smsSent) smsSent += 1;
    if (res.whatsappSent) whatsappSent += 1;
    if (res.skippedNoUrl) skippedNoUrl += 1;
    if (res.skippedNoContact) skippedNoContact += 1;
  }

  return { emailed, smsSent, whatsappSent, skippedNoUrl, skippedNoContact };
}

export type DispatchPersonalLinksResult = {
  emailed: number;
  whatsappSent: number;
  skippedNoUrl: number;
  skippedNoContact: number;
};

export async function sendInternalStaffNoticeToGuestById(
  eventId: string,
  guestId: string
): Promise<{ emailed: boolean; smsSent: boolean }> {
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: eventSelect
  });
  if (!event || event.blueprintTemplate !== EventBlueprintTemplate.INTERNAL_STAFF) {
    return { emailed: false, smsSent: false };
  }
  if (event.internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK) {
    await ensurePersonalLinkTokensForDirectoryGuests(eventId);
  }
  let guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      internalCheckInToken: true,
      qrCode: true,
      zoomLink: true,
      invitationToken: true
    }
  });
  if (!guest || !isDirectoryRosterGuest(guest)) {
    return { emailed: false, smsSent: false };
  }
  if (
    event.internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK &&
    !guest.internalCheckInToken
  ) {
    guest = await prisma.guest.findFirst({
      where: { id: guestId, eventId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        internalCheckInToken: true,
        qrCode: true,
        zoomLink: true,
        invitationToken: true
      }
    });
    if (!guest) return { emailed: false, smsSent: false };
  }
  const audience = internalStaffAudienceForPrisma(
    EventBlueprintTemplate.INTERNAL_STAFF,
    event.internalStaffAudience
  );
  let blankEmailTemplateHtml: string | null = null;
  if (event.internalStaffEmailTemplateKind === InternalStaffEmailTemplateKind.BLANK) {
    try {
      const mailyDoc = parseInternalStaffEmailMailyJson(event.internalStaffEmailMailyJson);
      blankEmailTemplateHtml = await compileStaffNoticeEmailTemplateHtml(mailyDoc);
    } catch {
      blankEmailTemplateHtml = null;
    }
  }
  const res = await sendNoticeToGuest(
    event,
    guest,
    resolveMemoToForEvent(event.internalStaffNoticeTo, audience),
    { blankEmailTemplateHtml }
  );
  return { emailed: res.emailed, smsSent: res.smsSent };
}

export async function dispatchInternalStaffPersonalCheckInLinks(
  eventId: string
): Promise<DispatchPersonalLinksResult> {
  const res = await dispatchInternalStaffRosterNotices(eventId, { forceResend: true });
  return {
    emailed: res.emailed,
    whatsappSent: res.whatsappSent,
    skippedNoUrl: res.skippedNoUrl,
    skippedNoContact: res.skippedNoContact
  };
}
