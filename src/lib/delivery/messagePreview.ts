import { AttendMode } from "@prisma/client";

import { guestHasDeliverableEmail } from "@/lib/guest/contactRequirements";
import { resolveStoredDeliveryChannel } from "@/lib/delivery/deliveryChannel";
import {
  buildCustomEmailHtmlPreview,
  buildSystemEmailHtmlPreview,
  htmlToPlainSummary,
  looksLikeHtml,
  prepareEmailPreviewHtml
} from "@/lib/delivery/emailHtmlPreview";
import { prisma } from "@/lib/prisma";
import {
  renderEventReminderSms,
  renderGuestInviteSms,
  renderGuestRegistrationConfirmSms,
  renderGuestReminderSms
} from "@/lib/sms/guestNotificationCopy";
import { resolveGuestSmsPortalUrl } from "@/lib/guest/joinLinks";
import { getOpenZoomJoinAbsoluteUrl, getRsvpAcceptAbsoluteUrl } from "@/lib/url";
import { formatDate, formatLocationLine } from "@/lib/utils";

export type DeliveryMessageDetail = {
  channel: "EMAIL" | "SMS";
  status: string;
  recipient: string | null;
  subject: string | null;
  body: string;
  /** Rendered HTML for email previews (null for SMS or when unavailable). */
  bodyHtml: string | null;
  bodyFormat: "html" | "plain";
  kindLabel: string;
  guestName: string;
  eventName: string;
  sentAt: Date;
  errorDetail: string | null;
  providerRef: string | null;
  /** True when body was rebuilt from templates (not stored at send time). */
  reconstructed: boolean;
};

const EMAIL_SUBJECT_BY_KIND: Record<string, (eventName: string) => string> = {
  invite: (n) => `You're invited: ${n}`,
  invite_resend: (n) => `You're invited: ${n}`,
  registration_confirm: (n) => `You are registered: ${n}`,
  rsvp_confirm: (n) => `You're confirmed: ${n}`,
  checkin_confirm: (n) => `You're checked in: ${n}`,
  feedback_request: (n) => `How was ${n}? Quick feedback`,
  reminder_primary: (n) => `Reminder: ${n} is coming up`,
  reminder_final: (n) => `Starting soon: ${n}`,
  reminder: (n) => `Reminder: ${n} is coming up`
};

function emailSubject(kind: string, eventName: string): string {
  return (EMAIL_SUBJECT_BY_KIND[kind] ?? ((n: string) => `Message: ${n}`))(eventName);
}

function emailBodyFallback(kind: string, eventName: string, guestName: string): string {
  const lines = [`Hi ${guestName},`, ""];
  switch (kind) {
    case "invite":
    case "invite_resend":
      lines.push(
        `You are invited to ${eventName}.`,
        "This email includes Accept and Decline buttons plus event details."
      );
      break;
    case "registration_confirm":
      lines.push(`Your registration for ${eventName} is confirmed.`, "Check the email for your pass, QR, or join link.");
      break;
    case "rsvp_confirm":
      lines.push(`Your RSVP for ${eventName} is confirmed.`, "Includes calendar invite and attendance details.");
      break;
    case "checkin_confirm":
      lines.push(`You are checked in for ${eventName}.`, "Receipt-style confirmation with venue or session details.");
      break;
    case "feedback_request":
      lines.push(`We would love your feedback on ${eventName}.`, "Includes a link to the short feedback form.");
      break;
    case "reminder_primary":
    case "reminder":
      lines.push(`Reminder: ${eventName} is coming up.`, "Event date, location, and join details.");
      break;
    case "reminder_final":
      lines.push(`Final reminder: ${eventName} starts soon.`, "Last-chance details and join links.");
      break;
    default:
      lines.push(`Automated ${kind.replace(/_/g, " ")} for ${eventName}.`);
  }
  return lines.join("\n");
}

async function loadGuestEventContext(guestId: string, eventId: string) {
  return prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      mode: true,
      zoomLink: true,
      qrCode: true,
      invitationToken: true,
      event: {
        select: {
          id: true,
          name: true,
          date: true,
          zoomJoinUrl: true,
          location: { select: { name: true, address: true } }
        }
      }
    }
  });
}

