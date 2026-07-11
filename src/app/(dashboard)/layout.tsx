import { ReactNode } from "react";
import { Role, SubscriptionStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BillingDashboardAlerts } from "@/components/billing/BillingDashboardAlerts";
import { DashboardChrome } from "@/components/dashboard/DashboardChrome";
import { daysBetween } from "@/lib/billing/constants";
import { getOrgBillingAccess } from "@/lib/db/billing";
import { getEnabledModules } from "@/lib/features/modules";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/login");
  }

  /** Phase 4: existing JWT sessions on a hard-suspended org are locked out. */
  if (!session.user.isPlatformOwner) {
    const access = await getOrgBillingAccess(session.user.orgId);
    if (access && !access.canLogin) {
      redirect("/billing/suspended");
    }
  }

  const enabledModules = getEnabledModules();
  const isAdmin = session.user.role === Role.ADMIN;

  let billingAlerts: ReactNode = null;
  if (isAdmin) {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId: session.user.orgId },
      select: {
        status: true,
        trialEndsAt: true,
        cardExpiringNotifiedAt: true,
        cardLast4: true,
        pastDueSince: true
      }
    });

    const trial =
      subscription?.status === SubscriptionStatus.TRIALING && subscription.trialEndsAt
        ? {
            daysRemaining: Math.max(0, daysBetween(new Date(), subscription.trialEndsAt)),
            trialEndsAt: subscription.trialEndsAt
          }
        : null;

    const pastDue = subscription?.status === SubscriptionStatus.PAST_DUE;
    const cardExpiring = subscription?.cardExpiringNotifiedAt
      ? { cardLast4: subscription.cardLast4 }
      : null;

    if (trial || pastDue || cardExpiring) {
      billingAlerts = (
        <BillingDashboardAlerts trial={trial} pastDue={pastDue} cardExpiring={cardExpiring} />
      );
    }
  }

  return (
    <DashboardChrome
      email={session.user.email}
      role={session.user.role}
      isPlatformOwner={session.user.isPlatformOwner}
      enabledModules={enabledModules}
    >
      {billingAlerts}
      {children}
    </DashboardChrome>
  );
}
