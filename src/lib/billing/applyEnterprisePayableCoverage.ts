import {
  BillingInvoiceSource,
  BillingInvoiceStatus,
  OrgPlan,
  SubscriptionStatus,
  type Prisma
} from "@prisma/client";

import { clearEnterpriseCoverageTrackingData } from "@/lib/billing/clearEnterpriseCoverageTracking";

/** Add calendar months without relying on setMonth overflow quirks. */
export function addCalendarMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * After an ENTERPRISE_PAYABLE invoice is PAID, extend Subscription.currentPeriodEnd
 * from coverageMonths / coverageEndsAt captured at invoice create time.
 */
export async function applyEnterprisePayableCoverage(
  tx: Prisma.TransactionClient,
  invoiceId: string
): Promise<{ applied: boolean; currentPeriodEnd?: Date; reason?: string }> {
  const invoice = await tx.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      source: BillingInvoiceSource.ENTERPRISE_PAYABLE
    },
    select: {
      id: true,
      status: true,
      paidAt: true,
      coverageMonths: true,
      coverageEndsAt: true,
      extendFromPriorCoverage: true,
      coverageAppliedAt: true,
      orgId: true
    }
  });

  if (!invoice) return { applied: false, reason: "not_found" };
  if (invoice.status !== BillingInvoiceStatus.PAID) {
    return { applied: false, reason: "not_paid" };
  }
  if (invoice.coverageAppliedAt) {
    return { applied: false, reason: "already_applied" };
  }
  if (!invoice.coverageEndsAt && !invoice.coverageMonths) {
    return { applied: false, reason: "no_coverage_configured" };
  }

  const org = await tx.organization.findUnique({
    where: { id: invoice.orgId },
    select: { plan: true }
  });
  if (org?.plan !== OrgPlan.ENTERPRISE) {
    return { applied: false, reason: "org_not_enterprise" };
  }

  const paidAt = invoice.paidAt ?? new Date();
  const subscription = await tx.subscription.findUnique({
    where: { orgId: invoice.orgId },
    select: { currentPeriodEnd: true }
  });

  let newEnd: Date;
  if (invoice.coverageEndsAt) {
    newEnd = invoice.coverageEndsAt;
  } else {
    const months = invoice.coverageMonths ?? 0;
    const priorEnd = subscription?.currentPeriodEnd ?? null;
    const canExtendPrior =
      invoice.extendFromPriorCoverage &&
      priorEnd != null &&
      priorEnd.getTime() > paidAt.getTime();
    const base = canExtendPrior ? priorEnd! : paidAt;
    newEnd = addCalendarMonths(base, months);
  }

  await tx.subscription.update({
    where: { orgId: invoice.orgId },
    data: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: paidAt,
      currentPeriodEnd: newEnd,
      cancelAtPeriodEnd: true,
      pastDueSince: null,
      dunningAttempt: 0,
      nextDunningAt: null,
      suspendedAt: null,
      ...clearEnterpriseCoverageTrackingData
    }
  });

  await tx.billingInvoice.update({
    where: { id: invoice.id },
    data: { coverageAppliedAt: new Date() }
  });

  return { applied: true, currentPeriodEnd: newEnd };
}
