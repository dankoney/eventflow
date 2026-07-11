"use server";

import { EventFeedbackRating, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/auth";
import {
  ATTENDED_GUEST_STATUSES,
  countAttendedGuestsPendingFeedback,
  getEventFeedbackAnalytics,
  listAttendedGuestsPendingFeedback
} from "@/lib/db/eventFeedback";
import { guestHasDeliverableEmail } from "@/lib/guest/contactRequirements";
import { DELIVERY_ERROR_CODES } from "@/lib/delivery/errorCodes";
import { logMnotifySmsDelivery, logResendEmailDelivery } from "@/lib/delivery/providerDelivery";
import { logGuestNotificationDelivery } from "@/lib/notifications/guestNotificationDispatch";
import { guestSegmentFilterSchema } from "@/lib/guests/segmentFilterSchema";
import { buildFeedbackReportPdf } from "@/lib/event-feedback/buildFeedbackReportPdf";
import {
  collectFeedbackAnswerColumns,
  feedbackQuestionCsvHeader,
  formatFeedbackAnswerForExport
} from "@/lib/event-feedback/feedbackResponseContent";
import { feedbackPendingResponseMetricLabel } from "@/lib/event-feedback/feedbackMetrics";
import { isFreeOrgPlan } from "@/lib/org/plan";
import { rowsToCsv } from "@/lib/csv";
import { hitSlidingWindow } from "@/lib/rateLimit/memorySlidingWindow";
import { ensureEventFeedbackShortCode, ensureGuestFeedbackLinkCredentials } from "@/lib/event-feedback/feedbackLinks";
import {
  mintAnonymousPortalFeedbackToken,
  recordAnonymousEventFeedback,
  recordEventFeedbackForGuest
} from "@/lib/event-feedback/recordFeedback";
import { formatResendErrorForClient, sendEventFeedbackRequestEmail } from "@/lib/email";
import {
  eventAllowsFeedbackRequestBlast,
  FEEDBACK_COLLECTION_DAYS,
  getEventFeedbackWindow,
  guestFeedbackClosedMessage
} from "@/lib/event-feedback/window";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { phoneToMnotifyRecipient, sendOrgMnotifyQuickSms } from "@/lib/mnotify";
import { canManageEventGuests } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { findAttendedGuestForFeedback } from "@/lib/event-feedback/portalGuestLookup";
import { feedbackPortalLookupNotFoundMessage } from "@/lib/event-feedback/portalCopy";
import { normalizeEmailOrPhoneCredential, normalizePortalLinkCredential } from "@/lib/phone/credentialLookup";
import {
  getEventFeedbackAbsoluteUrl,
  getEventFeedbackPortalAbsoluteUrl,
  getEventFeedbackRatingUrl,
  getEventFeedbackSmsAbsoluteUrl
} from "@/lib/url";
import { EVENT_FEEDBACK_RATINGS } from "@/lib/event-feedback/ratings";
import { formatDate } from "@/lib/utils";
import { ActionResult } from "@/types";
import { guardModuleAction } from "@/lib/features/moduleGuards";

const previewFeedbackBlastSchema = z.object({
  eventId: z.string().min(1),
  segmentFilter: guestSegmentFilterSchema.optional()
});

const listFeedbackBlastEligibleSchema = z.object({
  eventId: z.string().min(1)
});

const sendFeedbackBlastSchema = z.object({
  eventId: z.string().min(1),
  segmentFilter: guestSegmentFilterSchema.optional(),
  guestIds: z.array(z.string().min(1)).min(1).optional()
});

const submitFeedbackSchema = z.object({
  guestId: z.string().min(1),
  token: z.string().min(8),
  rating: z.nativeEnum(EventFeedbackRating),
  comment: z.string().trim().max(500).optional(),
  answers: z.record(z.string().trim().max(300)).optional(),
  submittedAnonymously: z.boolean().optional().default(false),
  marketingOptIn: z.boolean().optional().default(false)
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

export async function previewFeedbackBlastAudience(
  input: z.input<typeof previewFeedbackBlastSchema>
): Promise<ActionResult<{ count: number }>> {
  const moduleBlocked = guardModuleAction("feedback");
  if (moduleBlocked) return moduleBlocked;
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Only admins and marketing can send feedback requests." };
  }

  const parsed = previewFeedbackBlastSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  const count = await countAttendedGuestsPendingFeedback(
    parsed.data.eventId,
    session.user.orgId,
    parsed.data.segmentFilter
  );

  return { success: true, data: { count } };
}

export async function listFeedbackBlastEligibleGuests(
  input: z.input<typeof listFeedbackBlastEligibleSchema>
): Promise<
  ActionResult<{
    guests: Awaited<ReturnType<typeof listAttendedGuestsPendingFeedback>>;
  }>
> {
  const moduleBlocked = guardModuleAction("feedback");
  if (moduleBlocked) return moduleBlocked;
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Only admins and marketing can send feedback requests." };
  }

  const parsed = listFeedbackBlastEligibleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  const guests = await listAttendedGuestsPendingFeedback(parsed.data.eventId, session.user.orgId);
  return { success: true, data: { guests } };
}

export async function sendEventFeedbackRequestBlast(
  input: z.input<typeof sendFeedbackBlastSchema>
): Promise<
  ActionResult<{
    campaignId: string;
    recipientCount: number;
    sent: number;
    failed: number;
    skipped: number;
  }>
> {
  const moduleBlocked = guardModuleAction("feedback");
  if (moduleBlocked) return moduleBlocked;
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Only admins and marketing can send feedback requests." };
  }

  const parsed = sendFeedbackBlastSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  await syncEventStatusForEvent(parsed.data.eventId);

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    include: {
      org: { select: { name: true, resendApiKey: true, logo: true, defaultEventBrandLogoUrl: true } }
    }
  });
  if (!event) return { success: false, error: "Event not found." };

  const window = getEventFeedbackWindow({
    status: event.status,
    date: event.date,
    endDate: event.endDate
  });
  if (!eventAllowsFeedbackRequestBlast({ status: event.status, date: event.date, endDate: event.endDate })) {
    return {
      success: false,
      error:
        window.phase === "not_yet_open"
          ? "Feedback requests can be sent once the event has started."
          : window.phase === "closed"
            ? `The feedback collection period ended. Guests had ${FEEDBACK_COLLECTION_DAYS} days after the event to respond.`
            : guestFeedbackClosedMessage(window)
    };
  }

  const guests = await listAttendedGuestsPendingFeedback(
    parsed.data.eventId,
    session.user.orgId,
    parsed.data.guestIds ? undefined : parsed.data.segmentFilter,
    parsed.data.guestIds
  );
  if (guests.length === 0) {
    return {
      success: false,
      error:
        "Everyone who attended has already submitted feedback, or there are no eligible guests."
    };
  }

  const campaign = await prisma.eventFeedbackCampaign.create({
    data: {
      eventId: event.id,
      createdByUserId: session.user.id,
      recipientCount: guests.length,
      audienceGuestIds: parsed.data.guestIds ?? guests.map((g) => g.id)
    },
    select: { id: true }
  });

  const resendKey = event.org.resendApiKey?.trim() || undefined;
  const eventDateLabel = formatDate(event.date);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const guest of guests) {
    const credentials = await ensureGuestFeedbackLinkCredentials(guest);
    if (!credentials) {
      skipped += 1;
      void logGuestNotificationDelivery({
        guestId: guest.id,
        eventId: event.id,
        kind: "feedback_request",
        channel: "NONE",
        status: "SKIPPED",
        detail: "Could not generate feedback link credentials.",
        errorCode: DELIVERY_ERROR_CODES.UNKNOWN
      });
      continue;
    }
    const { token, smsCode } = credentials;

    const feedbackUrl = getEventFeedbackAbsoluteUrl(guest.id, token);
    const smsFeedbackUrl = getEventFeedbackSmsAbsoluteUrl(smsCode) ?? feedbackUrl;
    if (!feedbackUrl || !smsFeedbackUrl) {
      skipped += 1;
      void logGuestNotificationDelivery({
        guestId: guest.id,
        eventId: event.id,
        kind: "feedback_request",
        channel: "NONE",
        status: "SKIPPED",
        detail: "Feedback URLs could not be built.",
        errorCode: DELIVERY_ERROR_CODES.UNKNOWN
      });
      continue;
    }

    const ratingUrls: Partial<Record<(typeof EVENT_FEEDBACK_RATINGS)[number], string>> = {};
    for (const rating of EVENT_FEEDBACK_RATINGS) {
      const url = getEventFeedbackRatingUrl(guest.id, token, rating);
      if (url) ratingUrls[rating] = url;
    }

    let emailDelivered = false;
    let smsDelivered = false;

    if (guestHasDeliverableEmail(guest.email) && guest.email) {
      try {
        const emailRes = await sendEventFeedbackRequestEmail({
          to: guest.email,
          guestName: guest.name,
          eventName: event.name,
          eventDate: eventDateLabel,
          orgName: event.org.name,
          brandLogoUrl: event.brandLogoUrl,
          orgLogoUrl: event.org.logo,
          orgDefaultBrandLogoUrl: event.org.defaultEventBrandLogoUrl,
          brandPrimaryColor: event.brandPrimaryColor,
          feedbackUrl,
          ratingUrls,
          resendApiKeyOverride: resendKey
        });
        emailDelivered = true;
        await logResendEmailDelivery({
          orgId: event.orgId,
          guestId: guest.id,
          eventId: event.id,
          kind: "feedback_request",
          recipient: guest.email,
          resendMessageId: emailRes?.id ?? null
        });
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error("[feedback] email failed", guest.id, e);
        await logResendEmailDelivery({
          orgId: event.orgId,
          guestId: guest.id,
          eventId: event.id,
          kind: "feedback_request",
          recipient: guest.email,
          sendFailed: true,
          sendError: formatResendErrorForClient(detail)
        });
      }
    } else {
      void logGuestNotificationDelivery({
        guestId: guest.id,
        eventId: event.id,
        kind: "feedback_request",
        channel: "EMAIL",
        status: "SKIPPED",
        recipient: guest.email,
        detail: guest.email ? "Invalid or undeliverable email." : "No email on file.",
        errorCode: guest.email ? DELIVERY_ERROR_CODES.INVALID_EMAIL : DELIVERY_ERROR_CODES.NO_EMAIL
      });
    }

    const to = phoneToMnotifyRecipient(guest.phone);
    if (to) {
      const smsBody =
        `Thanks for attending ${event.name}! Share your feedback: ${smsFeedbackUrl}`.slice(0, 300);
      const smsRes = await sendOrgMnotifyQuickSms(event.orgId, [to], smsBody);
      if (smsRes.ok) smsDelivered = true;
      await logMnotifySmsDelivery({
        orgId: event.orgId,
        guestId: guest.id,
        eventId: event.id,
        kind: "feedback_request",
        recipient: guest.phone,
        messageBody: smsBody,
        smsRes
      });
    } else if (guest.phone?.trim()) {
      void logGuestNotificationDelivery({
        guestId: guest.id,
        eventId: event.id,
        kind: "feedback_request",
        channel: "SMS_ONLY",
        status: "SKIPPED",
        recipient: guest.phone,
        detail: "Invalid phone for SMS.",
        errorCode: DELIVERY_ERROR_CODES.INVALID_PHONE
      });
    } else {
      void logGuestNotificationDelivery({
        guestId: guest.id,
        eventId: event.id,
        kind: "feedback_request",
        channel: "SMS_ONLY",
        status: "SKIPPED",
        detail: "No phone on file.",
        errorCode: DELIVERY_ERROR_CODES.NO_PHONE
      });
    }

    if (emailDelivered || smsDelivered) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { feedbackRequestedAt: new Date() }
      });
      sent += 1;
    } else {
      failed += 1;
    }
  }

  await prisma.eventFeedbackCampaign.update({
    where: { id: campaign.id },
    data: { sentCount: sent, failedCount: failed, skippedCount: skipped }
  });

  revalidatePath(`/events/${parsed.data.eventId}/analytics`);
  revalidatePath(`/events/${parsed.data.eventId}/feedback`);
  revalidatePath(`/events/${parsed.data.eventId}/deliveries`);
  revalidatePath(`/events/${parsed.data.eventId}/guests`);

  return {
    success: true,
    data: {
      campaignId: campaign.id,
      recipientCount: guests.length,
      sent,
      failed,
      skipped
    }
  };
}

