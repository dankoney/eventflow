"use server";

import {
  GuestMessageCampaignScope,
  GuestMessageChannel,
  GuestMessageDeliveryStatus,
  GuestStatus,
  Role
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  getGuestMessageCampaignDeliveries,
  listGuestMessageCampaignsForEvent
} from "@/lib/db/guestMessages";
import {
  personalizeGuestMessageTemplate,
  previewCustomGuestMessageSchema,
  sendCustomGuestBlastSchema,
  sendCustomGuestMessageSchema
} from "@/lib/guests/customGuestMessage";
import {
  createCampaignWithDeliveries,
  finalizeCampaignCounts,
  listEligibleCustomMessageGuests,
  loadEventMessagingBranding,
  recordGuestMessageDelivery,
  sendPersonalizedEmailToGuest,
  sendPersonalizedSmsToGuest,
  type GuestMessageRecipient
} from "@/lib/guests/dispatchCustomGuestMessage";
import { renderCustomGuestMessageEmailHtml } from "@/lib/email/customGuestMessageTemplate";
import { canManageEventGuests, mayEditOrDeleteGuestRow } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/types";

function canManageGuests(role: Parameters<typeof canManageEventGuests>[0]) {
  return canManageEventGuests(role);
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

export async function getEventMessagingContext(eventId: string): Promise<
  ActionResult<{
    eventName: string;
    eventDateLabel: string;
    locationLine: string | null;
    orgName: string;
    brandLogoUrl: string | null;
    brandPrimaryColor: string | null;
    eligibleGuestCount: number;
    previewGuest: { name: string; email: string | null; company: string | null } | null;
  }>
> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const branding = await loadEventMessagingBranding(eventId, session.user.orgId);
  if (!branding) return { success: false, error: "Event not found." };

  const guests = await listEligibleCustomMessageGuests(eventId, session.user.orgId);
  const preview = guests[0] ?? null;

  return {
    success: true,
    data: {
      eventName: branding.eventName,
      eventDateLabel: branding.eventDateLabel,
      locationLine: branding.locationLine,
      orgName: branding.orgName,
      brandLogoUrl: branding.brandLogoUrl,
      brandPrimaryColor: branding.brandPrimaryColor,
      eligibleGuestCount: guests.length,
      previewGuest: preview
        ? { name: preview.name, email: preview.email, company: preview.company }
        : null
    }
  };
}

export async function previewCustomGuestMessage(
  input: z.input<typeof previewCustomGuestMessageSchema>
): Promise<ActionResult<{ smsText?: string; emailHtml?: string; sampleName: string }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = previewCustomGuestMessageSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const branding = await loadEventMessagingBranding(parsed.data.eventId, session.user.orgId);
  if (!branding) return { success: false, error: "Event not found." };

  let sample: GuestMessageRecipient | null = null;
  if ("guestId" in parsed.data && parsed.data.guestId) {
    const guest = await prisma.guest.findFirst({
      where: {
        id: parsed.data.guestId,
        eventId: parsed.data.eventId,
        event: { orgId: session.user.orgId }
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
      }
    });
    if (!guest) return { success: false, error: "Guest not found." };
    sample = guest;
  } else {
    const guests = await listEligibleCustomMessageGuests(parsed.data.eventId, session.user.orgId);
    sample = guests[0] ?? null;
  }

  const sampleName = sample?.name ?? "Alex Morgan";
  const vars = {
    name: sampleName,
    email: sample?.email ?? "guest@example.com",
    eventName: branding.eventName,
    company: sample?.company ?? "Acme Corp"
  };

  if (parsed.data.channel === "sms") {
    const smsText = personalizeGuestMessageTemplate(parsed.data.message, vars);
    return { success: true, data: { smsText, sampleName } };
  }

  const emailHtml = renderCustomGuestMessageEmailHtml({
    guestName: sampleName,
    eventName: branding.eventName,
    eventDateLabel: branding.eventDateLabel,
    locationLine: branding.locationLine,
    orgName: branding.orgName,
    brandLogoUrl: branding.brandLogoUrl,
    brandPrimaryColor: branding.brandPrimaryColor,
    subject: personalizeGuestMessageTemplate(parsed.data.subject, vars),
    headline: personalizeGuestMessageTemplate(parsed.data.headline, vars),
    message: personalizeGuestMessageTemplate(parsed.data.message, vars)
  });

  return { success: true, data: { emailHtml, sampleName } };
}

