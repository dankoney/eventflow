import { z } from "zod";

export const likertScaleIdSchema = z.enum([
  "satisfaction",
  "agreement",
  "likelihood",
  "frequency",
  "importance",
  "quality"
]);

export type LikertScaleId = z.infer<typeof likertScaleIdSchema>;

export type LikertScalePreset = {
  id: LikertScaleId;
  /** Short label for admin UI */
  name: string;
  description: string;
  labels: readonly [string, string, string, string, string];
};

export const LIKERT_SCALE_PRESETS: Record<LikertScaleId, LikertScalePreset> = {
  satisfaction: {
    id: "satisfaction",
    name: "Satisfaction",
    description: "Overall satisfaction or experience (e.g. sessions, venue, service).",
    labels: [
      "Very dissatisfied",
      "Dissatisfied",
      "Neutral",
      "Satisfied",
      "Very satisfied"
    ]
  },
  quality: {
    id: "quality",
    name: "Quality",
    description: "Perceived quality of content, delivery, or execution.",
    labels: ["Very poor", "Poor", "Average", "Good", "Excellent"]
  },
  agreement: {
    id: "agreement",
    name: "Agreement",
    description: "Agreement with a statement (e.g. “The check-in process was easy”).",
    labels: [
      "Strongly disagree",
      "Disagree",
      "Neither agree nor disagree",
      "Agree",
      "Strongly agree"
    ]
  },
  likelihood: {
    id: "likelihood",
    name: "Likelihood / recommendation",
    description: "How likely someone is to do something (e.g. recommend to a colleague).",
    labels: ["Very unlikely", "Unlikely", "Neutral", "Likely", "Very likely"]
  },
  frequency: {
    id: "frequency",
    name: "Frequency",
    description: "How often something happens.",
    labels: ["Never", "Rarely", "Sometimes", "Often", "Always"]
  },
  importance: {
    id: "importance",
    name: "Importance",
    description: "How important something is to the respondent.",
    labels: [
      "Not at all important",
      "Slightly important",
      "Moderately important",
      "Very important",
      "Extremely important"
    ]
  }
};

export const LIKERT_SCALE_LIST = Object.values(LIKERT_SCALE_PRESETS);

export function likertLabelsForScaleId(scaleId: LikertScaleId): string[] {
  return [...LIKERT_SCALE_PRESETS[scaleId].labels];
}

/** Guess scale from legacy data or question wording. */
export function inferLikertScaleId(
  prompt: string,
  customLabels?: string[] | null
): LikertScaleId {
  if (customLabels?.length) {
    for (const preset of LIKERT_SCALE_LIST) {
      if (
        preset.labels.length === customLabels.length &&
        preset.labels.every((l, i) => l === customLabels[i])
      ) {
        return preset.id;
      }
    }
  }

  const p = prompt.toLowerCase();
  if (
    /\brecommend\b/.test(p) ||
    /\blikely\b/.test(p) ||
    /\blikelihood\b/.test(p) ||
    /\bwould you\b/.test(p)
  ) {
    return "likelihood";
  }
  if (/\bagree\b/.test(p) || /\bstatement\b/.test(p) || /\btrue\b/.test(p)) {
    return "agreement";
  }
  if (/\bimportant\b/.test(p)) {
    return "importance";
  }
  if (/\bhow often\b/.test(p) || /\bfrequency\b/.test(p)) {
    return "frequency";
  }
  if (/\bquality\b/.test(p) || /\brate the quality\b/.test(p)) {
    return "quality";
  }
  if (/\bsatisf/i.test(p) || /\bexperience\b/.test(p)) {
    return "satisfaction";
  }

  return "satisfaction";
}