export async function submitEventFeedback(
  input: z.input<typeof submitFeedbackSchema>
): Promise<ActionResult<{ submitted: true }>> {
  const moduleBlocked = guardModuleAction("feedback");
  if (moduleBlocked) return moduleBlocked;
  const parsed = submitFeedbackSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const result = await recordEventFeedbackForGuest({
    guestId: parsed.data.guestId,
    token: parsed.data.token,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    mergeComment: true,
    answers: parsed.data.answers,
    submittedAnonymously: parsed.data.submittedAnonymously
  });

  if (!result.ok) return { success: false, error: result.error };

  const { recordFeedbackMarketingOptInIfEligible } = await import(
    "@/lib/event-feedback/feedbackMarketingOptIn"
  );
  await recordFeedbackMarketingOptInIfEligible({
    guestId: parsed.data.guestId,
    marketingOptIn: parsed.data.marketingOptIn ?? false
  });

  return { success: true, data: { submitted: true } };
}

const feedbackPortalLookupSchema = z.object({
  shortCode: z.string().trim().min(4).max(32),
  emailOrPhone: z.string().trim().min(3).max(200)
});

const feedbackPortalShortCodeSchema = z.object({
  shortCode: z.string().trim().min(4).max(32)
});

const submitAnonymousFeedbackSchema = z.object({
  eventId: z.string().min(1),
  portalToken: z.string().min(8),
  rating: z.nativeEnum(EventFeedbackRating),
  comment: z.string().trim().max(500).optional(),
  answers: z.record(z.string().trim().max(300)).optional()
});

