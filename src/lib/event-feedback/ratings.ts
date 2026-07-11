import { EventFeedbackRating } from "@prisma/client";

export const EVENT_FEEDBACK_RATINGS: EventFeedbackRating[] = [
  EventFeedbackRating.VERY_UNSATISFIED,
  EventFeedbackRating.UNSATISFIED,
  EventFeedbackRating.NEUTRAL,
  EventFeedbackRating.SATISFIED,
  EventFeedbackRating.VERY_SATISFIED
];

export type EventFeedbackRatingMeta = {
  rating: EventFeedbackRating;
  emoji: string;
  label: string;
  /** 1–5 for charts and satisfaction score */
  score: number;
};

export const EVENT_FEEDBACK_RATING_META: Record<EventFeedbackRating, EventFeedbackRatingMeta> = {
  [EventFeedbackRating.VERY_UNSATISFIED]: {
    rating: EventFeedbackRating.VERY_UNSATISFIED,
    emoji: "😞",
    label: "Very dissatisfied",
    score: 1
  },
  [EventFeedbackRating.UNSATISFIED]: {
    rating: EventFeedbackRating.UNSATISFIED,
    emoji: "😕",
    label: "Dissatisfied",
    score: 2
  },
  [EventFeedbackRating.NEUTRAL]: {
    rating: EventFeedbackRating.NEUTRAL,
    emoji: "😐",
    label: "Neutral",
    score: 3
  },
  [EventFeedbackRating.SATISFIED]: {
    rating: EventFeedbackRating.SATISFIED,
    emoji: "🙂",
    label: "Satisfied",
    score: 4
  },
  [EventFeedbackRating.VERY_SATISFIED]: {
    rating: EventFeedbackRating.VERY_SATISFIED,
    emoji: "😄",
    label: "Very satisfied",
    score: 5
  }
};

export function feedbackRatingLabel(rating: EventFeedbackRating): string {
  return EVENT_FEEDBACK_RATING_META[rating].label;
}

/** Mean score 1–5 and % promoters (4–5) minus detractors (1–2), scaled 0–100. */
export function computeFeedbackSatisfactionMetrics(
  distribution: Array<{ rating: EventFeedbackRating; count: number }>
) {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return { total: 0, averageScore: null as number | null, satisfactionPercent: null as number | null };
  }
  let sum = 0;
  let promoters = 0;
  let detractors = 0;
  for (const row of distribution) {
    const score = EVENT_FEEDBACK_RATING_META[row.rating].score;
    sum += score * row.count;
    if (score >= 4) promoters += row.count;
    if (score <= 2) detractors += row.count;
  }
  const averageScore = Math.round((sum / total) * 10) / 10;
  const satisfactionPercent = Math.round(((promoters - detractors) / total) * 100);
  return { total, averageScore, satisfactionPercent };
}
