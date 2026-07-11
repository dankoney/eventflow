import { AttendMode, EventFeedbackRating } from "@prisma/client";

import { fetchResendEmailStatus } from "@/lib/delivery/providerDelivery";
import { renderCustomGuestMessageEmailHtml } from "@/lib/email/customGuestMessageTemplate";
import { renderEventFeedbackRequestEmailHtml } from "@/lib/email/eventFeedbackRequestTemplate";
import { renderInvitationEmailHtml } from "@/lib/email/invitationTemplate";
import { renderRegistrationInPersonEmailHtml } from "@/lib/email/registrationInPersonTemplate";
import { renderRegistrationVirtualEmailHtml } from "@/lib/email/registrationVirtualTemplate";
import { EVENT_FEEDBACK_RATINGS } from "@/lib/event-feedback/ratings";
import { ensureGuestFeedbackLinkCredentials } from "@/lib/event-feedback/feedbackLinks";
import { prisma } from "@/lib/prisma";
import {
  getEventFeedbackAbsoluteUrl,
  getEventFeedbackRatingUrl,
  getOpenZoomJoinAbsoluteUrl,
  getPublicSiteUrl,
  getRsvpAcceptAbsoluteUrl,
  getRsvpDeclineAbsoluteUrl
} from "@/lib/url";
import { formatDate, formatLocationLine } from "@/lib/utils";

async function getOrgResendApiKey(orgId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { resendApiKey: true }
  });
  const fromOrg = org?.resendApiKey?.trim() ?? "";
  if (fromOrg.length > 0) return fromOrg;
  const fromEnv = process.env.RESEND_API_KEY?.trim() ?? "";
  return fromEnv.length > 0 ? fromEnv : null;
}