const PORTAL_RL_MAX = 20;
const PORTAL_RL_WINDOW_MS = 600_000;

function portalClientIp(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || h.get("cf-connecting-ip")?.trim() || "unknown";
}

/** Public — guest enters email or phone on `/fb/[code]` to reach their personal feedback form. */
export async function lookupFeedbackPortalGuest(
  input: z.input<typeof feedbackPortalLookupSchema>
): Promise<ActionResult<{ redirectPath: string }>> {
  const moduleBlocked = guardModuleAction("feedback");
  if (moduleBlocked) return moduleBlocked;
  const parsed = feedbackPortalLookupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const credential = normalizeEmailOrPhoneCredential(parsed.data.emailOrPhone);
  if (!credential.ok) return { success: false, error: credential.error };

  const ip = portalClientIp();
  const rl = hitSlidingWindow(
    `feedback-portal:${parsed.data.shortCode}:${ip}`,
    PORTAL_RL_MAX,
    PORTAL_RL_WINDOW_MS
  );
  if (!rl.ok) {
    const sec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { success: false, error: `Too many attempts. Please wait about ${sec}s and try again.` };
  }

  const event = await prisma.event.findFirst({
    where: { feedbackShortCode: parsed.data.shortCode },
    select: { id: true, status: true, date: true, endDate: true, name: true, type: true }
  });
  if (!event) {
    return { success: false, error: "This feedback link is invalid." };
  }

  await syncEventStatusForEvent(event.id);
  const refreshed = await prisma.event.findUnique({
    where: { id: event.id },
    select: { status: true, date: true, endDate: true }
  });
  if (!refreshed) {
    return { success: false, error: "This feedback link is invalid." };
  }

  const window = getEventFeedbackWindow(refreshed);
  if (window.phase !== "open") {
    return { success: false, error: guestFeedbackClosedMessage(window) };
  }

  const guest = await findAttendedGuestForFeedback(event.id, credential);

  if (!guest) {
    return {
      success: false,
      error: feedbackPortalLookupNotFoundMessage(event.type)
    };
  }

  const creds = await ensureGuestFeedbackLinkCredentials(guest);
  if (!creds) {
    return { success: false, error: "Could not open your feedback form. Please try again." };
  }

  return {
    success: true,
    data: {
      redirectPath: `/feedback/${encodeURIComponent(guest.id)}/${encodeURIComponent(creds.token)}`
    }
  };
}

