"use client";

import type { EventFeedbackQuestion } from "@/lib/event-feedback/feedbackQuestions";
import {
  likertLabelsForQuestion,
  parseCheckboxAnswer,
  serializeCheckboxAnswer
} from "@/lib/event-feedback/feedbackQuestions";
import { cn } from "@/lib/utils";

type FeedbackOptionalQuestionFieldsProps = {
  questions: EventFeedbackQuestion[];
  answers: Record<string, string>;
  onAnswersChange: (next: Record<string, string>) => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** Show "Question N of M" labels for guests. */
  showNumbers?: boolean;
};

export function FeedbackOptionalQuestionFields({
  questions,
  answers,
  onAnswersChange,
  disabled = false,
  readOnly = false,
  showNumbers = false
}: FeedbackOptionalQuestionFieldsProps) {
  const total = questions.length;
  function setAnswer(key: string, value: string) {
    onAnswersChange({ ...answers, [key]: value });
  }

  return (
    <div className="space-y-4">
      {questions.map((q, index) => (
        <div key={q.key} className="space-y-2">
          {showNumbers ? (
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Question {index + 1} of {total}
            </p>
          ) : null}
          <p className="text-sm font-medium text-zinc-700">{q.prompt}</p>

          {q.type === "text" ? (
            <textarea
              readOnly={readOnly}
              value={answers[q.key] ?? ""}
              onChange={(e) => setAnswer(q.key, e.target.value)}
              rows={2}
              maxLength={300}
              disabled={disabled}
              placeholder="Optional"
              className={cn(
                "w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10",
                readOnly ? "bg-zinc-50 text-zinc-500" : "bg-white text-zinc-900"
              )}
            />
          ) : null}

          {q.type === "likert" ? (
            <LikertQuestionInput
              question={q}
              value={(answers[q.key] ?? "").trim()}
              disabled={disabled}
              readOnly={readOnly}
              onChange={(v) => setAnswer(q.key, v)}
            />
          ) : null}

          {q.type === "checkbox" ? (
            <CheckboxQuestionInput
              question={q}
              value={answers[q.key]}
              disabled={disabled}
              readOnly={readOnly}
              onChange={(v) => setAnswer(q.key, v)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LikertQuestionInput({
  question,
  value,
  disabled,
  readOnly,
  onChange
}: {
  question: Extract<EventFeedbackQuestion, { type: "likert" }>;
  value: string;
  disabled: boolean;
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  const labels = likertLabelsForQuestion(question);
  const groupId = `likert-${question.key}`;

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        className="space-y-2"
      >
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {labels.map((label, index) => {
            const point = index + 1;
            const active = value === label;
            const pointClass = cn(
              "flex h-9 w-full items-center justify-center rounded-full border-2 text-sm font-bold transition sm:h-10",
              active
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-800"
            );

            if (readOnly) {
              return (
                <div key={label} className="flex flex-col items-center gap-1">
                  <span className={pointClass}>{point}</span>
                  <span className="hidden text-center text-[10px] leading-tight text-zinc-500 sm:block">
                    {label}
                  </span>
                </div>
              );
            }

            return (
              <button
                key={label}
                type="button"
                disabled={disabled}
                role="radio"
                aria-checked={active}
                aria-label={`${point}: ${label}`}
                className="flex flex-col items-center gap-1 rounded-lg p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30"
                onClick={() => onChange(active ? "" : label)}
              >
                <span className={cn(pointClass, !active && "hover:border-zinc-500 hover:bg-zinc-50")}>
                  {point}
                </span>
                <span className="hidden text-center text-[10px] leading-tight text-zinc-600 sm:block">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-between gap-2 px-0.5 text-xs text-zinc-500">
          <span className="max-w-[45%] text-left leading-snug">{labels[0]}</span>
          <span className="max-w-[45%] text-right leading-snug">{labels[labels.length - 1]}</span>
        </div>
      </div>
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "text-xs font-medium underline-offset-2 hover:underline",
              !value ? "text-zinc-900" : "text-zinc-500"
            )}
            onClick={() => onChange("")}
          >
            Skip this question
          </button>
          {value ? (
            <span className="text-xs text-zinc-600">
              Selected: <span className="font-medium text-zinc-800">{value}</span>
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Optional — guests can skip this question.</p>
      )}
    </div>
  );
}

function CheckboxQuestionInput({
  question,
  value,
  disabled,
  readOnly,
  onChange
}: {
  question: Extract<EventFeedbackQuestion, { type: "checkbox" }>;
  value: string | undefined;
  disabled: boolean;
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  const selected = parseCheckboxAnswer(value);
  const allowMultiple = question.allowMultiple !== false;

  function toggle(option: string) {
    if (allowMultiple) {
      const next = selected.includes(option)
        ? selected.filter((s) => s !== option)
        : [...selected, option];
      onChange(serializeCheckboxAnswer(next));
      return;
    }
    onChange(selected[0] === option ? "" : option);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2">
        {question.options.map((option) => {
          const checked = selected.includes(option);
          const id = `${question.key}-${option}`;

          if (readOnly) {
            return (
              <span
                key={option}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  checked ? "border-zinc-900 bg-zinc-100 font-medium" : "border-zinc-200 bg-white text-zinc-500"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs",
                    checked ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"
                  )}
                  aria-hidden
                >
                  {checked ? "✓" : ""}
                </span>
                {option}
              </span>
            );
          }

          return (
            <label
              key={option}
              htmlFor={id}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                checked ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white hover:border-zinc-300",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                id={id}
                type={allowMultiple ? "checkbox" : "radio"}
                name={allowMultiple ? undefined : question.key}
                checked={checked}
                disabled={disabled}
                className="h-4 w-4 shrink-0 accent-zinc-900"
                onChange={() => toggle(option)}
              />
              <span className="text-sm text-zinc-800">{option}</span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500">
        Optional — {allowMultiple ? "tick all that apply" : "choose one option"}.
      </p>
    </div>
  );
}
