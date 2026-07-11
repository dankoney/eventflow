"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { fetchPaystackLiveStateAction } from "@/lib/actions/superadminBilling.actions";
import { cn } from "@/lib/utils";

type LocalSnapshot = {
  plan?: string;
  subscription?: {
    status?: string | null;
    paystackSubscriptionCode?: string | null;
    paystackPlanCode?: string | null;
    paystackStatus?: string | null;
    cancelAtPeriodEnd?: boolean | null;
    currentPeriodEnd?: string | null;
  } | null;
  billingCustomer?: {
    paystackCustomerCode?: string | null;
    billingEmail?: string | null;
  } | null;
  missing?: boolean;
};

type PaystackLive = {
  subscription_code: string;
  status: string;
  next_payment_date: string;
  plan: { plan_code: string; name: string };
  customer: { customer_code: string; email: string };
} | null;

type Props = {
  orgId: string;
  initialLocal: LocalSnapshot;
  initialPaystack: PaystackLive;
  initialPaystackError: string | null;
};

function DriftRow({
  label,
  local,
  live,
  mismatch
}: {
  label: string;
  local: string;
  live: string;
  mismatch: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 py-1.5 text-xs first:border-t-0">
      <div className="font-medium text-zinc-500">{label}</div>
      <div className={cn("font-mono break-all", mismatch && "text-amber-700")}>{local}</div>
      <div className={cn("font-mono break-all", mismatch && "text-amber-700")}>{live}</div>
    </div>
  );
}

function normalize(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  return value;
}

function dateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function PaystackDriftPanel({
  orgId,
  initialLocal,
  initialPaystack,
  initialPaystackError
}: Props) {
  const [local, setLocal] = useState<LocalSnapshot>(initialLocal);
  const [paystack, setPaystack] = useState<PaystackLive>(initialPaystack);
  const [paystackError, setPaystackError] = useState<string | null>(initialPaystackError);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    setError(null);
    startTransition(async () => {
      const res = await fetchPaystackLiveStateAction({ orgId });
      if (!res.success || !res.data) {
        setError(res.error ?? "Failed to refresh Paystack state.");
        return;
      }
      setLocal(res.data.local as LocalSnapshot);
      setPaystack(res.data.paystack);
      setPaystackError(res.data.paystackError);
    });
  }

  const sub = local.subscription;
  const localStatus = normalize(sub?.paystackStatus ?? sub?.status);
  const liveStatus = normalize(paystack?.status);
  const localCode = normalize(sub?.paystackSubscriptionCode);
  const liveCode = normalize(paystack?.subscription_code);
  const localPlan = normalize(sub?.paystackPlanCode);
  const livePlan = normalize(paystack?.plan?.plan_code);
  const localCustomer = normalize(local.billingCustomer?.paystackCustomerCode);
  const liveCustomer = normalize(paystack?.customer?.customer_code);
  const localPeriod = dateOnly(sub?.currentPeriodEnd ?? null);
  const livePeriod = dateOnly(paystack?.next_payment_date ?? null);
  const localCancel = sub?.cancelAtPeriodEnd ? "yes" : "no";
  const liveCancel =
    paystack?.status?.toLowerCase() === "non-renewing"
      ? "yes"
      : paystack
        ? "no"
        : "—";

  const rows = [
    {
      label: "Status",
      local: localStatus,
      live: liveStatus,
      mismatch: Boolean(paystack) && localStatus.toLowerCase() !== liveStatus.toLowerCase()
    },
    {
      label: "Subscription code",
      local: localCode,
      live: liveCode,
      mismatch: Boolean(paystack) && localCode !== liveCode
    },
    {
      label: "Plan code",
      local: localPlan,
      live: livePlan,
      mismatch: Boolean(paystack) && localPlan !== livePlan && localPlan !== "—"
    },
    {
      label: "Customer code",
      local: localCustomer,
      live: liveCustomer,
      mismatch: Boolean(paystack) && localCustomer !== liveCustomer
    },
    {
      label: "Period / next payment",
      local: localPeriod,
      live: livePeriod,
      mismatch: Boolean(paystack) && localPeriod !== livePeriod && localPeriod !== "—"
    },
    {
      label: "Cancel at period end",
      local: localCancel,
      live: liveCancel,
      mismatch: Boolean(paystack) && localCancel !== liveCancel
    }
  ];

  const hasMismatch = rows.some((r) => r.mismatch);
  const noPaystackSubscription =
    local.plan === "ENTERPRISE" &&
    (!sub?.paystackSubscriptionCode || sub.paystackSubscriptionCode === "");

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Paystack drift</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {noPaystackSubscription
              ? "Enterprise invoice billing — no Paystack subscription to compare."
              : "Local DB vs live Paystack GET"}
            {!noPaystackSubscription && hasMismatch ? (
              <span className="ml-1 font-medium text-amber-700">· mismatches highlighted</span>
            ) : null}
          </p>
        </div>
        {!noPaystackSubscription ? (
          <Button
            type="button"
            variant="secondary"
            onClick={refresh}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-xs"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            Refresh
          </Button>
        ) : null}
      </div>

      {noPaystackSubscription ? (
        <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-3 text-xs text-sky-950">
          <p className="font-medium">No Paystack subscription — Enterprise invoice billing</p>
          <p className="mt-1 text-sky-900/80">
            This workspace is on ENTERPRISE. Access is granted via payable invoices, not a recurring
            Paystack plan. Drift comparison does not apply.
          </p>
          <p className="mt-2 text-sky-900/70">
            Org plan: {local.plan ?? "—"} · Local period end: {localPeriod} · Billing: invoice-based
          </p>
        </div>
      ) : local.missing ? (
        <p className="text-xs text-zinc-500">Organization snapshot missing.</p>
      ) : (
        <div>
          {error ? <p className="mb-2 text-xs text-rose-700">{error}</p> : null}
          {paystackError ? (
            <p className="mb-2 text-xs text-amber-700">Paystack: {paystackError}</p>
          ) : null}
          <div className="grid grid-cols-3 gap-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            <div>Field</div>
            <div>Local</div>
            <div>Paystack live</div>
          </div>
          {rows.map((row) => (
            <DriftRow key={row.label} {...row} />
          ))}
          <div className="mt-2 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-2 text-[11px] text-zinc-500">
            <div>
              <span className="font-medium text-zinc-600">Org plan: </span>
              {local.plan ?? "—"}
            </div>
            <div>
              <span className="font-medium text-zinc-600">Sub status: </span>
              {sub?.status ?? "—"}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
