import Link from "next/link";
import { AlertTriangle, CreditCard } from "lucide-react";

import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";

type BillingDashboardAlertsProps = {
  trial?: { daysRemaining: number; trialEndsAt: Date } | null;
  pastDue?: boolean;
  cardExpiring?: { cardLast4: string | null } | null;
};

/**
 * ADMIN-only billing alerts shown above dashboard content.
 */
export function BillingDashboardAlerts({
  trial,
  pastDue,
  cardExpiring
}: BillingDashboardAlertsProps) {
  return (
    <div className="mb-4 space-y-3">
      {pastDue ? (
        <WorkspaceNotice variant="error">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <div>
                <p className="font-medium">Payment failed — workspace is read-only for new work</p>
                <p className="mt-0.5 text-xs opacity-90">
                  You can view existing data. Creating events and broadcasts is paused until billing
                  is updated. Renew soon to avoid suspension.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/settings/billing"
              className="shrink-0 rounded-md bg-white/80 px-3 py-1.5 text-xs font-semibold text-zinc-900 ring-1 ring-black/10 transition hover:bg-white"
            >
              Update payment
            </Link>
          </div>
        </WorkspaceNotice>
      ) : null}

      {cardExpiring ? (
        <WorkspaceNotice variant="info">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-2">
            <div className="flex items-start gap-2">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <div>
                <p className="font-medium">Card expiring soon</p>
                <p className="mt-0.5 text-xs opacity-90">
                  {cardExpiring.cardLast4
                    ? `Card ending in ${cardExpiring.cardLast4} needs updating before the next renewal.`
                    : "Update your payment method before the next renewal."}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/settings/billing"
              className="shrink-0 rounded-md bg-white/80 px-3 py-1.5 text-xs font-semibold text-zinc-900 ring-1 ring-black/10 transition hover:bg-white"
            >
              Billing settings
            </Link>
          </div>
        </WorkspaceNotice>
      ) : null}

      {trial ? (
        <WorkspaceNotice variant={trial.daysRemaining <= 10 ? "error" : "info"}>
          <div className="flex flex-wrap items-center justify-between gap-3 pr-2">
            <div className="flex items-start gap-2">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <div>
                <p className="font-medium">
                  PRO trial — {trial.daysRemaining} day{trial.daysRemaining === 1 ? "" : "s"} remaining
                </p>
                <p className="mt-0.5 text-xs opacity-90">
                  Ends {trial.trialEndsAt.toLocaleDateString(undefined, { dateStyle: "medium" })}.
                  Add a payment method to keep PRO features after the trial.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/settings/billing"
              className="shrink-0 rounded-md bg-white/80 px-3 py-1.5 text-xs font-semibold text-zinc-900 ring-1 ring-black/10 transition hover:bg-white"
            >
              Billing settings
            </Link>
          </div>
        </WorkspaceNotice>
      ) : null}
    </div>
  );
}
