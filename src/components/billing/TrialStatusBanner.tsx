import Link from "next/link";
import { CreditCard } from "lucide-react";

import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";

type TrialStatusBannerProps = {
  daysRemaining: number;
  trialEndsAt: Date;
};

/**
 * Prominent trial runway for org ADMINs during card-free PRO trial.
 */
export function TrialStatusBanner({ daysRemaining, trialEndsAt }: TrialStatusBannerProps) {
  const endsLabel = trialEndsAt.toLocaleDateString(undefined, { dateStyle: "medium" });
  const urgent = daysRemaining <= 10;
  const variant = urgent ? "error" : "info";

  return (
    <WorkspaceNotice variant={variant} className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pr-2">
        <div className="flex items-start gap-2">
          <CreditCard className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <div>
            <p className="font-medium">
              PRO trial — {daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining
            </p>
            <p className="mt-0.5 text-xs opacity-90">
              Ends {endsLabel}. Add a payment method to keep PRO features after the trial.
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
  );
}
