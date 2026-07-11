"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  getBillingCheckoutStatusAction,
  initiateSubscribeAction
} from "@/lib/actions/billing.actions";
import { openPaystackPopup } from "@/lib/billing/openPaystackPopup";
import { Button } from "@/components/ui/Button";

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
  label = "Add payment / Subscribe to PRO"
}: {
  label?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await initiateSubscribeAction();
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
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
    </div>
  );
}
