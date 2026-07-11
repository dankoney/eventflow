/** Card-free PRO trial length. */
export const TRIAL_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

/** Soft-lock grace after first failed renewal charge. */
export const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/** Days after pastDueSince when each dunning retry is due (anchor = pastDueSince, not cron ticks). */
export const DUNNING_RETRY_OFFSET_DAYS = [1, 3, 5] as const;

export const MAX_DUNNING_ATTEMPTS = DUNNING_RETRY_OFFSET_DAYS.length;

export const TRIAL_REMINDER_DAYS = [60, 80, 89] as const;

/**
 * Days before Enterprise currentPeriodEnd to send coverage renewal reminders.
 * Countdown from period end (unlike trial reminders, which count from trial start).
 */
export const ENTERPRISE_COVERAGE_REMINDER_DAYS = [30, 14, 7, 3, 1] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * When the next dunning retry is due. `retryIndex` 0 = first retry (day 1 after
 * pastDueSince), 1 = day 3, 2 = day 5. Always anchored to pastDueSince so cron
 * frequency cannot skip or double a retry.
 */
export function getDunningRetryDueAt(pastDueSince: Date, retryIndex: number): Date | null {
  const offsetDays = DUNNING_RETRY_OFFSET_DAYS[retryIndex];
  if (offsetDays === undefined) return null;
  return new Date(pastDueSince.getTime() + offsetDays * MS_PER_DAY);
}

export function getTrialReminderDueAt(trialStartsAt: Date, dayOffset: number): Date {
  return new Date(trialStartsAt.getTime() + dayOffset * MS_PER_DAY);
}

/** When an Enterprise pre-expiry reminder for `daysBefore` becomes due. */
export function getEnterpriseCoverageReminderDueAt(
  currentPeriodEnd: Date,
  daysBefore: number
): Date {
  return new Date(currentPeriodEnd.getTime() - daysBefore * MS_PER_DAY);
}

/** Whole calendar days from `from` until `to` (ceil). Negative when `to` is in the past. */
export function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export const DEFAULT_BILLING_CURRENCY = "GHS";

/**
 * Whether Paystack will accept /subscription/enable for this sub.
 * Live finding: plan-on-transaction subscriptions often report status
 * "non-renewing" after disable, but enable still returns
 * "Subscription has been cancelled, and cannot be reactivated."
 * Only treat as resumable when remote status is exactly non-renewing AND
 * we have not previously marked it unresumable.
 */
export function isPaystackStatusResumable(
  paystackStatus: string | null | undefined
): boolean {
  return (paystackStatus ?? "").toLowerCase() === "non-renewing";
}

/**
 * Base date for extending paid access: keep remaining time by anchoring to
 * `currentPeriodEnd` when it is still in the future; otherwise start from `now`.
 */
export function periodExtensionBase(currentPeriodEnd: Date | null | undefined, now = new Date()): Date {
  if (currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime()) {
    return currentPeriodEnd;
  }
  return now;
}

/** Add one Paystack plan interval to a date (monthly default). */
export function addPaystackPlanInterval(from: Date, interval: string): Date {
  const next = new Date(from.getTime());
  const normalized = interval.trim().toLowerCase();
  switch (normalized) {
    case "annually":
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    case "biannually":
      next.setMonth(next.getMonth() + 6);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "monthly":
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

export type BillingPlanInterval = "monthly" | "yearly";

export function getPaystackPlanCodeForInterval(
  interval: BillingPlanInterval
): string | null {
  if (interval === "yearly") {
    return process.env.PAYSTACK_PRO_YEARLY_PLAN_CODE?.trim() || null;
  }
  return process.env.PAYSTACK_PRO_PLAN_CODE?.trim() || null;
}

/** Map a Paystack plan interval string to our billing interval. */
export function billingIntervalFromPaystack(interval: string | null | undefined): BillingPlanInterval {
  const normalized = (interval ?? "").trim().toLowerCase();
  if (normalized === "annually" || normalized === "yearly") return "yearly";
  return "monthly";
}
