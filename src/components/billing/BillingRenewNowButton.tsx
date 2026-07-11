"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";

import {
  getBillingCheckoutStatusAction,
  initiateRenewCheckoutAction,
  type BillingRenewPlanOption
} from "@/lib/actions/billing.actions";
import type { BillingPlanInterval } from "@/lib/billing/constants";
import { openPaystackPopup } from "@/lib/billing/openPaystackPopup";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type BillingRenewNowSectionProps = {
  expired?: boolean;
  options: BillingRenewPlanOption[];
  defaultInterval: BillingPlanInterval;
  savedCardLast4: string | null;
  periodEndLabel?: string | null;
  standalone?: boolean;
};

async function waitForCheckoutActivation(reference: string): Promise<"active" | "failed" | "pending"> {
  for (let i = 0; i < 30; i += 1) {
    const status = await getBillingCheckoutStatusAction({ reference });
    if (status.success && status.data?.phase === "active") return "active";
    if (status.success && status.data?.phase === "failed") return "failed";
    await new Promise((r) => setTimeout(r, 2000));
  }
  return "pending";
}

export function BillingRenewNowSection({
  expired = false,
  options,
  defaultInterval,
  savedCardLast4,
  periodEndLabel,
  standalone = false
}: BillingRenewNowSectionProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingPlanInterval>(defaultInterval);
  const [pending, startTransition] = useTransition();

  if (options.length === 0) return null;

  const selected = options.find((o) => o.interval === interval) ?? options[0]!;
  const yearly = options.find((o) => o.interval === "yearly");
  const monthly = options.find((o) => o.interval === "monthly");

  return (
    <section className={cn(!standalone && "border-t border-zinc-100 pt-5")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            {expired ? "Restore PRO" : "Renew or change plan"}
          </h3>
          <p className="mt-1 max-w-md text-sm text-zinc-600">
            {expired
              ? "Pay with Paystack on this page. Keep your saved method or switch."
              : periodEndLabel
                ? `Extend from ${periodEndLabel}, or switch monthly ↔ yearly. Remaining paid time is kept.`
                : "Extend your period or switch monthly ↔ yearly via Paystack."}
          </p>
        </div>
        {selected ? (
          <p className="text-right text-sm tabular-nums text-zinc-900">
            <span className="block text-lg font-semibold tracking-tight">{selected.amountLabel}</span>
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {selected.intervalLabel}
            </span>
          </p>
        ) : null}
      </div>

      <div
        className="mt-4 inline-flex rounded-lg bg-zinc-100 p-1"
        role="radiogroup"
        aria-label="Billing interval"
      >
        {options.map((option) => {
          const active = option.interval === interval;
          return (
            <button
              key={option.interval}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setInterval(option.interval)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition",
                active
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              {option.intervalLabel}
              {option.interval === "yearly" && monthly && yearly ? (
                <span className="ml-1.5 text-xs font-normal text-emerald-700">Save</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-zinc-600">
          <CreditCard className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          {savedCardLast4 ? (
            <>
              Default on checkout:{" "}
              <span className="font-medium text-zinc-900">•••• {savedCardLast4}</span>
              <span className="text-zinc-400">·</span>
              <span>or another method</span>
            </>
          ) : (
            <>Card, Mobile Money, or bank on Paystack</>
          )}
        </p>

        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await initiateRenewCheckoutAction({
                interval: selected.interval
              });
              if (!result.success || !result.data) {
                setError(result.error ?? "Unable to start renew checkout.");
                return;
              }

              try {
                await openPaystackPopup({
                  accessCode: result.data.accessCode,
                  onCancel: () => setMessage("Checkout cancelled."),
                  onError: (msg) => setError(msg),
                  onSuccess: (reference) => {
                    setMessage("Payment received — confirming…");
                    void (async () => {
                      const phase = await waitForCheckoutActivation(reference);
                      if (phase === "active") {
                        setMessage("Your subscription is active.");
                        router.refresh();
                        router.replace("/dashboard");
                        return;
                      }
                      if (phase === "failed") {
                        setError("Payment was not confirmed. Try again or contact support.");
                        setMessage(null);
                        return;
                      }
                      setMessage(
                        "Payment submitted. If PRO is not active in a minute, refresh Billing."
                      );
                      router.refresh();
                    })();
                  }
                });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Unable to open Paystack.");
              }
            });
          }}
        >
          {pending ? "Opening…" : "Renew"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
    </section>
  );
}

/** @deprecated Use BillingRenewNowSection */
export const BillingRenewNowButton = BillingRenewNowSection;
