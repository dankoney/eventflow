"use client";

import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { EventFormValues } from "@/components/events/eventFormSchema";
import { cn } from "@/lib/utils";

function toColorInputValue(raw: string | undefined): string {
  const t = raw?.trim() ?? "";
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (t.length === 4 && /^#[0-9a-fA-F]{3}$/.test(t)) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  }
  return "#1e293b";
}

export type BrandPrimaryColorFieldProps = {
  form: UseFormReturn<EventFormValues>;
  className?: string;
};

export function BrandPrimaryColorField({ form, className }: BrandPrimaryColorFieldProps) {
  const brandPrimaryColor = form.watch("brandPrimaryColor");
  const pickerValue = useMemo(() => toColorInputValue(brandPrimaryColor), [brandPrimaryColor]);
  const showHex = (brandPrimaryColor ?? "").trim().length > 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="flex items-center gap-2 rounded-lg border border-slate-400/60 bg-white p-1.5 shadow-sm ring-1 ring-slate-200/30">
        <input
          type="color"
          className="h-11 w-12 cursor-pointer rounded border-0 bg-transparent p-0 [color-scheme:light]"
          value={pickerValue}
          onChange={(e) => {
            form.setValue("brandPrimaryColor", e.target.value, { shouldValidate: true, shouldDirty: true });
          }}
          aria-label="Choose primary brand color"
        />
        {showHex ? (
          <span className="pr-2 font-mono text-xs text-slate-600 tabular-nums">{(brandPrimaryColor ?? "").trim()}</span>
        ) : (
          <span className="pr-2 text-xs text-slate-400">Pick a color</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => form.setValue("brandPrimaryColor", "", { shouldValidate: true, shouldDirty: true })}
        className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
      >
        Clear
      </button>
    </div>
  );
}