async function resolvePortalEvent(shortCode: string) {
  const event = await prisma.event.findFirst({
    where: { feedbackShortCode: shortCode },
    select: { id: true, status: true, date: true, endDate: true, type: true }
  });
  if (!event) return { ok: false as const, error: "This feedback link is invalid." };

  await syncEventStatusForEvent(event.id);
  const refreshed = await prisma.event.findUnique({
    where: { id: event.id },
    select: { id: true, status: true, date: true, endDate: true, type: true }
  });
  if (!refreshed) return { ok: false as const, error: "This feedback link is invalid." };

  const window = getEventFeedbackWindow(refreshed);
  if (window.phase !== "open") {
    return { ok: false as const, error: guestFeedbackClosedMessage(window) };
  }

  return { ok: true as const, event: refreshed, window };
}

const portalFeedbackBodyBaseSchema = z.object({
  shortCode: z.string().trim().min(4).max(32),
  rating: z.nativeEnum(EventFeedbackRating),
  comment: z.string().trim().max(500).optional(),
  answers: z.record(z.string().trim().max(300)).optional(),
  marketingOptIn: z.boolean().optional().default(false),
  marketingEmail: z.string().trim().email().optional()
});

const portalFeedbackBodySchema = portalFeedbackBodyBaseSchema.superRefine((data, ctx) => {
  if (data.marketingOptIn && !data.marketingEmail?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter your email to receive marketing updates.",
      path: ["marketingEmail"]
    });
  }
});