export async function sendCustomMessageToGuest(
  input: z.input<typeof sendCustomGuestMessageSchema>
): Promise<ActionResult<{ sent: true; campaignId: string }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = sendCustomGuestMessageSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guest = await prisma.guest.findFirst({
    where: {
      id: parsed.data.guestId,
      eventId: parsed.data.eventId,
      event: { orgId: session.user.orgId }
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
    }
  });
  if (!guest) return { success: false, error: "Guest not found." };
  if (!mayEditOrDeleteGuestRow(session.user.role, session.user.id, guest.repId)) {
    return { success: false, error: "You do not have permission to message this guest." };
  }
  if (guest.status === GuestStatus.DECLINED) {
    return { success: false, error: "This guest declined. Custom messages are disabled." };
  }
  if (guest.notificationsSuppressedAt) {
    return { success: false, error: "Notifications are suppressed for this guest." };
  }

  const branding = await loadEventMessagingBranding(parsed.data.eventId, session.user.orgId);
  if (!branding) return { success: false, error: "Event not found." };

  const channel =
    parsed.data.channel === "sms" ? GuestMessageChannel.SMS : GuestMessageChannel.EMAIL;
  const templateBody =
    parsed.data.channel === "sms"
      ? parsed.data.message
      : parsed.data.message;

  const campaignId = await createCampaignWithDeliveries({
    eventId: parsed.data.eventId,
    createdByUserId: session.user.id,
    channel,
    scope: GuestMessageCampaignScope.SINGLE,
    templateSubject: parsed.data.channel === "email" ? parsed.data.subject : null,
    templateHeadline: parsed.data.channel === "email" ? parsed.data.headline : null,
    templateBody,
    recipientCount: 1
  });

  if (parsed.data.channel === "sms") {
    const result = await sendPersonalizedSmsToGuest(guest, branding, parsed.data.message);
    if (result.ok) {
      await recordGuestMessageDelivery({
        campaignId,
        guestId: guest.id,
        status: GuestMessageDeliveryStatus.SENT
      });
      await finalizeCampaignCounts(campaignId);
      revalidatePath(`/events/${parsed.data.eventId}/guests`);
      return { success: true, data: { sent: true, campaignId } };
    }
    await recordGuestMessageDelivery({
      campaignId,
      guestId: guest.id,
      status: result.skipped ? GuestMessageDeliveryStatus.SKIPPED : GuestMessageDeliveryStatus.FAILED,
      error: result.error
    });
    await finalizeCampaignCounts(campaignId);
    return { success: false, error: result.error };
  }

  const emailResult = await sendPersonalizedEmailToGuest(guest, branding, {
    subject: parsed.data.subject,
    headline: parsed.data.headline,
    message: parsed.data.message
  });
  if (!emailResult.ok) {
    await recordGuestMessageDelivery({
      campaignId,
      guestId: guest.id,
      status: GuestMessageDeliveryStatus.FAILED,
      error: emailResult.error
    });
    await finalizeCampaignCounts(campaignId);
    return { success: false, error: emailResult.error };
  }

  await recordGuestMessageDelivery({
    campaignId,
    guestId: guest.id,
    status: GuestMessageDeliveryStatus.SENT
  });
  await finalizeCampaignCounts(campaignId);
  revalidatePath(`/events/${parsed.data.eventId}/guests`);
  return { success: true, data: { sent: true, campaignId } };
}

export async function sendCustomGuestMessageBlast(
  input: z.input<typeof sendCustomGuestBlastSchema>
): Promise<
  ActionResult<{
    campaignId: string;
    sent: number;
    failed: number;
    skipped: number;
    recipientCount: number;
  }>
> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Only admins and marketing can blast all guests." };
  }

  const parsed = sendCustomGuestBlastSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const branding = await loadEventMessagingBranding(parsed.data.eventId, session.user.orgId);
  if (!branding) return { success: false, error: "Event not found." };

  const guests = await listEligibleCustomMessageGuests(parsed.data.eventId, session.user.orgId);
  if (guests.length === 0) {
    return { success: false, error: "No eligible registered guests to message." };
  }

  const channel =
    parsed.data.channel === "sms" ? GuestMessageChannel.SMS : GuestMessageChannel.EMAIL;
  const templateBody = parsed.data.channel === "sms" ? parsed.data.message : parsed.data.message;

  const campaignId = await createCampaignWithDeliveries({
    eventId: parsed.data.eventId,
    createdByUserId: session.user.id,
    channel,
    scope: GuestMessageCampaignScope.BLAST,
    templateSubject: parsed.data.channel === "email" ? parsed.data.subject : null,
    templateHeadline: parsed.data.channel === "email" ? parsed.data.headline : null,
    templateBody,
    recipientCount: guests.length
  });

  for (const guest of guests) {
    if (parsed.data.channel === "sms") {
      const result = await sendPersonalizedSmsToGuest(guest, branding, parsed.data.message);
      await recordGuestMessageDelivery({
        campaignId,
        guestId: guest.id,
        status: result.ok
          ? GuestMessageDeliveryStatus.SENT
          : result.skipped
            ? GuestMessageDeliveryStatus.SKIPPED
            : GuestMessageDeliveryStatus.FAILED,
        error: result.ok ? null : result.error
      });
    } else {
      const result = await sendPersonalizedEmailToGuest(guest, branding, {
        subject: parsed.data.subject,
        headline: parsed.data.headline,
        message: parsed.data.message
      });
      await recordGuestMessageDelivery({
        campaignId,
        guestId: guest.id,
        status: result.ok ? GuestMessageDeliveryStatus.SENT : GuestMessageDeliveryStatus.FAILED,
        error: result.ok ? null : result.error
      });
    }
  }

  const counts = await finalizeCampaignCounts(campaignId);
  revalidatePath(`/events/${parsed.data.eventId}/guests`);

  return {
    success: true,
    data: {
      campaignId,
      sent: counts.sent,
      failed: counts.failed,
      skipped: counts.skipped,
      recipientCount: guests.length
    }
  };
}

export async function listGuestMessageCampaignsAction(
  eventId: string
): Promise<ActionResult<Awaited<ReturnType<typeof listGuestMessageCampaignsForEvent>>>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const rows = await listGuestMessageCampaignsForEvent(eventId, session.user.orgId);
  return { success: true, data: rows };
}

export async function getGuestMessageCampaignDetailAction(
  eventId: string,
  campaignId: string
): Promise<
  ActionResult<Awaited<ReturnType<typeof getGuestMessageCampaignDeliveries>>>
> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const detail = await getGuestMessageCampaignDeliveries(campaignId, eventId, session.user.orgId);
  if (!detail.campaign) return { success: false, error: "Campaign not found." };
  return { success: true, data: detail };
}
