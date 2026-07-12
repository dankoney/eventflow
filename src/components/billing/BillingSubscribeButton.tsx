"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";

import {
  getBillingCheckoutStatusAction,
  initiateSubscribeAction,
  type BillingRenewPlanOption
} from "@/lib/actions/billing.actions";
import type { BillingPlanInterval } from "@/lib/billing/constants";
import { openPaystackPopup } from "@/lib/billing/openPaystackPopup";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

async function waitForCheckoutActivation(reference: string): Promise<"active" | "failed" | "pending"> {
  for (let i = 0; i < 30; i += 1) {
    const status = await getBillingCheckoutStatusAction({ reference });
    if (status.success && status.data?.phase === "active") return "active";
    if (status.success && status.data?.phase === "failed") return "failed";
    await new Promise((r) => setTimeout(r, 2000));
  }
  return "pending";
}

export function BillingSubscribeButton({
  label = "Add payment / Subscribe to PRO",
  options = [],
  defaultInterval = "monthly"
}: {
  label?: string;
  options?: BillingRenewPlanOption[];
  defaultInterval?: BillingPlanInterval;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingPlanInterval>(defaultInterval);
  const [pending, startTransition] = useTransition();

  const selected = options.find((o) => o.interval === interval) ?? options[0] ?? null;
  const yearly = options.find((o) => o.interval === "yearly");
  const monthly = options.find((o) => o.interval === "monthly");

  return (
    <div className="space-y-3">
      {options.length > 0 ? (
        <>
          <div
            className="inline-flex rounded-lg bg-zinc-100 p-1"
            role="radiogroup"
            aria-label="Billing interval"
          >
            {options.map((option) => {
              const active = option.interval === (selected?.interval ?? interval);
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
          {selected ? (
            <p className="text-sm tabular-nums text-zinc-900">
              <span className="font-semibold">{selected.amountLabel}</span>
              <span className="ml-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {selected.intervalLabel}
              </span>
            </p>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-zinc-600">
          <CreditCard className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          Card, Mobile Money, or bank on Paystack
        </p>
        <Button
          type="button"
          disabled={pending || (options.length > 0 && !selected)}
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await initiateSubscribeAction({
                interval: selected?.interval ?? interval
              });
              if (!result.success || !result.data) {
                setError(result.error ?? "Unable to start checkout.");
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
                        return;
                      }
                      if (phase === "failed") {
                        setError("Payment was not confirmed. Try again or contact support.");
                        setMessage(null);
                        return;
                      }
                      setMessage(
                        "Payment submitted. If PRO is not active in a minute, refresh this page."
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
          {pending ? "Opening…" : label}
        </Button>
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
    </div>
  );
}