const submitPortalFeedbackLinkedSchema = portalFeedbackBodyBaseSchema
  .extend({
    email: z.string().trim().email().optional(),
    phoneDialCode: z.string().trim().optional(),
    phoneNational: z.string().trim().optional()
  })
  .superRefine((data, ctx) => {
    const hasEmail = Boolean(data.email?.trim());
    const hasPhone = Boolean(data.phoneDialCode?.trim() && data.phoneNational?.trim());
    if (!hasEmail && !hasPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter your email or mobile number."
      });
    }
    if (data.marketingOptIn && !data.marketingEmail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter your email to receive marketing updates.",
        path: ["marketingEmail"]
      });
    }
  });

/** Public — portal QR/link: save feedback anonymously after form fill. */
export async function submitPortalFeedbackAnonymous(
  input: z.input<typeof portalFeedbackBodySchema>
): Promise<ActionResult<{ submitted: true }>> {
  const moduleBlocked = guardModuleAction("feedback");
  if (moduleBlocked) return moduleBlocked;
  const parsed = portalFeedbackBodySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const ip = portalClientIp();
  const rl = hitSlidingWindow(
    `feedback-portal-submit:${parsed.data.shortCode}:${ip}`,
    PORTAL_RL_MAX,
    PORTAL_RL_WINDOW_MS
  );
  if (!rl.ok) {
    const sec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { success: false, error: `Too many attempts. Please wait about ${sec}s and try again.` };
  }

  const resolved = await resolvePortalEvent(parsed.data.shortCode);
  if (!resolved.ok) return { success: false, error: resolved.error };

  const result = await recordAnonymousEventFeedback({
    eventId: resolved.event.id,
    portalToken: mintAnonymousPortalFeedbackToken(),
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    mergeComment: true,
    answers: parsed.data.answers
  });

  if (!result.ok) return { success: false, error: result.error };

  if (parsed.data.marketingOptIn && parsed.data.marketingEmail?.trim()) {
    const { recordPortalFeedbackMarketingOptIn } = await import(
      "@/lib/event-feedback/feedbackMarketingOptIn"
    );
    await recordPortalFeedbackMarketingOptIn({
      eventId: resolved.event.id,
      marketingEmail: parsed.data.marketingEmail.trim()
    });
  }

  return { success: true, data: { submitted: true } };
}

