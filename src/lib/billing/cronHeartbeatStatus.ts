/** Client-safe status helpers for billing cron heartbeat UI. */

export const BILLING_CRON_MISS_THRESHOLD_MS = 25 * 60 * 60 * 1000;
/** Lifecycle expected daily — healthy within 26h. */
export const LIFECYCLE_HEALTHY_MS = 26 * 60 * 60 * 1000;
/** Dunning expected every 6h — healthy within 7h. */
export const DUNNING_HEALTHY_MS = 7 * 60 * 60 * 1000;

export type BillingCronJobStatus = "healthy" | "delayed" | "down" | "unknown";

export type BillingCronJobView = {
  job: "lifecycle" | "dunning";
  label: string;
  lastOkAt: Date | null;
  status: BillingCronJobStatus;
  ageMs: number | null;
};

export function evaluateBillingCronJobStatus(
  job: "lifecycle" | "dunning",
  lastOkAt: Date | null,
  now = new Date()
): BillingCronJobView {
  const label = job === "lifecycle" ? "Lifecycle" : "Dunning";
  if (!lastOkAt) {
    return { job, label, lastOkAt: null, status: "unknown", ageMs: null };
  }
  const ageMs = now.getTime() - lastOkAt.getTime();
  const healthyMs = job === "lifecycle" ? LIFECYCLE_HEALTHY_MS : DUNNING_HEALTHY_MS;
  let status: BillingCronJobStatus = "healthy";
  if (ageMs > BILLING_CRON_MISS_THRESHOLD_MS) status = "down";
  else if (ageMs > healthyMs) status = "delayed";
  return { job, label, lastOkAt, status, ageMs };
}

export function worstBillingCronStatus(
  statuses: BillingCronJobStatus[]
): BillingCronJobStatus {
  const rank: Record<BillingCronJobStatus, number> = {
    down: 3,
    delayed: 2,
    unknown: 1,
    healthy: 0
  };
  return statuses.reduce<BillingCronJobStatus>((worst, s) => {
    return rank[s] > rank[worst] ? s : worst;
  }, "healthy");
}

export function overallBillingCronSummary(status: BillingCronJobStatus): {
  label: string;
  tone: "ok" | "warn" | "bad" | "neutral";
} {
  switch (status) {
    case "healthy":
      return { label: "All systems OK", tone: "ok" };
    case "delayed":
      return { label: "Delayed", tone: "warn" };
    case "down":
      return { label: "Attention needed", tone: "bad" };
    default:
      return { label: "Awaiting first run", tone: "neutral" };
  }
}

/** Compact relative time for scannable heartbeat rows. */
export function formatRelativeAge(ageMs: number | null, nowLabel = "just now"): string {
  if (ageMs === null) return "never";
  if (ageMs < 60_000) return nowLabel;
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function jobStatusLabel(status: BillingCronJobStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "delayed":
      return "Delayed";
    case "down":
      return "Down";
    default:
      return "Unknown";
  }
}
