"use client";

import type { CustomRegistrationFormDefinition, CustomRegistrationFormField } from "@/lib/registration/customRegistrationForm";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50/90 px-3 py-2 text-sm text-slate-800 outline-none";

function FieldPreview({ field }: { field: CustomRegistrationFormField }) {
  if (field.type === "TITLE") {
    return (
      <div className="border-b border-slate-200 pb-2 pt-4">
        <h3 className="text-base font-bold text-slate-900">{field.label || "Section"}</h3>
      </div>
    );
  }

  const label = (
    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
      {field.label}
      {field.required ? <span className="text-red-600"> *</span> : null}
    </label>
  );

  switch (field.type) {
    case "SHORT_TEXT":
      return (
        <div>
          {label}
          <input type="text" readOnly disabled className={inputClass} placeholder="Short answer" />
        </div>
      );
    case "PARAGRAPH":
      return (
        <div>
          {label}
          <textarea readOnly disabled rows={3} className={cn(inputClass, "resize-none")} placeholder="Paragraph" />
        </div>
      );
    case "MULTIPLE_CHOICE":
      return (
        <div>
          {label}
          <div className="space-y-2">
            {(field.options?.length ? field.options : ["Option"]).map((opt, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-slate-800">
                <input type="radio" disabled className="h-4 w-4 border-slate-300" />
                {opt}
              </label>
            ))}
          </div>
        </div>
      );
    case "CHECKBOX":
      return (
        <div>
          {label}
          <div className="space-y-2">
            {(field.options?.length ? field.options : ["Option"]).map((opt, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" disabled className="h-4 w-4 rounded border-slate-300" />
                {opt}
              </label>
            ))}
          </div>
        </div>
      );
    case "DROPDOWN":
      return (
        <div>
          {label}
          <select disabled className={cn(inputClass, "h-10 appearance-none bg-slate-50")}>
            <option>Select…</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    case "FILE":
      return (
        <div>
          {label}
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
            File upload (attendees choose a file here)
          </div>
        </div>
      );
    default:
      return null;
  }
}

type CustomRegistrationFormPreviewProps = {
  definition: CustomRegistrationFormDefinition;
  /** Shown under the form title (e.g. event name). */
  contextLine?: string;
  className?: string;
};

export function CustomRegistrationFormPreview({
  definition,
  contextLine,
  className
}: CustomRegistrationFormPreviewProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6",
        className
      )}
    >
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-800">Preview</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{definition.title}</h2>
        {contextLine ? <p className="mt-1 text-sm text-slate-600">{contextLine}</p> : null}
      </div>
      <div className="space-y-5">
        {definition.fields.length === 0 ? (
          <p className="text-center text-sm text-slate-500">No fields yet — add some in Edit mode.</p>
        ) : (
          definition.fields.map((f) => <FieldPreview key={f.id} field={f} />)
        )}
      </div>
      <div className="mt-8 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white opacity-60"
        >
          Register (preview)
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-500">This is how the extra questions appear alongside the main registration flow.</p>
      </div>
    </div>
  );
}
