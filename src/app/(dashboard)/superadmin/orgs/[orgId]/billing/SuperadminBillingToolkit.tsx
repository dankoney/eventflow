"use client";

import { BillingInvoiceSource, OrgPlan, SubscriptionStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { BillingReceiptDownloadButton } from "@/components/billing/BillingReceiptDownloadButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  cancelEnterprisePayableInvoiceAction,
  createEnterprisePayableInvoiceAction,
  extendTrialAction,
  forceCancelOrgBillingAction,
  forceExpireTrialAction,
  grantCompAccessAction,
  grantFreshTrialAction,
  logOfflinePaymentAction,
  markInvoicePaidManualAction,
  pauseDunningAction,
  reinstateOrgBillingAction,
  resendEnterprisePayableInvoiceAction,
  resetDunningAction,
  resyncSubscriptionFromPaystackAction,
  resumeDunningAction,
  revokeCompAccessAction,
  setCurrentPeriodEndAction,
  setOrgAutoRenewalAction,
  setOrgPlanOverrideAction,
  setTrialEndsAtAction,
  suspendOrgBillingAction
} from "@/lib/actions/superadminBilling.actions";
import { formatGhsFromPesewas } from "@/lib/billing/formatMoney";
import { cn } from "@/lib/utils";

export type ToolkitInvoice = {
  id: string;
  amountPesewas: number;
  currency: string;
  status: string;
  source: BillingInvoiceSource | string;
  paidAt: string | null;
  createdAt: string;
  dueDate: string | null;
  paystackInvoiceCode: string | null;
  paystackPaymentRequestCode: string | null;
  paymentPageUrl: string | null;
};

type TabId = "account" | "plan" | "billing" | "invoices";

type Props = {
  orgId: string;
  orgPlan: OrgPlan | string;
  invoices: ToolkitInvoice[];
  subscriptionStatus?: SubscriptionStatus | null;
  initialTab?: TabId;
  renewPrefill?: { endedDateLabel: string } | null;
};

type ActionFn = (input: Record<string, unknown>) => Promise<{
  success: boolean;
  error?: string;
}>;

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "account", label: "Account status" },
  { id: "plan", label: "Plan & trial" },
  { id: "billing", label: "Billing & payments" },
  { id: "invoices", label: "Invoices" }
];

function defaultTab(status: SubscriptionStatus | null | undefined): TabId {
  if (status === SubscriptionStatus.SUSPENDED || status === SubscriptionStatus.PAST_DUE) {
    return "account";
  }
  return "plan";
}

function isTabId(value: string | undefined): value is TabId {
  return value === "account" || value === "plan" || value === "billing" || value === "invoices";
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
      {children}
    </label>
  );
}

function inputClassName(extra?: string) {
  return cn(
    "w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none",
    extra
  );
}

function ReasonField({
  value,
  onChange,
  id
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <div>
      <FieldLabel>Reason (min 10 chars)</FieldLabel>
      <textarea
        id={id}
        required
        minLength={10}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName("resize-y")}
        placeholder="Why are you taking this action?"
      />
    </div>
  );
}

function Feedback({ error, success }: { error: string | null; success: string | null }) {
  if (error) return <p className="text-xs text-rose-700">{error}</p>;
  if (success) return <p className="text-xs text-emerald-700">{success}</p>;
  return null;
}

function ActionCard({
  title,
  description,
  children,
  onSubmit,
  pending,
  error,
  success,
  submitLabel,
  destructive = false,
  disabled
}: {
  title: string;
  description: string;
  children: ReactNode;
  onSubmit: (e: FormEvent) => void;
  pending: boolean;
  error: string | null;
  success: string | null;
  submitLabel: string;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "space-y-3 rounded-xl border bg-white p-4 shadow-sm",
        destructive ? "border-rose-200" : "border-zinc-200"
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
      {children}
      <Feedback error={error} success={success} />
      <Button
        type="submit"
        variant={destructive ? "danger" : "default"}
        disabled={pending || disabled}
        className={cn(
          "text-xs",
          destructive && "ring-1 ring-rose-300"
        )}
      >
        {pending ? "Working…" : submitLabel}
      </Button>
    </form>
  );
}

function datetimeLocalToIso(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}

