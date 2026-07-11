"use client";

import { Input } from "@/components/ui/Input";
import {
  kioskInputClass,
  kioskInputCompactClass,
  kioskLabelClass,
  kioskLabelCompactClass
} from "@/components/checkin-booth/kioskClasses";
import { PHONE_DIAL_OPTIONS } from "@/lib/register/phoneDialOptions";
import { cn } from "@/lib/utils";

type BoothPhoneNumberFieldProps = {
  dialCode: string;
  national: string;
  onDialCodeChange: (value: string) => void;
  onNationalChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  /** Stacked (default) or country + number side by side. */
  layout?: "stack" | "row";
  /** Denser fields for walk-in form fitting one screen. */
  compact?: boolean;
  /** Hide helper text under the fields. */
  hideHint?: boolean;
};

function selectFieldClass(compact: boolean) {
  return cn(
    "w-full rounded-md border border-slate-300 bg-white text-slate-900 outline-none transition focus:ring-2 focus:ring-[#0040e0]/30",
    compact ? "h-11 px-3 text-base" : "h-14 px-4 text-lg"
  );
}

/** Country + national mobile — same layout as public registration (no + in the input). */
export function BoothPhoneNumberField({
  dialCode,
  national,
  onDialCodeChange,
  onNationalChange,
  error,
  disabled,
  layout = "stack",
  compact = false,
  hideHint = false
}: BoothPhoneNumberFieldProps) {
  const phoneDialPrefix = dialCode ? `+${dialCode}` : "+";
  const labelClass = compact ? kioskLabelCompactClass : kioskLabelClass;
  const hintClass = compact ? "text-xs text-slate-500" : "text-sm text-slate-500";
  const phoneRowMinH = compact ? "min-h-[2.75rem]" : "min-h-[3.5rem]";
  const prefixClass = cn(
    "flex shrink-0 items-center border-r border-slate-200 bg-slate-50 font-medium tabular-nums text-slate-700",
    compact ? "px-3 text-sm" : "px-4 text-base"
  );
  const inputClass = compact
    ? cn(kioskInputCompactClass, "border-0 bg-transparent py-2 shadow-none focus-visible:ring-0")
    : cn(kioskInputClass, "border-0 bg-transparent py-3 shadow-none focus-visible:ring-0");

  const gridClass =
    layout === "row"
      ? "grid grid-cols-[minmax(9.5rem,11.5rem)_minmax(0,1fr)] items-end gap-3"
      : "grid grid-cols-1 gap-4";

  return (
    <div className="space-y-2">
      <div className={gridClass}>
        <div className="min-w-0">
          <label className={labelClass}>Country</label>
          <select
            value={dialCode}
            disabled={disabled}
            onChange={(e) => onDialCodeChange(e.target.value)}
            className={selectFieldClass(compact)}
          >
            {PHONE_DIAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.country}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className={labelClass}>Mobile number</label>
          <div
            className={cn(
              "flex min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-[#0040e0]/30",
              phoneRowMinH,
              disabled && "opacity-60"
            )}
          >
            <span className={prefixClass} aria-hidden>
              {phoneDialPrefix}
            </span>
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              disabled={disabled}
              value={national}
              onChange={(e) => onNationalChange(e.target.value)}
              placeholder={dialCode === "233" ? "24 000 0000" : "Phone number"}
              className={cn("min-w-0 flex-1", inputClass)}
            />
          </div>
        </div>
      </div>
      {error ? <p className={cn("text-red-600", compact ? "text-sm" : "text-base")}>{error}</p> : null}
      {!hideHint ? (
        <p className={hintClass}>
          Select your country, then enter your number after {phoneDialPrefix}
          {dialCode === "233" ? " (omit a leading 0, e.g. 24XXXXXXX)." : "."}
        </p>
      ) : null}
    </div>
  );
}
