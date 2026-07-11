"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import {
  updateEventFeedbackAnonymous,
  updateEventFeedbackQuestions
} from "@/lib/actions/eventFeedbackQuestions.actions";
import {
  deleteOrgFeedbackQuestionTemplate,
  getOrgFeedbackQuestionTemplateQuestions,
  listOrgFeedbackQuestionTemplates,
  saveOrgFeedbackQuestionTemplate,
  type OrgFeedbackQuestionTemplateRow
} from "@/lib/actions/orgFeedbackQuestionTemplate.actions";
import {
  BUILTIN_FEEDBACK_QUESTION_TEMPLATES,
  cloneTemplateQuestions
} from "@/lib/event-feedback/builtinQuestionTemplates";
import type { EventFeedbackQuestion } from "@/lib/event-feedback/feedbackQuestions";
import { normalizeFeedbackQuestionsForPersistence } from "@/lib/event-feedback/feedbackQuestions";
import { FEEDBACK_FORM_LOCKED_MESSAGE } from "@/lib/event-feedback/feedbackFormLock";
import { LIKERT_SCALE_LIST, type LikertScaleId } from "@/lib/event-feedback/likertScales";
import { EventFeedbackFormPreview } from "@/components/events/EventFeedbackFormPreview";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { cn } from "@/lib/utils";

const editorQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    key: z.string().min(1),
    type: z.literal("text"),
    prompt: z.string().trim().max(200)
  }),
  z.object({
    key: z.string().min(1),
    type: z.literal("likert"),
    prompt: z.string().trim().max(200),
    scaleId: z
      .enum(["satisfaction", "agreement", "likelihood", "frequency", "importance", "quality"])
      .optional(),
    scaleLabels: z.array(z.string().min(1)).optional()
  }),
  z.object({
    key: z.string().min(1),
    type: z.literal("checkbox"),
    prompt: z.string().trim().max(200),
    options: z.array(z.string().min(1).max(120)).min(1).max(12),
    allowMultiple: z.boolean().optional()
  })
]);

const editorSchema = z.object({
  questions: z.array(editorQuestionSchema).max(20),
  feedbackAnonymous: z.boolean()
});

type EditorValues = z.infer<typeof editorSchema>;

function newQuestionKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

type EventFeedbackQuestionsEditorProps = {
  eventId: string;
  eventName: string;
  locked: boolean;
  initialQuestions: EventFeedbackQuestion[];
  initialFeedbackAnonymous?: boolean;
  /** When true, omit page-level heading (used inside dashboard tabs). */
  embedded?: boolean;
};

