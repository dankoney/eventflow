"use client";

import type { JSONContent } from "@tiptap/core";
import { FileText, LayoutTemplate, Loader2, Save } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import type { MailyEditorInstance } from "@/components/broadcast/MailyEditorCanvas";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getPrebuiltTemplateEditorStateAction,
  saveEmailTemplateAction
} from "@/lib/actions/emailTemplate.actions";
import { BROADCAST_EMAIL_MERGE_TAGS } from "@/lib/email/broadcastMergeTags";
import { blankMailyDocument } from "@/lib/email/prebuiltEmailTemplates";
import { cn } from "@/lib/utils";

const MailyEditorCanvas = dynamic(
  () => import("@/components/broadcast/MailyEditorCanvas").then((m) => m.MailyEditorCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[28rem] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
        Loading editor…
      </div>
    )
  }
);

export type PrebuiltTemplateCard = {
  id: string;
  name: string;
  description: string | null;
};

type EmailTemplateEditorProps = {
  mode: "create" | "edit";
  templateId?: string;
  initialName?: string;
  initialDescription?: string | null;
  initialEditorState?: JSONContent;
  prebuiltTemplates: PrebuiltTemplateCard[];
};

type Step = "gallery" | "editor";

export function EmailTemplateEditor({
  mode,
  templateId,
  initialName = "",
  initialDescription = null,
  initialEditorState,
  prebuiltTemplates
}: EmailTemplateEditorProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(mode === "edit" ? "editor" : "gallery");
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [editorState, setEditorState] = useState<JSONContent>(
    initialEditorState ?? blankMailyDocument()
  );
  const [editor, setEditor] = useState<MailyEditorInstance | null>(null);
  const [loadingStarter, setLoadingStarter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleEditorReady = useCallback((instance: MailyEditorInstance) => {
    setEditor(instance);
  }, []);

  async function startFromPrebuilt(prebuiltId: string) {
    setLoadingStarter(true);
    setError(null);
    const res = await getPrebuiltTemplateEditorStateAction(prebuiltId);
    setLoadingStarter(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not load starter template.");
      return;
    }
    setName(res.data.name);
    setDescription(res.data.description ?? "");
    setEditorState(res.data.editorState as JSONContent);
    setStep("editor");
  }

  function startBlank() {
    setName("");
    setDescription("");
    setEditorState(blankMailyDocument());
    setStep("editor");
  }

  async function handleSave() {
    if (!editor) {
      setError("Editor is not ready yet.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Template name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    const json = editor.getJSON();
    const res = await saveEmailTemplateAction({
      id: mode === "edit" ? templateId : undefined,
      name: trimmedName,
      description: description.trim() || undefined,
      editorState: json
    });

    setSaving(false);

    if (!res.success || !res.data) {
      setError(res.error ?? "Save failed.");
      return;
    }

    setSaveMessage("Template saved.");
    if (mode === "create") {
      router.push(`/broadcasts/templates/${res.data.id}/edit`);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  function handleInsertMergeTag(id: string, label: string) {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "variable",
          attrs: {
            id,
            label,
            fallback: null,
            showIfKey: null,
            required: false
          }
        },
        { type: "text", text: " " }
      ])
      .run();
  }

  if (step === "gallery" && mode === "create") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Start from a template</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Pick a pre-designed starter or build from a blank canvas. Starters are copied into your
            own editable template.
          </p>

          {loadingStarter ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading starter…
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {prebuiltTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-left transition hover:border-zinc-300 hover:bg-white"
                onClick={() => void startFromPrebuilt(template.id)}
              >
                <div className="flex items-start gap-3">
                  <LayoutTemplate className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                  <span>
                    <span className="block font-medium text-zinc-900">{template.name}</span>
                    {template.description ? (
                      <span className="mt-1 block text-sm text-zinc-600">{template.description}</span>
                    ) : null}
                  </span>
                </div>
              </button>
            ))}

            <button
              type="button"
              className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-left transition hover:border-zinc-400 hover:bg-zinc-50"
              onClick={startBlank}
            >
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                <span>
                  <span className="block font-medium text-zinc-900">Blank canvas</span>
                  <span className="mt-1 block text-sm text-zinc-600">
                    Start from scratch with the Maily editor.
                  </span>
                </span>
              </div>
            </button>
          </div>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {mode === "create" ? (
            <button
              type="button"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
              onClick={() => setStep("gallery")}
            >
              ← Back to templates
            </button>
          ) : (
            <Link href="/broadcasts/templates" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              ← All templates
            </Link>
          )}
        </div>
        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save template
        </Button>
      </div>

      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Template name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Spring summit reminder"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Internal note for your team"
            />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Merge tags
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Type <code className="rounded bg-zinc-100 px-1">@</code> in the editor or click to
              insert. Use <strong>guest_category</strong> for tier A/B/C (not ticket SKU).
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BROADCAST_EMAIL_MERGE_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={cn(
                    "rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700",
                    "hover:border-zinc-300 hover:bg-white"
                  )}
                  onClick={() => handleInsertMergeTag(tag.id, tag.label)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <MailyEditorCanvas contentJson={editorState} onEditorReady={handleEditorReady} />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saveMessage ? <p className="text-sm text-emerald-700">{saveMessage}</p> : null}
    </div>
  );
}
