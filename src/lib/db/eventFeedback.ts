import { EventFeedbackRating, GuestStatus, type CrmContactKind, type Prisma } from "@prisma/client";

import {
  computeFeedbackSatisfactionMetrics,
  EVENT_FEEDBACK_RATINGS,
  EVENT_FEEDBACK_RATING_META
} from "@/lib/event-feedback/ratings";
import {
  parseEventFeedbackAnswersJson,
  parseEventFeedbackQuestionsJson,
  type EventFeedbackQuestion
} from "@/lib/event-feedback/feedbackQuestions";
import { countResponsesWithWrittenContent } from "@/lib/event-feedback/feedbackResponseContent";
import {
  FEEDBACK_COLLECTION_DAYS,
  getEventFeedbackWindow,
  type EventFeedbackWindow
} from "@/lib/event-feedback/window";
import { prisma } from "@/lib/prisma";
import {
  isOrgWideRole,
  isSalesRepRole,
  scrubFeedbackResponseForSalesRep
} from "@/lib/permissions";
import {
  mergeGuestWhereWithSegment,
  type GuestSegmentFilterInput
} from "@/lib/guests/segmentFilters";
import { resolveGuestCompany } from "@/lib/guests/audienceRows";

/** Guests who attended onsite or virtually — eligible for post-event feedback. */
export const ATTENDED_GUEST_STATUSES: GuestStatus[] = [GuestStatus.CHECKED_IN, GuestStatus.JOINED];

export type EventFeedbackResponseRow = {
  id: string;
  guestName: string;
  guestEmail: string;
  company: string | null;
  rating: EventFeedbackRating;
  emoji: string;
  label: string;
  score: number;
  comment: string | null;
  answers: Record<string, string> | null;
  submittedAnonymously: boolean;
  submittedAt: Date;
  updatedAt: Date;
};

export const ANONYMOUS_FEEDBACK_RESPONDENT_LABEL = "Anonymous";

export function parseFeedbackCampaignAudienceGuestIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function getFeedbackBlastAudienceMetrics(
  eventId: string,
  audienceGuestIds: string[]
): Promise<{
  size: number;
  pendingResponseCount: number;
  invitedCount: number;
  responseCount: number;
}> {
  const ids = [...new Set(audienceGuestIds)];
  if (ids.length === 0) {
    return { size: 0, pendingResponseCount: 0, invitedCount: 0, responseCount: 0 };
  }

  const [pendingResponseCount, invitedCount, responseCount] = await Promise.all([
    prisma.guest.count({
      where: {
        id: { in: ids },
        eventId,
        status: { in: ATTENDED_GUEST_STATUSES },
        notificationsSuppressedAt: null,
        feedbackResponses: { none: { eventId } }
      }
    }),
    prisma.guest.count({
      where: {
        id: { in: ids },
        eventId,
        feedbackRequestedAt: { not: null }
      }
    }),
    prisma.eventFeedbackResponse.count({
      where: {
        eventId,
        guestId: { in: ids }
      }
    })
  ]);

  return {
    size: ids.length,
    pendingResponseCount,
    invitedCount,
    responseCount
  };
}

export function maskFeedbackResponseForDisplay(
  row: EventFeedbackResponseRow,
  feedbackAnonymous: boolean
): EventFeedbackResponseRow {
  if (!feedbackAnonymous && !row.submittedAnonymously) return row;
  return {
    ...row,
    guestName: ANONYMOUS_FEEDBACK_RESPONDENT_LABEL,
    guestEmail: "—",
    company: null
  };
}

export function shouldMaskFeedbackResponseForDisplay(input: {
  feedbackAnonymous: boolean;
  submittedAnonymously: boolean;
  guestId: string | null;
}): boolean {
  return input.feedbackAnonymous || input.submittedAnonymously || input.guestId == null;
}

export type EventFeedbackAnalytics = {
  feedbackAnonymous: boolean;
  window: EventFeedbackWindow;
  collectionDays: number;
  eligibleCount: number;
  /** Attended guests who have not submitted feedback yet (blast targets). */
  pendingResponseCount: number;
  requestedCount: number;
  responseCount: number;
  responseRatePercent: number | null;
  averageScore: number | null;
  satisfactionPercent: number | null;
  distribution: Array<{
    rating: EventFeedbackRating;
    emoji: string;
    label: string;
    count: number;
    percent: number;
  }>;
  responses: EventFeedbackResponseRow[];
  feedbackQuestions: EventFeedbackQuestion[];
  commentsCount: number;
  /** Responses with a comment and/or any optional question answer. */
  writtenContentCount: number;
  lastCampaignAt: Date | null;
  /** Scoped to the most recent feedback blast audience (when recorded). */
  blastAudience: {
    size: number;
    pendingResponseCount: number;
    invitedCount: number;
    responseCount: number;
  } | null;
  /** Guest ids from the latest blast — for follow-up dialog pre-selection. */
  lastBlastAudienceGuestIds: string[];
};

