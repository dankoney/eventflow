"use client";

import { ArrowLeft, Eye, Pencil, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { CustomRegistrationFormPreview } from "@/components/guests/CustomRegistrationFormPreview";
import { Button } from "@/components/ui/Button";
import { saveEventCustomRegistrationForm } from "@/lib/actions/registrationForm.actions";
import {
  type CustomRegistrationFormDefinition,
  type CustomRegistrationFormField,
  defaultCustomRegistrationForm,
  newField
} from "@/lib/registration/customRegistrationForm";
import { cn } from "@/lib/utils";

const FIELD_CATALOG: { type: CustomRegistrationFormField["type"]; label: string; category: string }[] = [
  { category: "Text", type: "TITLE", label: "Title" },
  { category: "Text", type: "SHORT_TEXT", label: "Short answer" },
  { category: "Text", type: "PARAGRAPH", label: "Paragraph" },
  { category: "Options", type: "MULTIPLE_CHOICE", label: "Multiple choice" },
  { category: "Options", type: "CHECKBOX", label: "Checkbox" },
  { category: "Options", type: "DROPDOWN", label: "Drop-down" },
  { category: "Files", type: "FILE", label: "File upload" }
];

type RegistrationFormBuilderClientProps = {
  eventId: string;
  eventName: string;
  initial: CustomRegistrationFormDefinition | null;
};

export function RegistrationFormBuilderClient({
  eventId,
  eventName,
  initial
}: RegistrationFormBuilderClientProps) {
  const unsavedBaseline = useRef<CustomRegistrationFormDefinition | null>(null);
  if (unsavedBaseline.current === null) {
    unsavedBaseline.current = defaultCustomRegistrationForm(eventName);
  }
  const [form, setForm] = useState<CustomRegistrationFormDefinition>(
    () => initial ?? unsavedBaseline.current!
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<"edit" | "preview">("edit");

  const dirty = useMemo(() => {
    const baseline = initial ?? unsavedBaseline.current!;
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form, initial]);

  const onSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    const res = await saveEventCustomRegistrationForm(eventId, form);
    setSaving(false);
    if (!res.success) {
      setMessage(res.error ?? "Could not save");
      return;
    }
    setLastSaved(new Date().toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }));
    setMessage("Saved");
  }, [eventId, form]);

  const byCategory = useMemo(() => {
    const m = new Map<string, typeof FIELD_CATALOG>();
    for (const f of FIELD_CATALOG) {
      if (!m.has(f.category)) m.set(f.category, []);
      m.get(f.category)!.push(f);
    }
    return m;
  }, []);

  return (
    <div className="min-h-[80vh] space-y-6">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/events/${eventId}/guests`}
            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
          >
            <ArrowLeft className="mr-2 inline h-4 w-4" />
            Back
          </Link>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">Create a custom registration form</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          {lastSaved ? <p className="text-sm text-zinc-700">Last saved: {lastSaved}</p> : null}
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5">
            <button
              type="button"
              onClick={() => setWorkspaceMode("edit")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
                workspaceMode === "edit"
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceMode("preview")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
                workspaceMode === "preview"
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
          </div>
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !dirty}
            className="bg-zinc-900 font-semibold text-white hover:bg-zinc-800"
          >
            <Save className="mr-2 inline h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}

      <div
        className={cn(
          "grid gap-6",
          workspaceMode === "edit" ? "lg:grid-cols-[minmax(0,220px)_1fr]" : "lg:grid-cols-1"
        )}
      >
        {workspaceMode === "edit" ? (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Add new field</p>
          {[...byCategory.entries()].map(([cat, items]) => (
            <div key={cat} className="space-y-2">
              <p className="text-xs font-semibold text-zinc-600">{cat}</p>
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.type + item.label}>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          fields: [...f.fields, newField(item.type, item.label)]
                        }))
                      }
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:shadow"
                    >
                      {item.label}
                      <Plus className="h-4 w-4 text-zinc-700" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        ) : null}

        {workspaceMode === "preview" ? (
          <div className="mx-auto w-full max-w-xl">
            <CustomRegistrationFormPreview definition={form} contextLine={eventName} />
            <p className="mt-4 text-center text-xs text-zinc-500">
              Fields are read-only here. Switch to <span className="font-medium">Edit</span> to change labels, options, or
              order.
            </p>
          </div>
        ) : (
        <div className="space-y-4 rounded-2xl border-2 border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <label className="text-xs font-medium text-zinc-500">Form title</label>
              <input
                className="mt-1 w-full rounded-lg border-2 border-zinc-300 px-3 py-2 text-base font-bold text-zinc-900 shadow-inner outline-none focus:border-zinc-700"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Saved to this event. Use <span className="font-medium">Preview</span> to see the attendee-facing layout. The
            public <span className="font-medium">/register</span> page can consume this definition in a follow-up.
          </p>

          <div className="min-h-[200px] space-y-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-4">
            {form.fields.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                Pro tip: add fields from the left. You can build section titles, text answers, and choices.
              </p>
            ) : null}
            {form.fields.map((field, idx) => (
              <div
                key={field.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "text-xs font-bold uppercase tracking-wide",
                      field.type === "TITLE" ? "text-zinc-900" : "text-zinc-500"
                    )}
                  >
                    {field.type === "TITLE" ? "Section title" : field.type.replace(/_/g, " ")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, fields: f.fields.filter((x) => x.id !== field.id) }))
                    }
                    className="text-zinc-400 hover:text-red-600"
                    aria-label="Remove field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <input
                  className="w-full rounded-md border-2 border-zinc-200 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500"
                  value={field.label}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      fields: f.fields.map((x) => (x.id === field.id ? { ...x, label: e.target.value } : x))
                    }))
                  }
                />
                {field.type !== "TITLE" ? (
                  <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          fields: f.fields.map((x) =>
                            x.id === field.id ? { ...x, required: e.target.checked } : x
                          )
                        }))
                      }
                    />
                    Required
                  </label>
                ) : null}
                {field.options?.length != null && field.type !== "TITLE" ? (
                  <textarea
                    className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-800"
                    rows={3}
                    value={field.options?.join("\n") ?? ""}
                    placeholder="One option per line"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        fields: f.fields.map((x) =>
                          x.id === field.id
                            ? { ...x, options: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) }
                            : x
                        )
                      }))
                    }
                  />
                ) : null}
                <span className="text-[10px] text-zinc-400">Order: {idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
