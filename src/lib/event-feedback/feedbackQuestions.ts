import { z } from "zod";

import {
  inferLikertScaleId,
  likertLabelsForScaleId,
  likertScaleIdSchema,
  type LikertScaleId
} from "@/lib/event-feedback/likertScales";

export type { LikertScaleId };

export type TextFeedbackQuestion = {
  key: string;
  type: "text";
  prompt: string;
};

export type LikertFeedbackQuestion = {
  key: string;
  type: "likert";
  prompt: string;
  /** Preset Likert scale (satisfaction, likelihood, agreement, etc.). */
  scaleId?: LikertScaleId;
  /** Custom labels override when organizers need a bespoke scale. */
  scaleLabels?: string[];
};

export type CheckboxFeedbackQuestion = {
  key: string;
  type: "checkbox";
  prompt: string;
  options: string[];
  allowMultiple?: boolean;
};

export type EventFeedbackQuestion =
  | TextFeedbackQuestion
  | LikertFeedbackQuestion
  | CheckboxFeedbackQuestion;

const textQuestionSchema = z.object({
  key: z.string().min(1),
  type: z.literal("text"),
  prompt: z.string().min(1).max(200)
});

const likertQuestionSchema = z.object({
  key: z.string().min(1),
  type: z.literal("likert"),
  prompt: z.string().min(1).max(200),
  scaleId: likertScaleIdSchema.optional(),
  scaleLabels: z.array(z.string().min(1)).min(2).max(10).optional()
});

const checkboxQuestionSchema = z.object({
  key: z.string().min(1),
  type: z.literal("checkbox"),
  prompt: z.string().min(1).max(200),
  options: z.array(z.string().min(1).max(120)).min(1).max(12),
  allowMultiple: z.boolean().optional()
});

const feedbackQuestionSchema = z.discriminatedUnion("type", [
  textQuestionSchema,
  likertQuestionSchema,
  checkboxQuestionSchema
]);

export const eventFeedbackQuestionsSchema = z.array(feedbackQuestionSchema).max(20);

/** Trim prompts and drop invalid rows before persisting templates or event forms. */
export function normalizeFeedbackQuestionsForPersistence(
  questions: EventFeedbackQuestion[]
): EventFeedbackQuestion[] {
  const out: EventFeedbackQuestion[] = [];
  for (const q of questions) {
    const prompt = q.prompt.trim();
    if (!prompt) continue;
    if (q.type === "text") {
      out.push({ key: q.key, type: "text", prompt });
      continue;
    }
    if (q.type === "likert") {
      const scaleLabels = q.scaleLabels?.map((s) => s.trim()).filter(Boolean);
      const scaleId = q.scaleId ?? inferLikertScaleId(prompt, scaleLabels);
      out.push({
        key: q.key,
        type: "likert",
        prompt,
        scaleId,
        ...(scaleLabels && scaleLabels.length >= 2 ? { scaleLabels } : {})
      });
      continue;
    }
    const options = q.options.map((o) => o.trim()).filter(Boolean);
    if (options.length === 0) continue;
    out.push({
      key: q.key,
      type: "checkbox",
      prompt,
      options,
      allowMultiple: q.allowMultiple ?? true
    });
  }
  return out;
}

export function likertLabelsForQuestion(q: LikertFeedbackQuestion): string[] {
  if (q.scaleLabels?.length && q.scaleLabels.length >= 2) {
    return q.scaleLabels;
  }
  const scaleId = q.scaleId ?? inferLikertScaleId(q.prompt, q.scaleLabels);
  return likertLabelsForScaleId(scaleId);
}

export function likertScaleIdForQuestion(q: LikertFeedbackQuestion): LikertScaleId {
  if (q.scaleId) return q.scaleId;
  if (q.scaleLabels?.length && q.scaleLabels.length >= 2) {
    return inferLikertScaleId(q.prompt, q.scaleLabels);
  }
  return inferLikertScaleId(q.prompt, null);
}

export function parseCheckboxAnswer(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      }
    } catch {
      /* fall through */
    }
  }
  return [trimmed];
}

export function serializeCheckboxAnswer(selected: string[]): string {
  if (selected.length === 0) return "";
  if (selected.length === 1) return selected[0]!;
  return JSON.stringify(selected);
}

export function parseEventFeedbackQuestionsJson(value: unknown): EventFeedbackQuestion[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];

  const normalized = value.map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const r = row as Record<string, unknown>;
      const type = r.type;
      const prompt = r.prompt;
      const key = r.key;

      if (
        type !== "text" &&
        type !== "likert" &&
        type !== "checkbox" &&
        typeof prompt === "string" &&
        typeof key === "string"
      ) {
        return { ...r, type: "text" };
      }

      if (type === "likert") {
        const scaleLabels = Array.isArray(r.scaleLabels)
          ? (r.scaleLabels as string[]).filter((s) => typeof s === "string" && s.trim())
          : undefined;
        const scaleId =
          typeof r.scaleId === "string" && likertScaleIdSchema.safeParse(r.scaleId).success
            ? r.scaleId
            : typeof prompt === "string"
              ? inferLikertScaleId(prompt, scaleLabels)
              : "satisfaction";
        const { scaleEmojis: _removed, ...rest } = r;
        return { ...rest, type: "likert", scaleId, scaleLabels };
      }

      if (type === "checkbox" && !Array.isArray(r.options)) {
        return { ...r, type: "checkbox", options: [] };
      }
      return r;
    }
    return row;
  });

  const parsed = eventFeedbackQuestionsSchema.safeParse(normalized);
  return parsed.success ? parsed.data : [];
}

export function parseEventFeedbackAnswersJson(
  value: unknown
): Record<string, string> | null {
  if (value == null) return null;
  if (typeof value !== "object") return null;
  const record: Record<string, unknown> = value as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "string" && v.trim().length > 0) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function formatCheckboxAnswerForDisplay(raw: string | undefined): string {
  const items = parseCheckboxAnswer(raw);
  if (items.length === 0) return "";
  return items.join(", ");
}