async function loadEmailPreviewContext(guestId: string, eventId: string) {
  return prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: {
      id: true,
      name: true,
      email: true,
      mode: true,
      zoomLink: true,
      qrCode: true,
      invitationToken: true,
      feedbackToken: true,
      feedbackSmsCode: true,
      event: {
        select: {
          id: true,
          orgId: true,
          name: true,
          date: true,
          description: true,
          brandLogoUrl: true,
          bannerImageUrl: true,
          brandPrimaryColor: true,
          zoomJoinUrl: true,
          zoomMeetingId: true,
          zoomPasscode: true,
          location: { select: { name: true, address: true } },
          org: {
            select: {
              name: true,
              logo: true,
              defaultEventBrandLogoUrl: true
            }
          }
        }
      }
    }
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderReminderEmailHtml(opts: {
  guestName: string;
  headline: string;
  whenLabel: string;
  locationLabel: string;
  zoomLink?: string | null;
}): string {
  const extra: string[] = [];
  if (opts.zoomLink) {
    extra.push(
      `<p style="margin:12px 0 0"><strong>Virtual join:</strong> <a href="${escapeHtml(opts.zoomLink)}">${escapeHtml(opts.zoomLink)}</a></p>`
    );
  }
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#18181b;background:#fafafa">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:24px">
<p style="margin:0 0 12px">Hi ${escapeHtml(opts.guestName)},</p>
<p style="margin:0 0 12px">${escapeHtml(opts.headline)}</p>
<p style="margin:0"><strong>When:</strong> ${escapeHtml(opts.whenLabel)}<br/><strong>Where:</strong> ${escapeHtml(opts.locationLabel)}</p>
${extra.join("\n")}
<p style="margin:16px 0 0;color:#71717a;font-size:12px">— Eventflow</p>
</div></body></html>`;
}

/** Fetch stored HTML from Resend when a message id is available. */
export async function fetchResendEmailHtml(
  orgId: string,
  messageId: string
): Promise<string | null> {
  const apiKey = await getOrgResendApiKey(orgId);
  if (!apiKey) return null;
  const fetched = await fetchResendEmailStatus(apiKey, messageId);
  const html = fetched.record?.html?.trim();
  return html || null;
}

/** Rebuild branded HTML for a system notification email. */
export async function buildSystemEmailHtmlPreview(opts: {
  kind: string;
  guestId: string;
  eventId: string;
  providerRef?: string | null;
}): Promise<string | null> {
  const guest = await loadEmailPreviewContext(opts.guestId, opts.eventId);
  if (!guest) return null;

  const orgId = guest.event.orgId;
  if (opts.providerRef?.trim()) {
    const fromResend = await fetchResendEmailHtml(orgId, opts.providerRef);
    if (fromResend) return fromResend;
  }

  const event = guest.event;
  const org = event.org;
  const whenLabel = formatDate(event.date);
  const locationLine = formatLocationLine(event.location);
  const branding = {
    orgName: org.name,
    brandLogoUrl: event.brandLogoUrl,
    orgLogoUrl: org.logo,
    orgDefaultBrandLogoUrl: org.defaultEventBrandLogoUrl,
    brandPrimaryColor: event.brandPrimaryColor
  };

  switch (opts.kind) {
    case "invite":
    case "invite_resend": {
      if (!guest.invitationToken) return null;
      const acceptUrl =
        getRsvpAcceptAbsoluteUrl(guest.id, guest.invitationToken) ??
        `${getPublicSiteUrl()}/rsvp/${guest.id}/${guest.invitationToken}`;
      const declineUrl =
        getRsvpDeclineAbsoluteUrl(guest.id, guest.invitationToken) ??
        `${acceptUrl}/decline`;
      const directionsUrl = event.location?.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${event.location.name} ${event.location.address}`
          )}`
        : null;
      return renderInvitationEmailHtml({
        guestName: guest.name,
        eventName: event.name,
        eventDateLabel: whenLabel,
        locationLine,
        acceptUrl,
        declineUrl,
        hookCopy: event.description,
        directionsUrl,
        siteBaseUrl: getPublicSiteUrl(),
        bannerImageUrl: event.bannerImageUrl,
        ...branding
      });
    }
    case "feedback_request": {
      const credentials = await ensureGuestFeedbackLinkCredentials({
        id: guest.id,
        feedbackToken: guest.feedbackToken,
        feedbackSmsCode: guest.feedbackSmsCode
      });
      if (!credentials) return null;
      const feedbackUrl = getEventFeedbackAbsoluteUrl(guest.id, credentials.token);
      if (!feedbackUrl) return null;
      const ratingUrls: Partial<Record<EventFeedbackRating, string>> = {};
      for (const rating of EVENT_FEEDBACK_RATINGS) {
        const url = getEventFeedbackRatingUrl(guest.id, credentials.token, rating);
        if (url) ratingUrls[rating] = url;
      }
      return renderEventFeedbackRequestEmailHtml({
        guestName: guest.name,
        eventName: event.name,
        eventDateLabel: whenLabel,
        feedbackUrl,
        ratingUrls,
        ...branding
      });
    }
    case "registration_confirm": {
      if (guest.mode === AttendMode.VIRTUAL) {
        const zoomJoinUrl =
          getOpenZoomJoinAbsoluteUrl(guest.id) ?? guest.zoomLink ?? event.zoomJoinUrl;
        if (!zoomJoinUrl) return null;
        return renderRegistrationVirtualEmailHtml({
          guestName: guest.name,
          eventName: event.name,
          eventDateLabel: whenLabel,
          sessionLabel: "virtual meeting",
          zoomJoinUrl,
          zoomLinkTracksAttendance: true,
          meetingId: event.zoomMeetingId,
          passcode: event.zoomPasscode,
          ...branding
        });
      }
      const directionsUrl = event.location?.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${event.location.name} ${event.location.address}`
          )}`
        : null;
      return renderRegistrationInPersonEmailHtml({
        guestName: guest.name,
        eventName: event.name,
        eventDateLabel: whenLabel,
        locationLine,
        directionsUrl,
        ...branding
      });
    }
    case "reminder_primary":
    case "reminder":
      return renderReminderEmailHtml({
        guestName: guest.name,
        headline: `Reminder: ${event.name} is coming up`,
        whenLabel,
        locationLabel: locationLine
      });
    case "reminder_final": {
      const zoomLink =
        guest.mode === AttendMode.VIRTUAL
          ? getOpenZoomJoinAbsoluteUrl(guest.id) ?? guest.zoomLink ?? event.zoomJoinUrl
          : null;
      return renderReminderEmailHtml({
        guestName: guest.name,
        headline: `Starting soon: ${event.name}`,
        whenLabel,
        locationLabel: locationLine,
        zoomLink
      });
    }
    default:
      return null;
  }
}

export async function buildCustomEmailHtmlPreview(deliveryId: string): Promise<string | null> {
  const row = await prisma.guestMessageDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      guest: { select: { name: true } },
      campaign: {
        select: {
          channel: true,
          templateSubject: true,
          templateHeadline: true,
          templateBody: true,
          event: {
            select: {
              name: true,
              date: true,
              brandLogoUrl: true,
              brandPrimaryColor: true,
              location: { select: { name: true, address: true } },
              org: { select: { name: true } }
            }
          }
        }
      }
    }
  });
  if (!row || row.campaign.channel !== "EMAIL") return null;

  const event = row.campaign.event;
  return renderCustomGuestMessageEmailHtml({
    guestName: row.guest.name,
    eventName: event.name,
    eventDateLabel: formatDate(event.date),
    locationLine: formatLocationLine(event.location),
    orgName: event.org.name,
    brandLogoUrl: event.brandLogoUrl,
    brandPrimaryColor: event.brandPrimaryColor,
    subject: row.campaign.templateSubject ?? row.campaign.templateHeadline ?? "Message",
    headline: row.campaign.templateHeadline ?? row.campaign.templateSubject ?? "Message",
    message: row.campaign.templateBody
  });
}

export function htmlToPlainSummary(html: string, maxLen = 280): string {
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

export function looksLikeHtml(content: string): boolean {
  return /<(html|body|table|div|p)\b/i.test(content);
}

const PREVIEW_LOCK_STYLE = `<style id="eventflow-preview-lock">
  a, area, button, input, select, textarea, summary, label[for], [role="button"], [tabindex]:not([tabindex="-1"]) {
    pointer-events: none !important;
    cursor: default !important;
  }
  a { text-decoration: inherit; }
</style>`;

/** Strip navigation from email HTML for read-only in-app preview. */
export function prepareEmailPreviewHtml(html: string): string {
  let out = html
    .replace(/\sonclick\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\sonmousedown\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\shref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ' href="#" aria-disabled="true"')
    .replace(/<button\b/gi, "<button disabled tabindex=\"-1\"")
    .replace(/<input\b(?![^>]*\bdisabled\b)/gi, "<input disabled ");

  if (/<head\b[^>]*>/i.test(out)) {
    out = out.replace(/<head\b[^>]*>/i, (match) => `${match}${PREVIEW_LOCK_STYLE}`);
  } else if (/<html\b[^>]*>/i.test(out)) {
    out = out.replace(/<html\b[^>]*>/i, (match) => `${match}<head>${PREVIEW_LOCK_STYLE}</head>`);
  } else {
    out = `${PREVIEW_LOCK_STYLE}${out}`;
  }

  return out;
}
