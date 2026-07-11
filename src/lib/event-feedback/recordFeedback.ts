import { EventFeedbackRating } from "@prisma/client";

import { EVENT_FEEDBACK_RATINGS } from "@/lib/event-feedback/ratings";
import { mintFeedbackToken } from "./feedbackLinks";
import {
  getEventFeedbackWindow,
  guestFeedbackClosedMessage
} from "@/lib/event-feedback/window";
import { prisma } from "@/lib/prisma";

export function parseFeedbackRatingParam(value: string | undefined | null): EventFeedbackRating | null {
  if (!value?.trim()) return null;
  const norm = value.trim().toUpperCase();
  return EVENT_FEEDBACK_RATINGS.find((r) => r === norm) ?? null;
}

export type RecordEventFeedbackResult =
  | { ok: true; rating: EventFeedbackRating }
  | { ok: false; error: string };

/**
 * Persist emoji rating (+ optional comment) for a guest magic-link token.
 * Used by the public page (?rating= one-click), the feedback form, and server actions.
 */
export async function recordEventFeedbackForGuest(input: {
  guestId: string;
  token: string;
  rating: EventFeedbackRating;
  comment?: string | null;
  /** Map question key -> answer. Stored as JSON on the response row. */
  answers?: Record<string, string> | null;
  /** When true, an empty comment clears any existing comment; when false, omit comment in DB update. */
  mergeComment?: boolean;
  /**
   * Guest chose to hide their name from organizers. Only applied on first create;
   * updates preserve the stored preference.
   */
  submittedAnonymously?: boolean;
}): Promise<RecordEventFeedbackResult> {
  if (!EVENT_FEEDBACK_RATINGS.includes(input.rating)) {
    return { ok: false, error: "Invalid rating." };
  }

  const guest = await prisma.guest.findFirst({
    where: {
      id: input.guestId,
      feedbackToken: input.token
    },
    select: {
      id: true,
      eventId: true,
      event: { select: { status: true, date: true, endDate: true } }
    }
  });
  if (!guest) {
    return { ok: false, error: "This feedback link is invalid or has expired." };
  }

  const window = getEventFeedbackWindow(guest.event);
  if (window.phase !== "open") {
    return { ok: false, error: guestFeedbackClosedMessage(window) };
  }

  const latestCampaign = await prisma.eventFeedbackCampaign.findFirst({
    where: { eventId: guest.eventId },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });

  const commentValue =
    input.mergeComment === true
      ? input.comment?.trim() || null
      : input.comment?.trim()
        ? input.comment.trim()
        : undefined;

  const answersValue = input.answers ?? undefined;

  await prisma.eventFeedbackResponse.upsert({
    where: {
      eventId_guestId: { eventId: guest.eventId, guestId: guest.id }
    },
    create: {
      eventId: guest.eventId,
      guestId: guest.id,
      campaignId: latestCampaign?.id ?? null,
      rating: input.rating,
      comment: commentValue ?? null,
      submittedAnonymously: input.submittedAnonymously ?? false,
      ...(answersValue !== undefined ? { answers: answersValue } : {})
    },
    update: {
      rating: input.rating,
      campaignId: latestCampaign?.id ?? undefined,
      ...(commentValue !== undefined ? { comment: commentValue } : {}),
      ...(answersValue !== undefined ? { answers: answersValue } : {})
    }
  });

  return { ok: true, rating: input.rating };
}

export function mintAnonymousPortalFeedbackToken(): string {
  return mintFeedbackToken();
}

/**
 * Anonymous portal submission — no guest identity stored.
 */
export async function recordAnonymousEventFeedback(input: {
  eventId: string;
  portalToken: string;
  rating: EventFeedbackRating;
  comment?: string | null;
  answers?: Record<string, string> | null;
  mergeComment?: boolean;
}): Promise<RecordEventFeedbackResult> {
  if (!EVENT_FEEDBACK_RATINGS.includes(input.rating)) {
    return { ok: false, error: "Invalid rating." };
  }

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, status: true, date: true, endDate: true }
  });
  if (!event) {
    return { ok: false, error: "This feedback link is invalid." };
  }

  const window = getEventFeedbackWindow(event);
  if (window.phase !== "open") {
    return { ok: false, error: guestFeedbackClosedMessage(window) };
  }

  const latestCampaign = await prisma.eventFeedbackCampaign.findFirst({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });

  const commentValue =
    input.mergeComment === true
      ? input.comment?.trim() || null
      : input.comment?.trim()
        ? input.comment.trim()
        : undefined;

  const answersValue = input.answers ?? undefined;

  const existing = await prisma.eventFeedbackResponse.findFirst({
    where: { eventId: event.id, portalAnonymousToken: input.portalToken },
    select: { id: true }
  });

  if (existing) {
    await prisma.eventFeedbackResponse.update({
      where: { id: existing.id },
      data: {
        rating: input.rating,
        campaignId: latestCampaign?.id ?? undefined,
        ...(commentValue !== undefined ? { comment: commentValue } : {}),
        ...(answersValue !== undefined ? { answers: answersValue } : {})
      }
    });
  } else {
    await prisma.eventFeedbackResponse.create({
      data: {
        eventId: event.id,
        guestId: null,
        portalAnonymousToken: input.portalToken,
        campaignId: latestCampaign?.id ?? null,
        rating: input.rating,
        comment: commentValue ?? null,
        ...(answersValue !== undefined ? { answers: answersValue } : {})
      }
    });
  }

  return { ok: true, rating: input.rating };
}