function ManualBadge() {
  return <Badge className="bg-violet-100 text-violet-900 ring-1 ring-violet-200">Manual</Badge>;
}

function isManualSource(source: BillingInvoiceSource | string) {
  return source === BillingInvoiceSource.MANUAL || source === "MANUAL";
}

function isEnterprisePayableSource(source: BillingInvoiceSource | string) {
  return (
    source === BillingInvoiceSource.ENTERPRISE_PAYABLE || source === "ENTERPRISE_PAYABLE"
  );
}

export function SuperadminBillingToolkit({
  orgId,
  orgPlan,
  invoices,
  subscriptionStatus,
  initialTab,
  renewPrefill
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(
    () => (isTabId(initialTab) ? initialTab : defaultTab(subscriptionStatus))
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    Record<string, { error: string | null; success: string | null }>
  >({});
  const [, startTransition] = useTransition();

  const [suspendReason, setSuspendReason] = useState("");
  const [suspendSync, setSuspendSync] = useState(false);
  const [suspendConfirm, setSuspendConfirm] = useState(false);

  const [reinstateReason, setReinstateReason] = useState("");
  const [reinstateStatus, setReinstateStatus] = useState<"ACTIVE" | "PAST_DUE">("ACTIVE");

  const [forceCancelReason, setForceCancelReason] = useState("");
  const [forceCancelConfirm, setForceCancelConfirm] = useState(false);
  const [forceCancelPaystack, setForceCancelPaystack] = useState(false);

  const [planOverride, setPlanOverride] = useState<OrgPlan>(OrgPlan.PRO);
  const [planReason, setPlanReason] = useState("");

  const [compPlan, setCompPlan] = useState<"PRO" | "ENTERPRISE">("PRO");
  const [compDays, setCompDays] = useState(30);
  const [compReason, setCompReason] = useState("");
  const [revokeCompReason, setRevokeCompReason] = useState("");

  const [extendDays, setExtendDays] = useState(7);
  const [extendReason, setExtendReason] = useState("");
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [trialEndsReason, setTrialEndsReason] = useState("");
  const [freshDays, setFreshDays] = useState(90);
  const [freshAllowRepeat, setFreshAllowRepeat] = useState(false);
  const [freshReason, setFreshReason] = useState("");
  const [expireConfirm, setExpireConfirm] = useState(false);
  const [expireReason, setExpireReason] = useState("");

  const [periodEnd, setPeriodEnd] = useState("");
  const [periodReason, setPeriodReason] = useState("");
  const [resyncConfirm, setResyncConfirm] = useState(false);
  const [resyncReason, setResyncReason] = useState("");

  const [markInvoiceId, setMarkInvoiceId] = useState(invoices[0]?.id ?? "");
  const [markReason, setMarkReason] = useState("");

  const [invoiceAmountMajor, setInvoiceAmountMajor] = useState("");
  const [lineItems, setLineItems] = useState([{ description: "", amountMajor: "" }]);
  const [markPaid, setMarkPaid] = useState(true);
  const [offlineReason, setOfflineReason] = useState("");

  const [enterpriseLines, setEnterpriseLines] = useState([
    { description: "", amountMajor: "" }
  ]);
  const [enterpriseDueDate, setEnterpriseDueDate] = useState("");
  const [enterpriseApplyVat, setEnterpriseApplyVat] = useState(true);
  const [enterpriseNotes, setEnterpriseNotes] = useState("");
  const [enterpriseReason, setEnterpriseReason] = useState(() =>
    renewPrefill
      ? `Coverage renewal — ended ${renewPrefill.endedDateLabel}`
      : ""
  );
  const [enterpriseActionReason, setEnterpriseActionReason] = useState("");
  const [enterpriseCoverageMonths, setEnterpriseCoverageMonths] = useState("12");
  const [enterpriseExtendPrior, setEnterpriseExtendPrior] = useState(
    () => renewPrefill == null
  );

  const [pauseReason, setPauseReason] = useState("");
  const [resumeReason, setResumeReason] = useState("");
  const [resetReason, setResetReason] = useState("");

  const [autoOnReason, setAutoOnReason] = useState("");
  const [autoOffReason, setAutoOffReason] = useState("");

  function setMsg(key: string, error: string | null, success: string | null) {
    setMessages((prev) => ({ ...prev, [key]: { error, success } }));
  }

  function runAction(key: string, fn: ActionFn, payload: Record<string, unknown>) {
    setMsg(key, null, null);
    setPendingKey(key);
    startTransition(async () => {
      try {
        const res = await fn(payload);
        if (!res.success) {
          setMsg(key, res.error ?? "Action failed.", null);
        } else {
          setMsg(key, null, "Done.");
          router.refresh();
        }
      } catch {
        setMsg(key, "Unexpected error.", null);
      } finally {
        setPendingKey(null);
      }
    });
  }

  const msg = (key: string) => messages[key] ?? { error: null, success: null };
  const unpaidInvoices = invoices.filter((i) => i.status !== "PAID");

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-zinc-100/80 p-1"
        role="tablist"
        aria-label="Billing ops"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "account" ? (
        <div className="grid gap-4 lg:grid-cols-1 xl:grid-cols-2">
          <ActionCard
            title="Suspend"
            description="Blocks login for this workspace. Does not clear onboarding activation."
            submitLabel="Suspend"
            destructive
            pending={pendingKey === "suspend"}
            error={msg("suspend").error}
            success={msg("suspend").success}
            disabled={!suspendConfirm}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("suspend", suspendOrgBillingAction as ActionFn, {
                orgId,
                reason: suspendReason,
                syncPaystack: suspendSync,
                confirm: true
              });
            }}
          >
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={suspendSync}
                onChange={(e) => setSuspendSync(e.target.checked)}
              />
              Also disable on Paystack (syncPaystack)
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={suspendConfirm}
                onChange={(e) => setSuspendConfirm(e.target.checked)}
                required
              />
              I confirm suspend
            </label>
            <ReasonField id="suspend-reason" value={suspendReason} onChange={setSuspendReason} />
          </ActionCard>

          <ActionCard
            title="Reinstate"
            description="Clears suspension and restores the chosen billing status."
            submitLabel="Reinstate"
            pending={pendingKey === "reinstate"}
            error={msg("reinstate").error}
            success={msg("reinstate").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("reinstate", reinstateOrgBillingAction as ActionFn, {
                orgId,
                reason: reinstateReason,
                targetStatus: reinstateStatus
              });
            }}
          >
            <div>
              <FieldLabel>Target status</FieldLabel>
              <select
                className={inputClassName()}
                value={reinstateStatus}
                onChange={(e) => setReinstateStatus(e.target.value as "ACTIVE" | "PAST_DUE")}
              >
                <option value={SubscriptionStatus.ACTIVE}>ACTIVE</option>
                <option value={SubscriptionStatus.PAST_DUE}>PAST_DUE</option>
              </select>
            </div>
            <ReasonField id="reinstate-reason" value={reinstateReason} onChange={setReinstateReason} />
          </ActionCard>

          <ActionCard
            title="Force cancel"
            description="Ends access immediately and sets plan to FREE. Not the same as customer period-end cancel."
            submitLabel="Force cancel"
            destructive
            pending={pendingKey === "forceCancel"}
            error={msg("forceCancel").error}
            success={msg("forceCancel").success}
            disabled={!forceCancelConfirm}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("forceCancel", forceCancelOrgBillingAction as ActionFn, {
                orgId,
                reason: forceCancelReason,
                disableOnPaystack: forceCancelPaystack,
                confirm: true
              });
            }}
          >
            <label className="flex items-start gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={forceCancelConfirm}
                onChange={(e) => setForceCancelConfirm(e.target.checked)}
                required
              />
              <span>
                I understand this ends access immediately and sets plan to FREE — this is NOT the
                customer period-end cancel.
              </span>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={forceCancelPaystack}
                onChange={(e) => setForceCancelPaystack(e.target.checked)}
              />
              Also disable on Paystack
            </label>
            <ReasonField
              id="force-cancel-reason"
              value={forceCancelReason}
              onChange={setForceCancelReason}
            />
          </ActionCard>
        </div>
      ) : null}

      {tab === "plan" ? (
        <div className="grid gap-4 lg:grid-cols-1 xl:grid-cols-2">
          <ActionCard
            title="Plan override"
            description="Directly set Organization.plan (FREE / PRO / ENTERPRISE). PRO→ENTERPRISE disables any Paystack subscription and clears leftover PRO period. ENTERPRISE→PRO does not create a Paystack subscription — the org must subscribe via Settings → Billing."
            submitLabel="Set plan"
            pending={pendingKey === "plan"}
            error={msg("plan").error}
            success={msg("plan").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("plan", setOrgPlanOverrideAction as ActionFn, {
                orgId,
                plan: planOverride,
                reason: planReason
              });
            }}
          >
            <div>
              <FieldLabel>Plan</FieldLabel>
              <select
                className={inputClassName()}
                value={planOverride}
                onChange={(e) => setPlanOverride(e.target.value as OrgPlan)}
              >
                <option value={OrgPlan.FREE}>FREE</option>
                <option value={OrgPlan.PRO}>PRO</option>
                <option value={OrgPlan.ENTERPRISE}>ENTERPRISE</option>
              </select>
            </div>
            <ReasonField id="plan-reason" value={planReason} onChange={setPlanReason} />
          </ActionCard>

          <ActionCard
            title="Grant comp access"
            description="Temporary PRO/ENTERPRISE with no payment. Distinct from trial. Auto-reinstates if suspended."
            submitLabel="Grant comp"
            pending={pendingKey === "comp"}
            error={msg("comp").error}
            success={msg("comp").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("comp", grantCompAccessAction as ActionFn, {
                orgId,
                plan: compPlan,
                days: Number(compDays),
                reason: compReason
              });
            }}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <FieldLabel>Plan</FieldLabel>
                <select
                  className={inputClassName()}
                  value={compPlan}
                  onChange={(e) => setCompPlan(e.target.value as "PRO" | "ENTERPRISE")}
                >
                  <option value={OrgPlan.PRO}>PRO</option>
                  <option value={OrgPlan.ENTERPRISE}>ENTERPRISE</option>
                </select>
              </div>
              <div>
                <FieldLabel>Days</FieldLabel>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  className={inputClassName()}
                  value={compDays}
                  onChange={(e) => setCompDays(Number(e.target.value))}
                />
              </div>
            </div>
            <ReasonField id="comp-reason" value={compReason} onChange={setCompReason} />
          </ActionCard>

          <ActionCard
            title="Revoke comp"
            description="Clears comp fields and re-applies entitlements from real subscription state."
            submitLabel="Revoke comp"
            pending={pendingKey === "revokeComp"}
            error={msg("revokeComp").error}
            success={msg("revokeComp").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("revokeComp", revokeCompAccessAction as ActionFn, {
                orgId,
                reason: revokeCompReason
              });
            }}
          >
            <ReasonField
              id="revoke-comp-reason"
              value={revokeCompReason}
              onChange={setRevokeCompReason}
            />
          </ActionCard>

          <ActionCard
            title="Extend trial"
            description="Add days to an active TRIALING subscription’s trialEndsAt."
            submitLabel="Extend trial"
            pending={pendingKey === "extend"}
            error={msg("extend").error}
            success={msg("extend").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("extend", extendTrialAction as ActionFn, {
                orgId,
                addDays: Number(extendDays),
                reason: extendReason
              });
            }}
          >
            <div>
              <FieldLabel>Add days</FieldLabel>
              <input
                type="number"
                min={1}
                max={3650}
                className={inputClassName()}
                value={extendDays}
                onChange={(e) => setExtendDays(Number(e.target.value))}
              />
            </div>
            <ReasonField id="extend-reason" value={extendReason} onChange={setExtendReason} />
          </ActionCard>

          <ActionCard
            title="Set trial end"
            description="Overwrite trialEndsAt to a specific timestamp."
            submitLabel="Set trial end"
            pending={pendingKey === "trialEnds"}
            error={msg("trialEnds").error}
            success={msg("trialEnds").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("trialEnds", setTrialEndsAtAction as ActionFn, {
                orgId,
                trialEndsAt: datetimeLocalToIso(trialEndsAt),
                reason: trialEndsReason
              });
            }}
          >
            <div>
              <FieldLabel>trialEndsAt</FieldLabel>
              <input
                type="datetime-local"
                required
                className={inputClassName()}
                value={trialEndsAt}
                onChange={(e) => setTrialEndsAt(e.target.value)}
              />
            </div>
            <ReasonField id="trial-ends-reason" value={trialEndsReason} onChange={setTrialEndsReason} />
          </ActionCard>

          <ActionCard
            title="Grant fresh trial"
            description="Start a new card-free trial. Re-grants require allowRepeat."
            submitLabel="Grant trial"
            pending={pendingKey === "fresh"}
            error={msg("fresh").error}
            success={msg("fresh").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("fresh", grantFreshTrialAction as ActionFn, {
                orgId,
                days: Number(freshDays),
                allowRepeat: freshAllowRepeat,
                reason: freshReason
              });
            }}
          >
            <div>
              <FieldLabel>Days</FieldLabel>
              <input
                type="number"
                min={1}
                max={3650}
                className={inputClassName()}
                value={freshDays}
                onChange={(e) => setFreshDays(Number(e.target.value))}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={freshAllowRepeat}
                onChange={(e) => setFreshAllowRepeat(e.target.checked)}
              />
              Allow repeat (org already had a trial)
            </label>
            <ReasonField id="fresh-reason" value={freshReason} onChange={setFreshReason} />
          </ActionCard>

          <ActionCard
            title="Force-expire trial"
            description="Ends the trial now and downgrades entitlements to FREE / TRIAL_EXPIRED."
            submitLabel="Expire trial"
            destructive
            pending={pendingKey === "expire"}
            error={msg("expire").error}
            success={msg("expire").success}
            disabled={!expireConfirm}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("expire", forceExpireTrialAction as ActionFn, {
                orgId,
                reason: expireReason,
                confirm: true
              });
            }}
          >
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={expireConfirm}
                onChange={(e) => setExpireConfirm(e.target.checked)}
                required
              />
              I confirm force-expire
            </label>
            <ReasonField id="expire-reason" value={expireReason} onChange={setExpireReason} />
          </ActionCard>
        </div>
      ) : null}

      {tab === "billing" ? (
        <div className="grid gap-4 lg:grid-cols-1 xl:grid-cols-2">
          <ActionCard
            title="Set current period end"
            description="Manually adjust local currentPeriodEnd (access / renewal anchor)."
            submitLabel="Set period end"
            pending={pendingKey === "period"}
            error={msg("period").error}
            success={msg("period").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("period", setCurrentPeriodEndAction as ActionFn, {
                orgId,
                currentPeriodEnd: datetimeLocalToIso(periodEnd),
                reason: periodReason
              });
            }}
          >
            <div>
              <FieldLabel>currentPeriodEnd</FieldLabel>
              <input
                type="datetime-local"
                required
                className={inputClassName()}
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
            <ReasonField id="period-reason" value={periodReason} onChange={setPeriodReason} />
          </ActionCard>

          <ActionCard
            title="Resync from Paystack"
            description="GET Paystack subscription and overwrite local codes/status/period/card fields."
            submitLabel="Resync"
            pending={pendingKey === "resync"}
            error={msg("resync").error}
            success={msg("resync").success}
            disabled={!resyncConfirm}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("resync", resyncSubscriptionFromPaystackAction as ActionFn, {
                orgId,
                reason: resyncReason
              });
            }}
          >
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={resyncConfirm}
                onChange={(e) => setResyncConfirm(e.target.checked)}
                required
              />
              Confirm overwrite local from Paystack GET
            </label>
            <ReasonField id="resync-reason" value={resyncReason} onChange={setResyncReason} />
          </ActionCard>

          <ActionCard
            title="Turn auto-renewal on"
            description="Re-enable Paystack renewals (enable or create+start_date). No charge now."
            submitLabel="Enable auto-renewal"
            pending={pendingKey === "autoOn"}
            error={msg("autoOn").error}
            success={msg("autoOn").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("autoOn", setOrgAutoRenewalAction as ActionFn, {
                orgId,
                enabled: true,
                reason: autoOnReason
              });
            }}
          >
            <ReasonField id="auto-on-reason" value={autoOnReason} onChange={setAutoOnReason} />
          </ActionCard>

          <ActionCard
            title="Turn auto-renewal off"
            description="Disable Paystack auto-renewal; access continues until period end locally."
            submitLabel="Disable auto-renewal"
            pending={pendingKey === "autoOff"}
            error={msg("autoOff").error}
            success={msg("autoOff").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("autoOff", setOrgAutoRenewalAction as ActionFn, {
                orgId,
                enabled: false,
                reason: autoOffReason
              });
            }}
          >
            <ReasonField id="auto-off-reason" value={autoOffReason} onChange={setAutoOffReason} />
          </ActionCard>

          <ActionCard
            title="Pause dunning"
            description="Skip dunning cron retries until resumed."
            submitLabel="Pause dunning"
            pending={pendingKey === "pause"}
            error={msg("pause").error}
            success={msg("pause").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("pause", pauseDunningAction as ActionFn, { orgId, reason: pauseReason });
            }}
          >
            <ReasonField id="pause-reason" value={pauseReason} onChange={setPauseReason} />
          </ActionCard>

          <ActionCard
            title="Resume dunning"
            description="Clear dunning pause so retries can run again."
            submitLabel="Resume dunning"
            pending={pendingKey === "resume"}
            error={msg("resume").error}
            success={msg("resume").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("resume", resumeDunningAction as ActionFn, { orgId, reason: resumeReason });
            }}
          >
            <ReasonField id="resume-reason" value={resumeReason} onChange={setResumeReason} />
          </ActionCard>

          <ActionCard
            title="Reset dunning counters"
            description="Resets attempt counters only — does not change subscription status."
            submitLabel="Reset counters"
            pending={pendingKey === "reset"}
            error={msg("reset").error}
            success={msg("reset").success}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("reset", resetDunningAction as ActionFn, { orgId, reason: resetReason });
            }}
          >
            <ReasonField id="reset-reason" value={resetReason} onChange={setResetReason} />
          </ActionCard>
        </div>
      ) : null}

      {tab === "invoices" ? (
        <div className="space-y-4">
          {orgPlan === OrgPlan.ENTERPRISE || orgPlan === "ENTERPRISE" ? (
            <ActionCard
              title="Send invoice to customer"
              description="Creates a Paystack Payment Request (not a subscription), emails the customer our branded invoice with a Pay now link. VAT on exclusive line amounts by default."
              submitLabel="Send invoice"
              pending={pendingKey === "enterprisePayable"}
              error={msg("enterprisePayable").error}
              success={msg("enterprisePayable").success}
              onSubmit={(e) => {
                e.preventDefault();
                const items = enterpriseLines
                  .filter((li) => li.description.trim() && li.amountMajor !== "")
                  .map((li) => ({
                    description: li.description.trim(),
                    amountPesewas: Math.round(Number(li.amountMajor) * 100)
                  }));
                runAction(
                  "enterprisePayable",
                  createEnterprisePayableInvoiceAction as ActionFn,
                  {
                    orgId,
                    reason: enterpriseReason,
                    dueDate: enterpriseDueDate
                      ? new Date(enterpriseDueDate).toISOString()
                      : "",
                    applyVat: enterpriseApplyVat,
                    notes: enterpriseNotes.trim() || null,
                    lineItems: items,
                    coverageMonths: Number(enterpriseCoverageMonths) || 12,
                    extendFromPriorCoverage: enterpriseExtendPrior
                  }
                );
              }}
            >
              <div className="space-y-2">
                <FieldLabel>Line items (exclusive amounts, GHS)</FieldLabel>
                {enterpriseLines.map((li, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_7rem]">
                    <input
                      type="text"
                      placeholder="Description"
                      className={inputClassName()}
                      value={li.description}
                      onChange={(e) => {
                        const next = [...enterpriseLines];
                        next[idx] = { ...next[idx]!, description: e.target.value };
                        setEnterpriseLines(next);
                      }}
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="GHS"
                      className={inputClassName()}
                      value={li.amountMajor}
                      onChange={(e) => {
                        const next = [...enterpriseLines];
                        next[idx] = { ...next[idx]!, amountMajor: e.target.value };
                        setEnterpriseLines(next);
                      }}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  onClick={() =>
                    setEnterpriseLines([...enterpriseLines, { description: "", amountMajor: "" }])
                  }
                >
                  Add row
                </Button>
              </div>
              <div>
                <FieldLabel>Due date</FieldLabel>
                <input
                  type="date"
                  required
                  className={inputClassName()}
                  value={enterpriseDueDate}
                  onChange={(e) => setEnterpriseDueDate(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Coverage duration (months) — applied when paid</FieldLabel>
                <select
                  className={inputClassName()}
                  value={enterpriseCoverageMonths}
                  onChange={(e) => setEnterpriseCoverageMonths(e.target.value)}
                >
                  <option value="1">1 month</option>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                </select>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Locked at create time. After payment, access runs from paid date (or extends a
                  genuine prior Enterprise period if one exists).
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={enterpriseExtendPrior}
                  onChange={(e) => setEnterpriseExtendPrior(e.target.checked)}
                />
                Extend from current Enterprise period end when still in the future
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={enterpriseApplyVat}
                  onChange={(e) => setEnterpriseApplyVat(e.target.checked)}
                />
                Apply Ghana VAT itemization (NHIL 2.5% + GETFund 2.5% + VAT 15% on exclusive total)
              </label>
              <div>
                <FieldLabel>Notes (optional, shown on Paystack description)</FieldLabel>
                <textarea
                  className={inputClassName("min-h-[60px]")}
                  value={enterpriseNotes}
                  onChange={(e) => setEnterpriseNotes(e.target.value)}
                  maxLength={1000}
                />
              </div>
              <ReasonField
                id="enterprise-reason"
                value={enterpriseReason}
                onChange={setEnterpriseReason}
              />
            </ActionCard>
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
              Send invoice to customer is available when this workspace plan is ENTERPRISE.
            </p>
          )}

          <ActionCard
            title="Log offline payment"
            description="Records a payment received outside Paystack (e.g. bank transfer). This is NOT sent to the customer — use this only to log a payment that has already happened."
            submitLabel="Log offline payment"
            pending={pendingKey === "offline"}
            error={msg("offline").error}
            success={msg("offline").success}
            onSubmit={(e) => {
              e.preventDefault();
              const amountPesewas = Math.round(Number(invoiceAmountMajor) * 100);
              const items = lineItems
                .filter((li) => li.description.trim() && li.amountMajor !== "")
                .map((li) => ({
                  description: li.description.trim(),
                  amountPesewas: Math.round(Number(li.amountMajor) * 100)
                }));
              runAction("offline", logOfflinePaymentAction as ActionFn, {
                orgId,
                reason: offlineReason,
                amountPesewas,
                lineItems: items.length
                  ? items
                  : [{ description: "Offline payment", amountPesewas }],
                markPaid
              });
            }}
          >
            <div>
              <FieldLabel>Amount (GHS)</FieldLabel>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                className={inputClassName()}
                value={invoiceAmountMajor}
                onChange={(e) => setInvoiceAmountMajor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Line items</FieldLabel>
              {lineItems.map((li, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_7rem]">
                  <input
                    type="text"
                    placeholder="Description"
                    className={inputClassName()}
                    value={li.description}
                    onChange={(e) => {
                      const next = [...lineItems];
                      next[idx] = { ...next[idx]!, description: e.target.value };
                      setLineItems(next);
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="GHS"
                    className={inputClassName()}
                    value={li.amountMajor}
                    onChange={(e) => {
                      const next = [...lineItems];
                      next[idx] = { ...next[idx]!, amountMajor: e.target.value };
                      setLineItems(next);
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                onClick={() => setLineItems([...lineItems, { description: "", amountMajor: "" }])}
              >
                Add row
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={markPaid}
                onChange={(e) => setMarkPaid(e.target.checked)}
              />
              Mark as paid now
            </label>
            <ReasonField id="offline-reason" value={offlineReason} onChange={setOfflineReason} />
          </ActionCard>

          <ActionCard
            title="Mark invoice paid"
            description="Mark an existing unpaid invoice row as PAID (offline settlement)."
            submitLabel="Mark paid"
            pending={pendingKey === "markPaid"}
            error={msg("markPaid").error}
            success={msg("markPaid").success}
            disabled={!markInvoiceId || unpaidInvoices.length === 0}
            onSubmit={(e) => {
              e.preventDefault();
              runAction("markPaid", markInvoicePaidManualAction as ActionFn, {
                orgId,
                invoiceId: markInvoiceId,
                reason: markReason
              });
            }}
          >
            <div>
              <FieldLabel>Invoice</FieldLabel>
              {unpaidInvoices.length === 0 ? (
                <p className="text-xs text-zinc-500">No unpaid invoices.</p>
              ) : (
                <select
                  className={inputClassName()}
                  value={markInvoiceId}
                  onChange={(e) => setMarkInvoiceId(e.target.value)}
                >
                  {unpaidInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {formatGhsFromPesewas(inv.amountPesewas, inv.currency)} · {inv.status}
                      {isManualSource(inv.source) ? " · Manual" : ""} ·{" "}
                      {inv.paystackInvoiceCode ?? inv.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <ReasonField id="mark-reason" value={markReason} onChange={setMarkReason} />
          </ActionCard>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900">Invoice history</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Paystack-mirrored, offline (Manual), and Enterprise payable records for this workspace.
            </p>
            {invoices.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No invoices yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-100">
                {invoices.map((inv) => {
                  const showPayableActions =
                    isEnterprisePayableSource(inv.source) &&
                    inv.status === "PENDING" &&
                    Boolean(inv.paymentPageUrl);
                  return (
                  <li
                    key={inv.id}
                    className="flex flex-col gap-2 py-2.5 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-zinc-900">
                        {formatGhsFromPesewas(inv.amountPesewas, inv.currency)}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500">
                        {inv.paystackPaymentRequestCode ??
                          inv.paystackInvoiceCode ??
                          inv.id}
                      </div>
                      {inv.dueDate ? (
                        <div className="text-[11px] text-zinc-400">
                          Due {new Date(inv.dueDate).toLocaleDateString()}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isManualSource(inv.source) ? <ManualBadge /> : null}
                      {isEnterprisePayableSource(inv.source) ? (
                        <Badge className="bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200">
                          Payable
                        </Badge>
                      ) : null}
                      <Badge className="bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200">
                        {inv.status}
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        {new Date(inv.paidAt ?? inv.createdAt).toLocaleDateString()}
                      </span>
                      {inv.status === "PAID" ? (
                        <BillingReceiptDownloadButton invoiceId={inv.id} />
                      ) : null}
                      {showPayableActions ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            className="!px-2.5 !py-1 text-xs"
                            disabled={pendingKey === `resend-${inv.id}`}
                            onClick={() => {
                              if (enterpriseActionReason.trim().length < 10) {
                                setMsg(
                                  `resend-${inv.id}`,
                                  "Enter a reason (≥10 characters) in the field below, then click Resend.",
                                  null
                                );
                                return;
                              }
                              runAction(
                                `resend-${inv.id}`,
                                resendEnterprisePayableInvoiceAction as ActionFn,
                                {
                                  orgId,
                                  invoiceId: inv.id,
                                  reason: enterpriseActionReason
                                }
                              );
                            }}
                          >
                            Resend
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            className="!px-2.5 !py-1 text-xs"
                            disabled={pendingKey === `cancel-${inv.id}`}
                            onClick={() => {
                              if (enterpriseActionReason.trim().length < 10) {
                                setMsg(
                                  `cancel-${inv.id}`,
                                  "Enter a reason (≥10 characters) in the field below, then click Cancel.",
                                  null
                                );
                                return;
                              }
                              runAction(
                                `cancel-${inv.id}`,
                                cancelEnterprisePayableInvoiceAction as ActionFn,
                                {
                                  orgId,
                                  invoiceId: inv.id,
                                  reason: enterpriseActionReason
                                }
                              );
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : null}
                    </div>
                    </div>
                    {showPayableActions ? (
                      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <FieldLabel>Reason for Resend / Cancel (min 10 chars)</FieldLabel>
                        <textarea
                          className={inputClassName("min-h-[52px] bg-white")}
                          value={enterpriseActionReason}
                          onChange={(e) => setEnterpriseActionReason(e.target.value)}
                          placeholder="e.g. Customer requested a fresh invoice email"
                        />
                      </div>
                    ) : null}
                    {msg(`resend-${inv.id}`).error || msg(`cancel-${inv.id}`).error ? (
                      <p className="text-[11px] text-rose-700">
                        {msg(`resend-${inv.id}`).error ?? msg(`cancel-${inv.id}`).error}
                      </p>
                    ) : null}
                    {msg(`resend-${inv.id}`).success || msg(`cancel-${inv.id}`).success ? (
                      <p className="text-[11px] text-emerald-700">
                        {msg(`resend-${inv.id}`).success ?? msg(`cancel-${inv.id}`).success}
                      </p>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
