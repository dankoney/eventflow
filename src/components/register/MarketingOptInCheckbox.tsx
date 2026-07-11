"use client";

import { cn } from "@/lib/utils";

type MarketingOptInCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  privacyPolicyUrl?: string | null;
  disabled?: boolean;
  dark?: boolean;
  id?: string;
};

export function MarketingOptInCheckbox({
  checked,
  onChange,
  label,
  privacyPolicyUrl,
  disabled,
  dark = false,
  id = "marketing-opt-in"
}: MarketingOptInCheckboxProps) {
  const policyUrl = privacyPolicyUrl?.trim() || null;

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        dark ? "border-white/10 bg-zinc-950/40 text-zinc-200" : "border-slate-200 bg-slate-50 text-slate-700"
      )}
    >
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
        />
        <span className="leading-relaxed">
          {label}
          {policyUrl ? (
            <>
              {" "}
              <a
                href={policyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "font-medium underline underline-offset-2",
                  dark ? "text-zinc-100" : "text-slate-900"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                Privacy policy
              </a>
            </>
          ) : null}
        </span>
      </label>
      <p className={cn("mt-2 pl-7 text-xs", dark ? "text-zinc-500" : "text-slate-500")}>
        Optional. Event confirmations and reminders are separate from marketing email.
      </p>
    </div>
  );
}