function buildSmsPreview(
  kind: string,
  guest: NonNullable<Awaited<ReturnType<typeof loadGuestEventContext>>>,
  portalUrl: string | null
): string {
  const event = guest.event;
  const hasEmail = guestHasDeliverableEmail(guest.email);
  const rsvpUrl = guest.invitationToken
    ? getRsvpAcceptAbsoluteUrl(guest.id, guest.invitationToken)
    : null;
  const virtualJoinUrl =
    guest.mode === AttendMode.VIRTUAL
      ? getOpenZoomJoinAbsoluteUrl(guest.id) ?? guest.zoomLink ?? event.zoomJoinUrl
      : null;
  const smsCtx = {
    eventName: event.name,
    eventDate: event.date,
    hasEmail,
    rsvpUrl,
    portalUrl,
    virtualJoinUrl,
    attendanceMode: guest.mode,
    pollSuffix: ""
  };

  switch (kind) {
    case "invite":
    case "invite_resend":
      return renderGuestInviteSms(smsCtx);
    case "registration_confirm":
      return renderGuestRegistrationConfirmSms(smsCtx);
    case "reminder_primary":
    case "reminder":
      return renderEventReminderSms({
        eventName: event.name,
        whenLabel: formatDate(event.date),
        hasEmail,
        joinUrl: hasEmail ? null : portalUrl
      });
    case "reminder_final":
      return renderEventReminderSms({
        eventName: event.name,
        whenLabel: formatDate(event.date),
        hasEmail,
        joinUrl: virtualJoinUrl ?? (!hasEmail ? portalUrl : null),
        isFinal: true
      });
    case "checkin_confirm": {
      const first = guest.name.trim().split(/\s+/)[0] ?? "there";
      let body = `Hi ${first}, you're checked in for ${event.name} at ${formatDate(event.date)}.`;
      if (!hasEmail && portalUrl) body = `${body} Details: ${portalUrl}`;
      return body.slice(0, 300);
    }
    default:
      return renderGuestReminderSms(smsCtx);
  }
}

