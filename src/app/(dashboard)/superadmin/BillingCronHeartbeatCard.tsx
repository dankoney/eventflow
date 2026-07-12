import { cn } from "@/lib/utils";
import {
  evaluateBillingCronJobStatus,
  formatRelativeAge,
  jobStatusLabel,
  overallBillingCronSummary,
  worstBillingCronStatus,
  type BillingCronJobStatus
} from "@/lib/billing/cronHeartbeatStatus";

type Props = {
  lifecycleLastOkAt: Date | null;
  dunningLastOkAt: Date | null;
  now?: Date;
};

function StatusDot({
  status,
  pulse
}: {
  status: BillingCronJobStatus;
  pulse: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        status === "healthy" && "bg-emerald-500",
        status === "delayed" && "bg-amber-500",
        status === "down" && "bg-rose-500",
        status === "unknown" && "bg-zinc-400",
        pulse && "animate-pulse"
      )}
      aria-hidden
    />
  );
}

function statusBadgeClasses(status: BillingCronJobStatus): string {
  switch (status) {
    case "healthy":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
    case "delayed":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
    case "down":
      return "bg-rose-50 text-rose-900 ring-1 ring-rose-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
  }
}

function cardBorderClasses(overall: BillingCronJobStatus): string {
  switch (overall) {
    case "down":
      return "border-rose-200 bg-rose-50/30";
    case "delayed":
      return "border-amber-200 bg-amber-50/30";
    default:
      return "border-zinc-200 bg-white";
  }
}

export function BillingCronHeartbeatCard({
  lifecycleLastOkAt,
  dunningLastOkAt,
  now = new Date()
}: Props) {
  const lifecycle = evaluateBillingCronJobStatus("lifecycle", lifecycleLastOkAt, now);
  const dunning = evaluateBillingCronJobStatus("dunning", dunningLastOkAt, now);
  const overall = worstBillingCronStatus([lifecycle.status, dunning.status]);
  const summary = overallBillingCronSummary(overall);
  const overallPulse = overall === "delayed" || overall === "down";

  return (
    <section
      className={cn("rounded-2xl border px-4 py-4 text-sm shadow-sm", cardBorderClasses(overall))}
      aria-label="Billing cron heartbeat"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Billing cron heartbeat
        </p>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            statusBadgeClasses(overall)
          )}
        >
          <StatusDot status={overall} pulse={overallPulse} />
          {summary.label}
        </span>
      </div>

      <ul className="mt-4 space-y-0 divide-y divide-zinc-200/70">
        {[lifecycle, dunning].map((row) => {
          const pulse = row.status === "delayed" || row.status === "down";
          return (
            <li key={row.job} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <StatusDot status={row.status} pulse={pulse} />
                <span className="font-medium leading-none text-zinc-900">{row.label}</span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
                    statusBadgeClasses(row.status)
                  )}
                >
                  {jobStatusLabel(row.status)}
                </span>
              </div>
              {row.lastOkAt ? (
                <p className="mt-1.5 pl-4 text-xs leading-snug text-zinc-500">
                  <span>{formatRelativeAge(row.ageMs)}</span>
                  <span className="mx-1.5 text-zinc-300">·</span>
                  <span className="font-mono tabular-nums text-zinc-400">
                    {row.lastOkAt.toISOString()} UTC
                  </span>
                </p>
              ) : (
                <p className="mt-1.5 pl-4 text-xs text-zinc-500">
                  No successful run recorded yet
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 border-t border-zinc-200/70 pt-3 text-xs text-zinc-500">
        Expected: lifecycle daily 06:00 UTC · dunning every 6 hours. Miss alert email fires after
        25h without a successful run.
      </p>
    </section>
  );
}
