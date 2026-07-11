"use client";

import { cn } from "@/lib/utils";

function toColorInputValue(raw: string | undefined): string {
  const t = raw?.trim() ?? "";
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (t.length === 4 && /^#[0-9a-fA-F]{3}$/.test(t)) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  }
  return "#1e293b";
}

type ColorSlotProps = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onClear: () => void;
};

function ColorSlot({ label, value, onChange, onClear }: ColorSlotProps) {
  const pickerValue = toColorInputValue(value);
  const showHex = value.trim().length > 0;

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white p-1.5 shadow-sm">
          <input
            type="color"
            className="h-10 w-11 cursor-pointer rounded border-0 bg-transparent p-0 [color-scheme:light]"
            value={pickerValue}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`Choose ${label.toLowerCase()} color`}
          />
          {showHex ? (
            <span className="pr-1 font-mono text-xs text-slate-600 tabular-nums">{value.trim()}</span>
          ) : (
            <span className="pr-1 text-xs text-slate-400">Default</span>
          )}
        </div>
        {showHex ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

type BrandColorTripletFieldProps = {
  primary: string;
  secondary: string;
  tertiary: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  onTertiaryChange: (value: string) => void;
  className?: string;
};

export function BrandColorTripletField({
  primary,
  secondary,
  tertiary,
  onPrimaryChange,
  onSecondaryChange,
  onTertiaryChange,
  className
}: BrandColorTripletFieldProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-3", className)}>
      <ColorSlot label="Primary" value={primary} onChange={onPrimaryChange} onClear={() => onPrimaryChange("")} />
      <ColorSlot
        label="Secondary"
        value={secondary}
        onChange={onSecondaryChange}
        onClear={() => onSecondaryChange("")}
      />
      <ColorSlot label="Tertiary" value={tertiary} onChange={onTertiaryChange} onClear={() => onTertiaryChange("")} />
    </div>
  );
}