export async function buildSystemNotificationPreview(opts: {
  logId: string;
  guestId: string;
  eventId: string;
  kind: string;
  storedChannel: string;
  detail: string | null;
  messagePreview: string | null;
  status: string;
  recipient: string | null;
  providerRef: string | null;
  createdAt: Date;
  guestName: string;
  eventName: string;
}): Promise<DeliveryMessageDetail> {
  const channel = resolveStoredDeliveryChannel(opts.storedChannel, opts.detail);

  if (channel === "EMAIL") {
    const bodyHtml = await buildSystemEmailHtmlPreview({
      kind: opts.kind,
      guestId: opts.guestId,
      eventId: opts.eventId,
      providerRef: opts.providerRef
    });
    if (bodyHtml) {
      const safeHtml = prepareEmailPreviewHtml(bodyHtml);
      return {
        channel: "EMAIL",
        status: opts.status,
        recipient: opts.recipient,
        subject: emailSubject(opts.kind, opts.eventName),
        body: htmlToPlainSummary(bodyHtml),
        bodyHtml: safeHtml,
        bodyFormat: "html",
        kindLabel: opts.kind,
        guestName: opts.guestName,
        eventName: opts.eventName,
        sentAt: opts.createdAt,
        errorDetail: opts.status === "FAILED" || opts.status === "SKIPPED" ? opts.detail : null,
        providerRef: opts.providerRef,
        reconstructed: !opts.messagePreview?.trim()
      };
    }
  }

  if (opts.messagePreview?.trim()) {
    const isEmail = channel === "EMAIL";
    const preview = opts.messagePreview.trim();
    const isHtml = isEmail && looksLikeHtml(preview);
    const safeHtml = isHtml ? prepareEmailPreviewHtml(preview) : null;
    return {
      channel,
      status: opts.status,
      recipient: opts.recipient,
      subject: isEmail ? emailSubject(opts.kind, opts.eventName) : null,
      body: isHtml ? htmlToPlainSummary(preview) : preview,
      bodyHtml: safeHtml,
      bodyFormat: isHtml ? "html" : "plain",
      kindLabel: opts.kind,
      guestName: opts.guestName,
      eventName: opts.eventName,
      sentAt: opts.createdAt,
      errorDetail: opts.status === "FAILED" || opts.status === "SKIPPED" ? opts.detail : null,
      providerRef: opts.providerRef,
      reconstructed: false
    };
  }

  const guest = await loadGuestEventContext(opts.guestId, opts.eventId);
  if (!guest) {
    return {
      channel,
      status: opts.status,
      recipient: opts.recipient,
      subject: channel === "EMAIL" ? emailSubject(opts.kind, opts.eventName) : null,
      body:
        opts.detail && opts.detail !== "email" && opts.detail !== "sms"
          ? opts.detail
          : "Message content is no longer available.",
      bodyHtml: null,
      bodyFormat: "plain",
      kindLabel: opts.kind,
      guestName: opts.guestName,
      eventName: opts.eventName,
      sentAt: opts.createdAt,
      errorDetail: opts.status === "FAILED" || opts.status === "SKIPPED" ? opts.detail : null,
      providerRef: opts.providerRef,
      reconstructed: true
    };
  }

  const portalUrl = await resolveGuestSmsPortalUrl(guest.id);

  if (channel === "SMS") {
    return {
      channel: "SMS",
      status: opts.status,
      recipient: opts.recipient ?? guest.phone,
      subject: null,
      body: buildSmsPreview(opts.kind, guest, portalUrl),
      bodyHtml: null,
      bodyFormat: "plain",
      kindLabel: opts.kind,
      guestName: guest.name,
      eventName: guest.event.name,
      sentAt: opts.createdAt,
      errorDetail: opts.status === "FAILED" || opts.status === "SKIPPED" ? opts.detail : null,
      providerRef: opts.providerRef,
      reconstructed: true
    };
  }

  const subject = emailSubject(opts.kind, guest.event.name);
  const location = formatLocationLine(guest.event.location);
  const body = [
    emailBodyFallback(opts.kind, guest.event.name, guest.name),
    "",
    `Event: ${guest.event.name}`,
    `When: ${formatDate(guest.event.date)}`,
    location ? `Where: ${location}` : null,
    guest.email ? `Sent to: ${guest.email}` : null
  ]
    .filter(Boolean)
    .join("\n");

  return {
    channel: "EMAIL",
    status: opts.status,
    recipient: opts.recipient ?? guest.email,
    subject,
    body,
    bodyHtml: null,
    bodyFormat: "plain",
    kindLabel: opts.kind,
    guestName: guest.name,
    eventName: guest.event.name,
    sentAt: opts.createdAt,
    errorDetail: opts.status === "FAILED" || opts.status === "SKIPPED" ? opts.detail : null,
    providerRef: opts.providerRef,
    reconstructed: true
  };
}

export async function buildCustomMessagePreview(deliveryId: string): Promise<DeliveryMessageDetail | null> {
  const row = await prisma.guestMessageDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      status: true,
      error: true,
      sentAt: true,
      createdAt: true,
      guest: { select: { name: true, email: true, phone: true } },
      campaign: {
        select: {
          channel: true,
          templateSubject: true,
          templateHeadline: true,
          templateBody: true,
          event: { select: { name: true } }
        }
      }
    }
  });
  if (!row) return null;

  const channel = row.campaign.channel === "SMS" ? "SMS" : "EMAIL";
  const recipient = channel === "EMAIL" ? row.guest.email : row.guest.phone;

  const bodyHtml =
    channel === "EMAIL" ? await buildCustomEmailHtmlPreview(deliveryId) : null;
  const safeHtml = bodyHtml ? prepareEmailPreviewHtml(bodyHtml) : null;

  return {
    channel,
    status: row.status,
    recipient,
    subject: row.campaign.templateSubject ?? row.campaign.templateHeadline,
    body: bodyHtml ? htmlToPlainSummary(bodyHtml) : row.campaign.templateBody,
    bodyHtml: safeHtml,
    bodyFormat: safeHtml ? "html" : "plain",
    kindLabel: "custom_message",
    guestName: row.guest.name,
    eventName: row.campaign.event.name,
    sentAt: row.sentAt ?? row.createdAt,
    errorDetail: row.error,
    providerRef: null,
    reconstructed: false
  };
}