export function EventFeedbackQuestionsEditor({
  eventId,
  eventName,
  locked,
  initialQuestions,
  initialFeedbackAnonymous = false,
  embedded = false
}: EventFeedbackQuestionsEditorProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<OrgFeedbackQuestionTemplateRow[]>([]);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [anonymousBusy, setAnonymousBusy] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const form = useForm<EditorValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: {
      questions: initialQuestions ?? [],
      feedbackAnonymous: initialFeedbackAnonymous
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "questions"
  });

  const watchedQuestions = form.watch("questions");
  const previewQuestions = useMemo(
    () =>
      (watchedQuestions ?? [])
        .map((q) => ({
          ...q,
          prompt: q.prompt.trim() || "New question"
        })),
    [watchedQuestions]
  );

  const canEditQuestions = !locked;
  const questionCount = fields.length;
  const feedbackAnonymous = form.watch("feedbackAnonymous");

  useEffect(() => {
    void listOrgFeedbackQuestionTemplates().then((res) => {
      if (res.success && res.data) setSavedTemplates(res.data);
    });
  }, []);

  function applyQuestions(questions: EventFeedbackQuestion[]) {
    replace(questions);
    setNotice("Questions loaded. Review, edit, then save for this event.");
    setFormError(null);
  }

  function applyBuiltinTemplate(templateId: string) {
    const pack = BUILTIN_FEEDBACK_QUESTION_TEMPLATES.find((t) => t.id === templateId);
    if (!pack) return;
    applyQuestions(cloneTemplateQuestions(pack.questions));
  }

  function clearAllQuestions() {
    if (!canEditQuestions) return;
    replace([]);
    setNotice("All optional questions cleared. Save when ready.");
    setFormError(null);
  }

  function handleTemplateChange(value: string) {
    if (!canEditQuestions) return;
    if (value === "none") {
      clearAllQuestions();
      return;
    }
    if (value.startsWith("builtin:")) {
      applyBuiltinTemplate(value.slice("builtin:".length));
      return;
    }
    if (value.startsWith("saved:")) {
      void applySavedTemplate(value.slice("saved:".length));
    }
  }

  async function handleAnonymousChange(checked: boolean) {
    form.setValue("feedbackAnonymous", checked);
    setAnonymousBusy(true);
    setFormError(null);
    const res = await updateEventFeedbackAnonymous({ eventId, feedbackAnonymous: checked });
    setAnonymousBusy(false);
    if (!res.success) {
      form.setValue("feedbackAnonymous", !checked);
      setFormError(res.error ?? "Could not update anonymous setting.");
      return;
    }
    setNotice(checked ? "Anonymous mode enabled." : "Anonymous mode disabled.");
  }

  async function applySavedTemplate(id: string) {
    setTemplateBusy(true);
    const res = await getOrgFeedbackQuestionTemplateQuestions({ id });
    setTemplateBusy(false);
    if (!res.success || !res.data) {
      setFormError(res.error ?? "Could not load template.");
      return;
    }
    applyQuestions(
      cloneTemplateQuestions(
        res.data.questions.map((q) => {
          if (q.type === "likert") {
            return {
              type: q.type,
              prompt: q.prompt,
              scaleId: q.scaleId,
              scaleLabels: q.scaleLabels
            };
          }
          if (q.type === "checkbox") {
            return {
              type: q.type,
              prompt: q.prompt,
              options: q.options,
              allowMultiple: q.allowMultiple
            };
          }
          return { type: q.type, prompt: q.prompt };
        })
      )
    );
  }

  async function handleSaveTemplate() {
    const name = saveTemplateName.trim();
    if (!name) {
      setFormError("Enter a name for your template.");
      return;
    }
    const questions = normalizeFeedbackQuestionsForPersistence(
      form.getValues("questions") as EventFeedbackQuestion[]
    );
    if (questions.length === 0) {
      setFormError("Add at least one question with a prompt before saving a template.");
      return;
    }
    setTemplateBusy(true);
    const res = await saveOrgFeedbackQuestionTemplate({ name, questions });
    setTemplateBusy(false);
    if (!res.success) {
      setFormError(res.error ?? "Could not save template.");
      return;
    }
    setShowSaveTemplate(false);
    setSaveTemplateName("");
    setNotice(`Template "${name}" saved for your organization.`);
    const list = await listOrgFeedbackQuestionTemplates();
    if (list.success && list.data) setSavedTemplates(list.data);
  }

  async function handleDeleteTemplate(id: string, name: string) {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    setTemplateBusy(true);
    const res = await deleteOrgFeedbackQuestionTemplate({ id });
    setTemplateBusy(false);
    if (!res.success) {
      setFormError(res.error ?? "Could not delete template.");
      return;
    }
    setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
    setNotice(`Template "${name}" deleted.`);
  }

  async function onSubmit(values: EditorValues) {
    if (!canEditQuestions) return;
    setFormError(null);
    setNotice(null);
    const questions = values.questions.filter((q) => q.prompt.trim().length > 0);
    const res = await updateEventFeedbackQuestions({
      eventId,
      questions,
      feedbackAnonymous: values.feedbackAnonymous
    });
    if (!res.success) {
      setFormError(res.error ?? "Could not save feedback questions.");
      return;
    }
    form.reset(values);
    setNotice("Feedback questions saved for this event.");
  }

  return (
    <section className="space-y-4">
      {!embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Guest feedback form</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600">
              Configure optional questions before guests respond. Overall emoji rating and comment are always
              included.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-2 h-4 w-4" aria-hidden />
            Preview
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-zinc-600">
            Set optional questions and privacy before sending feedback requests.
          </p>
          <Button type="button" variant="secondary" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-2 h-4 w-4" aria-hidden />
            Preview
          </Button>
        </div>
      )}

      {locked ? (
        <WorkspaceNotice variant="info">{FEEDBACK_FORM_LOCKED_MESSAGE}</WorkspaceNotice>
      ) : null}

      {notice ? (
        <WorkspaceNotice variant="success" onDismiss={() => setNotice(null)}>
          {notice}
        </WorkspaceNotice>
      ) : null}
      {formError ? (
        <WorkspaceNotice variant="error" onDismiss={() => setFormError(null)}>
          {formError}
        </WorkspaceNotice>
      ) : null}

      <Card className="border-zinc-200 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900"
            checked={feedbackAnonymous}
            disabled={anonymousBusy}
            onChange={(e) => void handleAnonymousChange(e.target.checked)}
          />
          <span className="min-w-0">
            <span className="text-sm font-semibold text-zinc-900">Anonymous responses</span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-600">
              When enabled, the feedback table and exports show &quot;Anonymous&quot; instead of each
              guest&apos;s name and email. You can change this anytime, even after responses are
              collected.
            </span>
            {anonymousBusy ? (
              <span className="mt-1 block text-xs text-zinc-500">Saving…</span>
            ) : null}
          </span>
        </label>
      </Card>

      <div
        className={cn(
          "overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50",
          !canEditQuestions && "opacity-60"
        )}
        aria-disabled={!canEditQuestions}
      >
        <div className="border-b border-zinc-200 bg-white px-4 py-3">
          <h3 className="text-sm font-bold text-zinc-900">Edit optional questions</h3>
          <p className="mt-0.5 text-xs text-zinc-600">
            Emoji rating and free-text comment are always on the guest form. Customize follow-up
            questions below.
          </p>
        </div>

        <div className="space-y-2 border-b border-zinc-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Template</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500"
              disabled={!canEditQuestions || templateBusy}
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                handleTemplateChange(v);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Load a template…
              </option>
              <option value="none">No template — clear all questions</option>
              <optgroup label="Built-in">
                {BUILTIN_FEEDBACK_QUESTION_TEMPLATES.map((pack) => (
                  <option key={pack.id} value={`builtin:${pack.id}`}>
                    {pack.name} ({pack.questions.length} questions)
                  </option>
                ))}
              </optgroup>
              {savedTemplates.length > 0 ? (
                <optgroup label="Your organization">
                  {savedTemplates.map((t) => (
                    <option key={t.id} value={`saved:${t.id}`}>
                      {t.name} ({t.questionCount} questions)
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            <Button
              type="button"
              variant="secondary"
              disabled={!canEditQuestions || questionCount === 0}
              onClick={() => clearAllQuestions()}
            >
              Clear all
            </Button>
          </div>
          {savedTemplates.length > 0 ? (
            <details className="text-xs text-zinc-600">
              <summary className="cursor-pointer font-medium text-zinc-700">
                Manage saved templates
              </summary>
              <ul className="mt-2 space-y-1">
                {savedTemplates.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1"
                  >
                    <span>{t.name}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={templateBusy}
                      onClick={() => void handleDeleteTemplate(t.id, t.name)}
                    >
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {!showSaveTemplate ? (
            <button
              type="button"
              disabled={questionCount === 0 || templateBusy}
              className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50"
              onClick={() => setShowSaveTemplate(true)}
            >
              Save current questions as org template
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 space-y-1">
                <span className="text-xs font-semibold text-zinc-600">Template name</span>
                <input
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  placeholder="e.g. Q4 summit follow-up"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                  maxLength={80}
                />
              </label>
              <div className="flex gap-2">
                <Button type="button" disabled={templateBusy} onClick={() => void handleSaveTemplate()}>
                  Save
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowSaveTemplate(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "space-y-4 p-4",
            !canEditQuestions && "pointer-events-none select-none"
          )}
        >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <fieldset className="min-w-0">
          <div className="space-y-3">
            {fields.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No optional questions yet — pick a template above or add your own.
              </p>
            ) : null}
            {fields.map((field, idx) => {
              const questionType = form.watch(`questions.${idx}.type`);
              return (
              <div
                key={field.id}
                className="flex flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Question {idx + 1}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-500">Type</span>
                    <select
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                      value={questionType}
                      onChange={(e) => {
                        const next = e.target.value as "text" | "likert" | "checkbox";
                        const current = form.getValues(`questions.${idx}`);
                        if (next === "text") {
                          form.setValue(`questions.${idx}`, {
                            key: current.key,
                            type: "text",
                            prompt: current.prompt
                          });
                        } else if (next === "likert") {
                          form.setValue(`questions.${idx}`, {
                            key: current.key,
                            type: "likert",
                            prompt: current.prompt,
                            scaleId: "satisfaction"
                          });
                        } else {
                          form.setValue(`questions.${idx}`, {
                            key: current.key,
                            type: "checkbox",
                            prompt: current.prompt,
                            options: ["Option 1", "Option 2"],
                            allowMultiple: true
                          });
                        }
                      }}
                    >
                      <option value="text">Text</option>
                      <option value="likert">Likert (5-point scale)</option>
                      <option value="checkbox">Checkbox (tick options)</option>
                    </select>
                  </div>
                  <input
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                    placeholder="e.g. What was the most memorable part?"
                    {...form.register(`questions.${idx}.prompt` as const)}
                  />
                  {questionType === "likert" ? (
                    <div className="space-y-1 pt-1">
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-zinc-600">Likert scale</span>
                        <select
                          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                          value={form.watch(`questions.${idx}.scaleId`) ?? "satisfaction"}
                          onChange={(e) =>
                            form.setValue(
                              `questions.${idx}.scaleId`,
                              e.target.value as LikertScaleId
                            )
                          }
                        >
                          {LIKERT_SCALE_LIST.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name} — {preset.labels[0]} … {preset.labels[4]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="text-xs text-zinc-500">{LIKERT_SCALE_LIST.find(
                        (p) => p.id === (form.watch(`questions.${idx}.scaleId`) ?? "satisfaction")
                      )?.description}</p>
                    </div>
                  ) : null}
                  {questionType === "checkbox" ? (
                    <div className="space-y-2 pt-1">
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-zinc-600">Options (one per line)</span>
                        <textarea
                          rows={4}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                          value={(form.watch(`questions.${idx}.options`) ?? []).join("\n")}
                          onChange={(e) => {
                            const options = e.target.value
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean);
                            form.setValue(
                              `questions.${idx}.options`,
                              options.length > 0 ? options : ["Option 1"]
                            );
                          }}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-zinc-900"
                          checked={form.watch(`questions.${idx}.allowMultiple`) !== false}
                          onChange={(e) =>
                            form.setValue(`questions.${idx}.allowMultiple`, e.target.checked)
                          }
                        />
                        Allow multiple selections
                      </label>
                    </div>
                  ) : null}
                </div>
                <div className="flex justify-end">
                  <input type="hidden" {...form.register(`questions.${idx}.key` as const)} />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canEditQuestions}
                    onClick={() => remove(idx)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                    Remove
                  </Button>
                </div>
              </div>
            );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!canEditQuestions || questionCount >= 20}
              onClick={() =>
                append({
                  key: newQuestionKey(),
                  type: "text",
                  prompt: ""
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Add question
            </Button>
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canEditQuestions || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Save questions for this event"}
          </Button>
        </div>
      </form>
        </div>
      </div>

      {previewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => setPreviewOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <EventFeedbackFormPreview
              eventName={eventName}
              questions={previewQuestions}
              onClose={() => setPreviewOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
