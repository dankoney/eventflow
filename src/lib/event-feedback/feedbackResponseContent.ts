import type { EventFeedbackQuestion } from "@/lib/event-feedback/feedbackQuestions";
import { formatCheckboxAnswerForDisplay } from "@/lib/event-feedback/feedbackQuestions";

export type FeedbackResponseContentInput = {
  comment: string | null;
  answers: Record<string, string> | null;
};

export type FeedbackAnswerColumn = {
  key: string;
  label: string;
  question: EventFeedbackQuestion | null;
  archived: boolean;
};

/** Union of current form questions and any answer keys stored on responses (survives template changes). */
export function collectFeedbackAnswerColumns(
  questions: EventFeedbackQuestion[],
  responses: FeedbackResponseContentInput[]
): FeedbackAnswerColumn[] {
  const byKey = new Map(questions.map((q) => [q.key, q]));
  const orderedKeys: string[] = questions.map((q) => q.key);

  for (const r of responses) {
    if (!r.answers) continue;
    for (const key of Object.keys(r.answers)) {
      if (!orderedKeys.includes(key)) orderedKeys.push(key);
    }
  }

  return orderedKeys.map((key, index) => {
    const question = byKey.get(key) ?? null;
    const archived = question === null;
    return {
      key,
      label: question?.prompt?.trim()
        ? question.prompt.trim()
        : `Previous question ${index + 1}`,
      question,
      archived
    };
  });
}

export function formatFeedbackAnswerForExport(
  question: EventFeedbackQuestion | null,
  raw: string | undefined
): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "";
  if (question?.type === "checkbox") {
    return formatCheckboxAnswerForDisplay(trimmed);
  }
  return trimmed;
}

export function responseHasWrittenContent(response: FeedbackResponseContentInput): boolean {
  if (response.comment?.trim()) return true;
  if (!response.answers) return false;
  return Object.values(response.answers).some((v) => typeof v === "string" && v.trim().length > 0);
}

export function countResponsesWithWrittenContent(
  responses: FeedbackResponseContentInput[]
): number {
  return responses.filter((r) => responseHasWrittenContent(r)).length;
}

/** Sanitize question prompt for CSV column headers. */
export function feedbackQuestionCsvHeader(label: string, index: number): string {
  const base = label.trim().slice(0, 60).replace(/[\r\n"]/g, " ");
  return base.length > 0 ? base : `Question ${index + 1}`;
}