export async function countAttendedGuestsForEvent(eventId: string, orgId: string): Promise<number> {
  return prisma.guest.count({
    where: {
      eventId,
      event: { orgId },
      status: { in: ATTENDED_GUEST_STATUSES }
    }
  });
}

/** Checked-in / joined guests who have not submitted feedback yet. */
export type FeedbackBlastEligibleGuest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  contactCrmKind: CrmContactKind | null;
  contactCategory: string | null;
  eventGuestGroupId: string | null;
  eventGuestGroupName: string | null;
  feedbackToken: string | null;
  feedbackSmsCode: string | null;
};

export async function countAttendedGuestsPendingFeedback(
  eventId: string,
  orgId: string,
  segmentFilter?: GuestSegmentFilterInput
): Promise<number> {
  const baseWhere = {
    eventId,
    event: { orgId },
    status: { in: ATTENDED_GUEST_STATUSES },
    notificationsSuppressedAt: null,
    feedbackResponses: { none: { eventId } }
  };

  return prisma.guest.count({
    where: segmentFilter
      ? mergeGuestWhereWithSegment(baseWhere, segmentFilter)
      : baseWhere
  });
}

/** Checked-in / joined guests who have not submitted feedback yet. */
export async function listAttendedGuestsPendingFeedback(
  eventId: string,
  orgId: string,
  segmentFilter?: GuestSegmentFilterInput,
  guestIds?: string[]
): Promise<FeedbackBlastEligibleGuest[]> {
  const baseWhere = {
    eventId,
    event: { orgId },
    status: { in: ATTENDED_GUEST_STATUSES },
    notificationsSuppressedAt: null,
    feedbackResponses: { none: { eventId } },
    ...(guestIds?.length ? { id: { in: guestIds } } : {})
  };

  const rows = await prisma.guest.findMany({
    where: guestIds?.length
      ? baseWhere
      : segmentFilter
        ? mergeGuestWhereWithSegment(baseWhere, segmentFilter)
        : baseWhere,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      tier: true,
      eventGuestGroupId: true,
      feedbackToken: true,
      feedbackSmsCode: true,
      eventGuestGroup: { select: { name: true } },
      contact: { select: { category: true, crmKind: true, company: true } }
    },
    orderBy: { name: "asc" }
  });

  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    email: g.email,
    phone: g.phone,
    company: resolveGuestCompany(g.company, g.contact?.company),
    contactCrmKind: g.contact?.crmKind ?? null,
    contactCategory: g.contact?.category?.trim() || null,
    eventGuestGroupId: g.eventGuestGroupId,
    eventGuestGroupName: g.eventGuestGroup?.name ?? null,
    feedbackToken: g.feedbackToken,
    feedbackSmsCode: g.feedbackSmsCode
  }));
}

export async function listAttendedGuestsForFeedback(eventId: string, orgId: string) {
  return prisma.guest.findMany({
    where: {
      eventId,
      event: { orgId },
      status: { in: ATTENDED_GUEST_STATUSES },
      notificationsSuppressedAt: null
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      feedbackToken: true,
      feedbackSmsCode: true
    },
    orderBy: { name: "asc" }
  });
}

