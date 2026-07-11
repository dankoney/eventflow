"use client";

import { useState, useTransition } from "react";

import {
  setAutoRenewalOffAction,
  setAutoRenewalOnAction
} from "@/lib/actions/billing.actions";
import { cn } from "@/lib/utils";

type BillingAutoRenewalToggleProps = {
  cancelAtPeriodEnd: boolean;
  periodEndLabel: string | null;
  /** Stored authorization required to turn auto-renewal back on silently. */
  canReenableSilently: boolean;
};

export function BillingAutoRenewalToggle({
  cancelAtPeriodEnd,
  periodEndLabel,
  canReenableSilently
}: BillingAutoRenewalToggleProps) {
  const autoRenewOn = !cancelAtPeriodEnd;
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3 border-t border-zinc-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-900">Auto-renewal</p>
          <p className="mt-0.5 text-sm text-zinc-600">
            {autoRenewOn ? (
              <>
                On — next charge at period end
                {periodEndLabel ? (
                  <>
                    {" "}
                    (<strong>{periodEndLabel}</strong>)
                  </>
                ) : null}
                .
              </>
            ) : (
              <>
                Off — access continues
                {periodEndLabel ? (
                  <>
                    {" "}
                    until <strong>{periodEndLabel}</strong>
                  </>
                ) : null}
                . No charge until you turn this back on or use Renew now.
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={autoRenewOn}
          disabled={pending || (!autoRenewOn && !canReenableSilently)}
          title={
            !autoRenewOn && !canReenableSilently
              ? "Add a payment method via Subscribe before turning auto-renewal on."
              : undefined
          }
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              if (autoRenewOn) {
                const result = await setAutoRenewalOffAction();
                if (!result.success) {
                  setError(result.error ?? "Unable to turn off auto-renewal.");
                  return;
                }
                setMessage("Auto-renewal turned off.");
                return;
              }
              const result = await setAutoRenewalOnAction();
              if (!result.success) {
                setError(result.error ?? "Unable to turn on auto-renewal.");
                return;
              }
              setMessage("Auto-renewal turned on — next charge at period end.");
            });
          }}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition",
            autoRenewOn ? "bg-emerald-700" : "bg-zinc-300",
            (pending || (!autoRenewOn && !canReenableSilently)) && "opacity-60"
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
              autoRenewOn ? "translate-x-6" : "translate-x-1"
            )}
          />
          <span className="sr-only">{autoRenewOn ? "Turn auto-renewal off" : "Turn auto-renewal on"}</span>
        </button>
      </div>

      {pending ? <p className="text-sm text-zinc-500">Updating…</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
    </div>
  );
}
