import {
  GuestMessageCampaignScope,
  GuestMessageChannel,
  GuestMessageDeliveryStatus,
  GuestStatus
} from "@prisma/client";

import { formatResendErrorForClient, sendCustomGuestMessageEmail } from "@/lib/email";
import { phoneToMnotifyRecipient, sendOrgMnotifyQuickSms } from "@/lib/mnotify";
import { prisma } from "@/lib/prisma";
import {
  CUSTOM_MESSAGE_GUEST_STATUSES,
  GUEST_DIRECT_SMS_MAX,
  personalizeGuestMessageTemplate,
  type GuestMessageMergeVars
} from "@/lib/guests/customGuestMessage";
import { formatDate, formatLocationLine } from "@/lib/utils";

export type EventMessagingBranding = {
  eventId: string;
  orgId: string;
  eventName: string;
  eventDateLabel: string;
  locationLine: string | null;
  orgName: string;
  brandLogoUrl: string | null;
  brandPrimaryColor: string | null;
  resendApiKeyOverride?: string;
};

export type GuestMessageRecipient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  repId: string | null;
  status: GuestStatus;
  notificationsSuppressedAt: Date | null;
};

export async function loadEventMessagingBranding(
  eventId: string,
  orgId: string
): Promise<EventMessagingBranding | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    include: {
      location: true,
      org: { select: { name: true, resendApiKey: true } }
    }
  });
  if (!event) return null;
  return {
    eventId: event.id,
    orgId: event.orgId,
    eventName: event.name,
    eventDateLabel: formatDate(event.date),
    locationLine: formatLocationLine(event.location),
    orgName: event.org.name,
    brandLogoUrl: event.brandLogoUrl,
    brandPrimaryColor: event.brandPrimaryColor,
    resendApiKeyOverride: event.org.resendApiKey?.trim() || undefined
  };
}

export async function listEligibleCustomMessageGuests(
  eventId: string,
  orgId: string
): Promise<GuestMessageRecipient[]> {
  return prisma.guest.findMany({
    where: {
      eventId,
      event: { orgId },
      status: { in: [...CUSTOM_MESSAGE_GUEST_STATUSES] },
      notificationsSuppressedAt: null
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      repId: true,
      status: true,
      notificationsSuppressedAt: true
    },
    orderBy: { name: "asc" }
  });
}

function mergeVarsForGuest(guest: GuestMessageRecipient, branding: EventMessagingBranding): GuestMessageMergeVars {
  return {
    name: guest.name,
    email: guest.email ?? "",
    eventName: branding.eventName,
    company: guest.company
  };
}

export async function sendPersonalizedSmsToGuest(
  guest: GuestMessageRecipient,
  branding: EventMessagingBranding,
  template: string
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const body = personalizeGuestMessageTemplate(template, mergeVarsForGuest(guest, branding));
  if (body.length > GUEST_DIRECT_SMS_MAX) {
    return {
      ok: false,
      skipped: true,
      error: `Personalized SMS is ${body.length} characters (max ${GUEST_DIRECT_SMS_MAX}). Shorten the template or message.`
    };
  }
  const to = phoneToMnotifyRecipient(guest.phone);
  if (!to) {
    return { ok: false, skipped: true, error: "No valid mobile number on guest record." };
  }
  const smsRes = await sendOrgMnotifyQuickSms(branding.orgId, [to], body);
  if (!smsRes.ok) {
    return { ok: false, error: smsRes.error ?? "SMS could not be sent." };
  }
  return { ok: true };
}

export async function sendPersonalizedEmailToGuest(
  guest: GuestMessageRecipient,
  branding: EventMessagingBranding,
  templates: { subject: string; headline: string; message: string }
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const trimmed = guest.email?.trim();
  if (!trimmed) {
    return { ok: false, skipped: true, error: "No email address on guest record." };
  }
  const vars = mergeVarsForGuest(guest, branding);
  try {
    await sendCustomGuestMessageEmail({
      to: trimmed,
      guestName: guest.name,
      eventName: branding.eventName,
      eventDate: branding.eventDateLabel,
      locationLine: branding.locationLine,
      orgName: branding.orgName,
      brandLogoUrl: branding.brandLogoUrl,
      brandPrimaryColor: branding.brandPrimaryColor,
      subject: personalizeGuestMessageTemplate(templates.subject, vars),
      headline: personalizeGuestMessageTemplate(templates.headline, vars),
      message: personalizeGuestMessageTemplate(templates.message, vars),
      resendApiKeyOverride: branding.resendApiKeyOverride
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatResendErrorForClient(e) };
  }
}

export async function createCampaignWithDeliveries(input: {
  eventId: string;
  createdByUserId: string;
  channel: GuestMessageChannel;
  scope: GuestMessageCampaignScope;
  templateSubject: string | null;
  templateHeadline: string | null;
  templateBody: string;
  recipientCount: number;
}): Promise<string> {
  const row = await prisma.guestMessageCampaign.create({
    data: {
      eventId: input.eventId,
      createdByUserId: input.createdByUserId,
      channel: input.channel,
      scope: input.scope,
      templateSubject: input.templateSubject,
      templateHeadline: input.templateHeadline,
      templateBody: input.templateBody,
      recipientCount: input.recipientCount
    },
    select: { id: true }
  });
  return row.id;
}

export async function recordGuestMessageDelivery(input: {
  campaignId: string;
  guestId: string;
  status: GuestMessageDeliveryStatus;
  error?: string | null;
  sentAt?: Date | null;
}) {
  await prisma.guestMessageDelivery.create({
    data: {
      campaignId: input.campaignId,
      guestId: input.guestId,
      status: input.status,
      error: input.error?.slice(0, 500) ?? null,
      sentAt: input.sentAt ?? (input.status === GuestMessageDeliveryStatus.SENT ? new Date() : null)
    }
  });
}

export async function finalizeCampaignCounts(campaignId: string) {
  const grouped = await prisma.guestMessageDelivery.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true }
  });
  const counts = {
    sent: 0,
    failed: 0,
    skipped: 0
  };
  for (const g of grouped) {
    if (g.status === GuestMessageDeliveryStatus.SENT) counts.sent = g._count._all;
    if (g.status === GuestMessageDeliveryStatus.FAILED) counts.failed = g._count._all;
    if (g.status === GuestMessageDeliveryStatus.SKIPPED) counts.skipped = g._count._all;
  }
  await prisma.guestMessageCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount: counts.sent,
      failedCount: counts.failed,
      skippedCount: counts.skipped
    }
  });
  return counts;
}
