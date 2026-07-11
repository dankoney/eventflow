"use client";

import { cn } from "@/lib/utils";

export function normalizeHexColorInput(raw: string | null | undefined, fallback: string): string {
  const t = raw?.trim() ?? "";
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (t.length === 4 && /^#[0-9a-fA-F]{3}$/.test(t)) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  }
  return fallback;
}

type Props = {
  label: string;
  value: string | null | undefined;
  defaultColor: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
  className?: string;
};

/** Native color picker with default swatch — stores null when cleared (theme default). */
export function HexColorPickerField({
  label,
  value,
  defaultColor,
  disabled,
  onChange,
  className
}: Props) {
  const stored = value?.trim() || null;
  const pickerValue = normalizeHexColorInput(stored, defaultColor);

  return (
    <div className={className}>
      <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white p-1.5 shadow-sm">
          <input
            type="color"
            className="h-10 w-11 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light]"
            value={pickerValue}
            disabled={disabled}
            aria-label={label}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="pr-1.5 font-mono text-xs text-zinc-600 tabular-nums">{pickerValue}</span>
        </div>
        {stored ? (
          <button
            type="button"
            disabled={disabled}
            className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline disabled:opacity-50"
            onClick={() => onChange(null)}
          >
            Reset
          </button>
        ) : (
          <span className="text-[11px] text-zinc-400">Theme default</span>
        )}
      </div>
    </div>
  );
}
