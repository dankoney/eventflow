import type { Prisma } from "@prisma/client";

/**
 * Clears Enterprise overdue flag + reminder idempotency when a new future
 * coverage window is established (paid invoice or superadmin period edit).
 */
export const clearEnterpriseCoverageTrackingData = {
  coverageOverdueSince: null,
  enterpriseCoverageOverdueAlertSentAt: null,
  enterpriseCoverageReminderDay30SentAt: null,
  enterpriseCoverageReminderDay14SentAt: null,
  enterpriseCoverageReminderDay7SentAt: null,
  enterpriseCoverageReminderDay3SentAt: null,
  enterpriseCoverageReminderDay1SentAt: null
} satisfies Prisma.SubscriptionUpdateInput;

export function enterpriseCoverageTrackingClearIfFuture(
  newPeriodEnd: Date,
  now = new Date()
): Prisma.SubscriptionUpdateInput {
  if (newPeriodEnd.getTime() > now.getTime()) {
    return { ...clearEnterpriseCoverageTrackingData };
  }
  return {};
}
