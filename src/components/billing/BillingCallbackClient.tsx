"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getBillingCheckoutStatusAction } from "@/lib/actions/billing.actions";

const POLL_MS = 2000;
const MAX_POLLS = 45; // ~90s
const REDIRECT_MS = 2500;

type BillingCallbackClientProps = {
  reference?: string;
};

export function BillingCallbackClient({ reference }: BillingCallbackClientProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"pending" | "active" | "failed">("pending");
  const [message, setMessage] = useState("Confirming your payment with Paystack…");
  const polls = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled || done.current) return;
      polls.current += 1;

      const result = await getBillingCheckoutStatusAction({ reference });
      if (cancelled || done.current) return;

      if (!result.success) {
        setPhase("failed");
        setMessage(result.error ?? "Unable to confirm payment status.");
        done.current = true;
        return;
      }

      const next = result.data!;
      setPhase(next.phase);
      setMessage(next.message);

      if (next.phase === "active") {
        done.current = true;
        timer = setTimeout(() => {
          router.replace("/dashboard");
        }, REDIRECT_MS);
        return;
      }

      if (next.phase === "failed") {
        done.current = true;
        return;
      }

      if (polls.current >= MAX_POLLS) {
        setPhase("failed");
        setMessage(
          "Still waiting for confirmation. If you were charged, open Billing settings in a minute — webhooks can lag."
        );
        done.current = true;
        return;
      }

      timer = setTimeout(() => {
        void tick();
      }, POLL_MS);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reference, router]);

  const boxClass =
    phase === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : phase === "failed"
        ? "border-rose-200 bg-rose-50 text-rose-950"
        : "border-zinc-200 bg-white text-zinc-700";

  return (
    <div className={`rounded-2xl border p-6 text-sm shadow-sm ${boxClass}`}>
      <p className="font-medium">
        {phase === "active"
          ? "Your subscription is active!"
          : phase === "failed"
            ? "Payment not confirmed"
            : "Payment received"}
      </p>
      <p className="mt-2">{message}</p>
      {reference ? (
        <p className="mt-3 text-xs opacity-80">
          Reference <code className="rounded bg-black/5 px-1 font-mono">{reference}</code>
        </p>
      ) : null}
      {phase === "active" ? (
        <p className="mt-4 text-xs opacity-80">Redirecting to your dashboard…</p>
      ) : (
        <p className="mt-4">
          <Link
            href="/dashboard"
            className="font-medium underline-offset-2 hover:underline"
          >
            Return to dashboard
          </Link>
        </p>
      )}
    </div>
  );
}