/** Public — portal QR/link: link feedback to guest registration after form fill. */
export async function submitPortalFeedbackLinked(
  input: z.input<typeof submitPortalFeedbackLinkedSchema>
): Promise<ActionResult<{ submitted: true }>> {
  const moduleBlocked = guardModuleAction("feedback");
  if (moduleBlocked) return moduleBlocked;
  const parsed = submitPortalFeedbackLinkedSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const credential = normalizePortalLinkCredential({
    email: parsed.data.email,
    phoneDialCode: parsed.data.phoneDialCode,
    phoneNational: parsed.data.phoneNational
  });
  if (!credential.ok) return { success: false, error: credential.error };

  const ip = portalClientIp();
  const rl = hitSlidingWindow(
    `feedback-portal-link:${parsed.data.shortCode}:${ip}`,
    PORTAL_RL_MAX,
    PORTAL_RL_WINDOW_MS
  );
  if (!rl.ok) {
    const sec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { success: false, error: `Too many attempts. Please wait about ${sec}s and try again.` };
  }

  const resolved = await resolvePortalEvent(parsed.data.shortCode);
  if (!resolved.ok) return { success: false, error: resolved.error };

  const guest = await findAttendedGuestForFeedback(resolved.event.id, credential);
  if (!guest) {
    return { success: false, error: feedbackPortalLookupNotFoundMessage(resolved.event.type) };
  }

  const creds = await ensureGuestFeedbackLinkCredentials(guest);
  if (!creds) {
    return { success: false, error: "Could not save your feedback. Please try again." };
  }

  const result = await recordEventFeedbackForGuest({
    guestId: guest.id,
    token: creds.token,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    mergeComment: true,
    answers: parsed.data.answers,
    submittedAnonymously: false
  });

  if (!result.ok) return { success: false, error: result.error };

  if (parsed.data.marketingOptIn) {
    const { recordFeedbackMarketingOptInIfEligible, recordPortalFeedbackMarketingOptIn, getFeedbackMarketingOptInForGuest } =
      await import("@/lib/event-feedback/feedbackMarketingOptIn");
    const eligible = await getFeedbackMarketingOptInForGuest(guest.id);
    if (eligible?.show) {
      await recordFeedbackMarketingOptInIfEligible({
        guestId: guest.id,
        marketingOptIn: true
      });
    } else if (parsed.data.marketingEmail?.trim()) {
      await recordPortalFeedbackMarketingOptIn({
        eventId: resolved.event.id,
        marketingEmail: parsed.data.marketingEmail.trim()
      });
    }
  }

  return { success: true, data: { submitted: true } };
}

/** Public — start anonymous feedback (no email / phone). */
export async function startAnonymousFeedbackPortal(
  input: z.input<typeof feedbackPortalShortCodeSchema>
): Promise<ActionResult<{ redirectPath: string }>> {
  const moduleBlocked = guardModuleAction("feedback");
  if (moduleBlocked) return moduleBlocked;
  const parsed = feedbackPortalShortCodeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const ip = portalClientIp();
  const rl = hitSlidingWindow(
    `feedback-portal-anon:${parsed.data.shortCode}:${ip}`,
    PORTAL_RL_MAX,
    PORTAL_RL_WINDOW_MS
  );
  if (!rl.ok) {
    const sec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { success: false, error: `Too many attempts. Please wait about ${sec}s and try again.` };
  }

  const resolved = await resolvePortalEvent(parsed.data.shortCode);
  if (!resolved.ok) return { success: false, error: resolved.error };

  const portalToken = mintAnonymousPortalFeedbackToken();
  return {
    success: true,
    data: {
      redirectPath: `/feedback/anon/${encodeURIComponent(resolved.event.id)}/${encodeURIComponent(portalToken)}`
    }
  };
}

export async function submitAnonymousEventFeedback(
  input: z.input<typeof submitAnonymousFeedbackSchema>
): Promise<ActionResult<{ submitted: true }>> {
  const moduleBlocked = guardModuleAction("feedback");
  if (moduleBlocked) return moduleBlocked;
  const parsed = submitAnonymousFeedbackSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const result = await recordAnonymousEventFeedback({
    eventId: parsed.data.eventId,
    portalToken: parsed.data.portalToken,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    mergeComment: true,
    answers: parsed.data.answers
  });

  if (!result.ok) return { success: false, error: result.error };
  return { success: true, data: { submitted: true } };
}

const exportFeedbackReportSchema = z.object({
  eventId: z.string().min(1)
});