export async function listEventFeedbackResponsesForEvent(
  eventId: string,
  orgId: string,
  userId: string,
  role: Parameters<typeof isSalesRepRole>[0]
): Promise<EventFeedbackResponseRow[]> {
  const guestScope: Prisma.GuestWhereInput = {
    eventId,
    event: { orgId }
  };

  const rows = await prisma.eventFeedbackResponse.findMany({
    where: {
      eventId,
      OR: [{ guest: guestScope }, { guestId: null }]
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      answers: true,
      submittedAnonymously: true,
      guestId: true,
      createdAt: true,
      updatedAt: true,
      guest: {
        select: { name: true, email: true, company: true, repId: true }
      }
    }
  });

  return rows.map((r) => {
    const meta = EVENT_FEEDBACK_RATING_META[r.rating];
    const guestName = r.guest?.name ?? ANONYMOUS_FEEDBACK_RESPONDENT_LABEL;
    const guestEmail = r.guest?.email ?? "—";
    const company = r.guest?.company ?? null;
    const comment = r.comment?.trim() || null;
    const answers = parseEventFeedbackAnswersJson(r.answers);

    if (isSalesRepRole(role)) {
      const scrubbed = scrubFeedbackResponseForSalesRep({
        comment,
        guestName: r.guest?.name ?? null,
        guestRepId: r.guest?.repId ?? null,
        viewerUserId: userId,
        answers
      });
      return {
        id: r.id,
        guestName:
          r.guest?.repId && r.guest.repId !== userId
            ? ANONYMOUS_FEEDBACK_RESPONDENT_LABEL
            : guestName,
        guestEmail: r.guest?.repId === userId ? guestEmail : "—",
        company: r.guest?.repId === userId ? company : null,
        rating: r.rating,
        emoji: meta.emoji,
        label: meta.label,
        score: meta.score,
        comment: scrubbed.comment,
        answers: scrubbed.answers as Record<string, string> | null,
        submittedAnonymously: r.submittedAnonymously || r.guestId == null,
        submittedAt: r.createdAt,
        updatedAt: r.updatedAt
      };
    }

    return {
      id: r.id,
      guestName,
      guestEmail,
      company,
      rating: r.rating,
      emoji: meta.emoji,
      label: meta.label,
      score: meta.score,
      comment,
      answers,
      submittedAnonymously: r.submittedAnonymously || r.guestId == null,
      submittedAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  });
}

export async function getEventFeedbackAnalytics(
  eventId: string,
  orgId: string,
  userId: string,
  role: Parameters<typeof isSalesRepRole>[0] | Parameters<typeof isOrgWideRole>[0]
): Promise<EventFeedbackAnalytics | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: {
      id: true,
      status: true,
      date: true,
      endDate: true,
      feedbackQuestions: true,
      feedbackAnonymous: true
    }
  });
  if (!event) return null;

  const window = getEventFeedbackWindow(event);
  const feedbackQuestions = parseEventFeedbackQuestionsJson(event.feedbackQuestions);
  const guestScope: Prisma.GuestWhereInput = {
    eventId
  };

  const attendedScope: Prisma.GuestWhereInput = {
    ...guestScope,
    status: { in: ATTENDED_GUEST_STATUSES }
  };

  const attendedEligibleScope: Prisma.GuestWhereInput = {
    ...attendedScope,
    notificationsSuppressedAt: null
  };

  const [eligibleCount, pendingResponseCount, requestedCount, responses, lastCampaign] =
    await Promise.all([
    prisma.guest.count({ where: attendedEligibleScope }),
    prisma.guest.count({
      where: {
        ...attendedEligibleScope,
        feedbackResponses: { none: { eventId } }
      }
    }),
    prisma.guest.count({
      where: { ...attendedScope, feedbackRequestedAt: { not: null } }
    }),
    listEventFeedbackResponsesForEvent(eventId, orgId, userId, role),
    prisma.eventFeedbackCampaign.findFirst({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, audienceGuestIds: true }
    })
  ]);

  const lastBlastAudienceGuestIds = parseFeedbackCampaignAudienceGuestIds(
    lastCampaign?.audienceGuestIds
  );
  const blastAudience =
    lastBlastAudienceGuestIds.length > 0
      ? await getFeedbackBlastAudienceMetrics(eventId, lastBlastAudienceGuestIds)
      : null;

  const countByRating = new Map<EventFeedbackRating, number>();
  for (const r of EVENT_FEEDBACK_RATINGS) countByRating.set(r, 0);
  for (const row of responses) {
    countByRating.set(row.rating, (countByRating.get(row.rating) ?? 0) + 1);
  }

  const responseCount = responses.length;
  const distribution = EVENT_FEEDBACK_RATINGS.map((rating) => {
    const count = countByRating.get(rating) ?? 0;
    const meta = EVENT_FEEDBACK_RATING_META[rating];
    return {
      rating,
      emoji: meta.emoji,
      label: meta.label,
      count,
      percent: responseCount > 0 ? Math.round((count / responseCount) * 100) : 0
    };
  });

  const metrics = computeFeedbackSatisfactionMetrics(
    distribution.map((d) => ({ rating: d.rating, count: d.count }))
  );

  const responseRatePercent =
    requestedCount > 0 ? Math.round((responseCount / requestedCount) * 100) : null;

  const commentsCount = responses.filter((r) => r.comment?.trim()).length;
  const writtenContentCount = countResponsesWithWrittenContent(
    responses.map((r) => ({ comment: r.comment, answers: r.answers }))
  );

  const maskedResponses = responses.map((r) =>
    event.feedbackAnonymous || r.submittedAnonymously
      ? maskFeedbackResponseForDisplay(r, true)
      : r
  );

  return {
    feedbackAnonymous: event.feedbackAnonymous,
    window,
    collectionDays: FEEDBACK_COLLECTION_DAYS,
    eligibleCount,
    pendingResponseCount,
    requestedCount,
    responseCount,
    responseRatePercent,
    averageScore: metrics.averageScore,
    satisfactionPercent: metrics.satisfactionPercent,
    distribution,
    responses: maskedResponses,
    commentsCount,
    writtenContentCount,
    feedbackQuestions,
    lastCampaignAt: lastCampaign?.createdAt ?? null,
    blastAudience,
    lastBlastAudienceGuestIds
  };
}
