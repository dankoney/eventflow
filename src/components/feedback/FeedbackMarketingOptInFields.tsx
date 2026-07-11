"use client";

import { MarketingOptInCheckbox } from "@/components/register/MarketingOptInCheckbox";
import { Input } from "@/components/ui/Input";

type FeedbackMarketingOptInFieldsProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  privacyPolicyUrl?: string | null;
  disabled?: boolean;
  /** Portal QR — collect email on the main form when opted in. */
  showEmailField?: boolean;
  marketingEmail?: string;
  onMarketingEmailChange?: (value: string) => void;
  idPrefix?: string;
};

export function FeedbackMarketingOptInFields({
  checked,
  onCheckedChange,
  label,
  privacyPolicyUrl,
  disabled = false,
  showEmailField = false,
  marketingEmail = "",
  onMarketingEmailChange,
  idPrefix = "feedback-marketing"
}: FeedbackMarketingOptInFieldsProps) {
  return (
    <div className="space-y-3">
      <MarketingOptInCheckbox
        id={`${idPrefix}-opt-in`}
        checked={checked}
        onChange={onCheckedChange}
        label={label}
        privacyPolicyUrl={privacyPolicyUrl}
        disabled={disabled}
      />
      {showEmailField && checked ? (
        <div className="space-y-1.5 pl-7">
          <label htmlFor={`${idPrefix}-email`} className="text-xs font-medium text-zinc-700">
            Email for updates
          </label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete="email"
            value={marketingEmail}
            onChange={(e) => onMarketingEmailChange?.(e.target.value)}
            placeholder="you@company.com"
            disabled={disabled}
            className="h-10"
          />
          <p className="text-xs text-zinc-500">
            Use the same email you registered with so we can match your subscription. Feedback can still
            be submitted anonymously.
          </p>
        </div>
      ) : null}
    </div>
  );
}