/** CSV export with summary metrics + all responses (including optional comments). */
export async function exportEventFeedbackReportCsv(
  input: z.input<typeof exportFeedbackReportSchema>
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const moduleBlocked = guardModuleAction("feedback");
  if (moduleBlocked) return moduleBlocked;
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Only admins and marketing can export feedback reports." };
  }

  const parsed = exportFeedbackReportSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, name: true, date: true, endDate: true, status: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  const analytics = await getEventFeedbackAnalytics(
    parsed.data.eventId,
    session.user.orgId,
    session.user.id,
    session.user.role
  );
  if (!analytics) return { success: false, error: "Could not load feedback data." };

  const summaryLines = [
    `# Event feedback report: ${event.name}`,
    `# Exported: ${formatDate(new Date())}`,
    `# Collection window: ${formatDate(analytics.window.opensAt)} – ${formatDate(analytics.window.closesAt)} (${analytics.collectionDays} days after event end)`,
    `# Window status: ${analytics.window.phase}`,
    `# Eligible attended: ${analytics.eligibleCount}`,
    `# ${feedbackPendingResponseMetricLabel(analytics.window)}: ${analytics.pendingResponseCount}`,
    `# Invited: ${analytics.requestedCount}`,
    `# Responses: ${analytics.responseCount}`,
    `# Response rate: ${analytics.responseRatePercent ?? "n/a"}%`,
    `# Average score (1-5): ${analytics.averageScore ?? "n/a"}`,
    `# Satisfaction index: ${analytics.satisfactionPercent ?? "n/a"}`,
    `# Responses with comments: ${analytics.commentsCount}`,
    `# Responses with written content (comment or question answers): ${analytics.writtenContentCount}`,
    `# Anonymous mode: ${analytics.feedbackAnonymous ? "on (names hidden in export)" : "off"}`,
    `# Rating distribution: ${analytics.distribution.map((d) => `${d.emoji} ${d.count} (${d.percent}%)`).join("; ")}`,
    ""
  ];

  const answerColumns = collectFeedbackAnswerColumns(
    analytics.feedbackQuestions,
    analytics.responses
  );
  const questionHeaders = answerColumns.map((col, i) =>
    feedbackQuestionCsvHeader(col.archived ? `${col.label} (archived)` : col.label, i)
  );

  const dataCsv = rowsToCsv(
    [
      analytics.feedbackAnonymous ? "Respondent" : "Guest name",
      "Email",
      "Company",
      "Rating",
      "Score (1-5)",
      "Comment",
      ...questionHeaders,
      "First submitted",
      "Last updated"
    ],
    analytics.responses.map((r) => [
      r.guestName,
      r.guestEmail,
      r.company ?? "",
      r.label,
      String(r.score),
      r.comment?.trim() ?? "",
      ...answerColumns.map((col) =>
        formatFeedbackAnswerForExport(col.question, r.answers?.[col.key])
      ),
      formatDate(r.submittedAt),
      formatDate(r.updatedAt)
    ])
  );

  const safeName = event.name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  const filename = `feedback-report-${safeName || parsed.data.eventId}-${new Date().toISOString().slice(0, 10)}.csv`;

  return {
    success: true,
    data: { csv: `${summaryLines.join("\r\n")}${dataCsv}`, filename }
  };
}

/** PDF export with summary metrics, rating breakdown, and all responses. */
export async function exportEventFeedbackReportPdf(
  input: z.input<typeof exportFeedbackReportSchema>
): Promise<ActionResult<{ pdfBase64: string; filename: string }>> {
  const moduleBlocked = guardModuleAction("feedback");
  if (moduleBlocked) return moduleBlocked;
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Only admins and marketing can export feedback reports." };
  }

  const parsed = exportFeedbackReportSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const [event, org] = await Promise.all([
    prisma.event.findFirst({
      where: { id: parsed.data.eventId, orgId: session.user.orgId },
      select: { id: true, name: true }
    }),
    prisma.organization.findFirst({
      where: { id: session.user.orgId },
      select: { plan: true }
    })
  ]);
  if (!event) return { success: false, error: "Event not found." };

  const analytics = await getEventFeedbackAnalytics(
    parsed.data.eventId,
    session.user.orgId,
    session.user.id,
    session.user.role
  );
  if (!analytics) return { success: false, error: "Could not load feedback data." };

  const pdfBytes = buildFeedbackReportPdf({
    eventName: event.name,
    exportedAt: new Date(),
    analytics,
    showWatermark: org ? isFreeOrgPlan(org.plan) : false
  });
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  const safeName = event.name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  const filename = `feedback-report-${safeName || parsed.data.eventId}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return { success: true, data: { pdfBase64, filename } };
}
