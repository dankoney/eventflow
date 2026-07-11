"use client";

import { cn } from "@/lib/utils";
import type { PhoneDialOption } from "@/lib/register/phoneDialOptions";

type Props = {
  dialOptions: PhoneDialOption[];
  dialCode: string;
  national: string;
  onDialCodeChange: (value: string) => void;
  onNationalChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

/** Country + national mobile — matches walk-in booth layout. */
export function FeedbackPortalPhoneField({
  dialOptions,
  dialCode,
  national,
  onDialCodeChange,
  onNationalChange,
  disabled,
  error
}: Props) {
  const showCountrySelect = dialOptions.length > 1;

  return (
    <div className="space-y-3">
      {showCountrySelect ? (
        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-semibold text-zinc-700">Country</label>
          <select
            value={dialCode}
            disabled={disabled}
            onChange={(e) => onDialCodeChange(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          >
            {dialOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.country}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="min-w-0">
        <label className="mb-1.5 block text-xs font-semibold text-zinc-700">Mobile number</label>
        <div
          className={cn(
            "flex min-h-[2.75rem] overflow-hidden rounded-xl border border-zinc-300 bg-white focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10",
            disabled && "opacity-60"
          )}
        >
          <span className="flex shrink-0 items-center border-r border-zinc-200 bg-zinc-50 px-3 text-sm font-medium tabular-nums text-zinc-700">
            +{dialCode}
          </span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            disabled={disabled}
            value={national}
            onChange={(e) => onNationalChange(e.target.value)}
            placeholder={dialCode === "233" ? "24 000 0000" : "Phone number"}
            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-zinc-900 outline-none"
          />
        </div>
      </div>

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
