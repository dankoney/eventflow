"use client";

import { EventFeedbackRating } from "@prisma/client";
import { useMemo, useState } from "react";

import {
  EVENT_FEEDBACK_RATINGS,
  EVENT_FEEDBACK_RATING_META
} from "@/lib/event-feedback/ratings";
import { FeedbackOptionalQuestionFields } from "@/components/feedback/FeedbackOptionalQuestionFields";
import {
  likertLabelsForQuestion,
  serializeCheckboxAnswer,
  type EventFeedbackQuestion
} from "@/lib/event-feedback/feedbackQuestions";
import { cn } from "@/lib/utils";

type EventFeedbackFormPreviewProps = {
  eventName: string;
  questions: EventFeedbackQuestion[];
  onClose?: () => void;
};

export function EventFeedbackFormPreview({
  eventName,
  questions,
  onClose
}: EventFeedbackFormPreviewProps) {
  const [selected, setSelected] = useState<EventFeedbackRating | null>(
    EventFeedbackRating.SATISFIED
  );
  const activeMeta = selected ? EVENT_FEEDBACK_RATING_META[selected] : null;

  const previewAnswers = useMemo(() => {
    const out: Record<string, string> = {};
    for (const q of questions) {
      if (q.type === "likert") {
        const labels = likertLabelsForQuestion(q);
        const mid = labels[Math.floor(labels.length / 2)] ?? labels[0];
        if (mid) out[q.key] = mid;
      } else if (q.type === "checkbox" && q.options[0]) {
        out[q.key] = serializeCheckboxAnswer([q.options[0]]);
      }
    }
    return out;
  }, [questions]);

  return (
    <div
      className="mx-auto w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg sm:p-8 max-h-[calc(100dvh-2rem)] overflow-y-auto"
      role="dialog"
      aria-label="Guest feedback form preview"
    >
      {onClose ? (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-zinc-600 underline-offset-2 hover:underline"
          >
            Close preview
          </button>
        </div>
      ) : null}

      <p className="text-center text-xs font-bold uppercase tracking-widest text-zinc-500">
        Preview — guest view
      </p>

      <div className="mt-4 space-y-6">
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-500">Hi Guest</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
            How was {eventName}?
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Each emoji shows what it means. Pick one, add an optional comment, then submit.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-center text-xs font-medium text-zinc-500">
            Tap the option that best matches your experience
          </p>
          <div
            className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3"
            role="radiogroup"
            aria-label="Rate your experience"
          >
            {EVENT_FEEDBACK_RATINGS.map((rating) => {
              const meta = EVENT_FEEDBACK_RATING_META[rating];
              const active = selected === rating;
              return (
                <button
                  key={rating}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(rating)}
                  className={cn(
                    "flex min-w-[4.75rem] max-w-[5.5rem] flex-1 flex-col items-center justify-center rounded-2xl border-2 px-1.5 py-3 transition sm:min-w-[5.25rem]",
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-lg"
                      : "border-zinc-200 bg-white hover:border-zinc-400"
                  )}
                >
                  <span className="text-3xl leading-none">{meta.emoji}</span>
                  <span
                    className={cn(
                      "mt-2 text-center text-[10px] font-semibold leading-tight sm:text-xs",
                      active ? "text-white" : "text-zinc-600"
                    )}
                  >
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {activeMeta ? (
          <p className="text-center text-xs text-zinc-500">
            Selected: {activeMeta.emoji} {activeMeta.label}
          </p>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Optional comment
          </span>
          <textarea
            readOnly
            rows={3}
            placeholder="Anything we should know? (optional)"
            className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
          />
        </label>

        {questions.length > 0 ? (
          <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Optional questions
            </p>
            <FeedbackOptionalQuestionFields
              questions={questions}
              answers={previewAnswers}
              onAnswersChange={() => {}}
              readOnly
            />
          </div>
        ) : null}

        <div className="flex justify-center">
          <span className="inline-flex rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white opacity-80">
            Submit feedback
          </span>
        </div>
      </div>
    </div>
  );
}
