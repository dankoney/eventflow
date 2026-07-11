/**
 * Real scenario test: Enterprise org with lapsed currentPeriodEnd must NOT be
 * flipped to CANCELLED by the PRO cancel-at-period-end lifecycle branch.
 * It should only receive coverageOverdueSince = currentPeriodEnd.
 *
 * Run: npx tsx scripts/test-enterprise-coverage-lifecycle-carveout.ts
 */
import { OrgPlan, PrismaClient, SubscriptionStatus } from "@prisma/client";

import { runBillingLifecycleCron } from "../src/lib/billing/runBillingLifecycleCron";

const prisma = new PrismaClient();
const SLUG = "enterprise-coverage-carveout-fixture";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const pastEnd = new Date("2026-06-01T12:00:00.000Z");
  const now = new Date("2026-07-11T16:00:00.000Z");

  const org = await prisma.organization.upsert({
    where: { slug: SLUG },
    create: {
      name: "Enterprise Coverage Carveout Fixture",
      slug: SLUG,
      plan: OrgPlan.ENTERPRISE,
      activatedAt: new Date()
    },
    update: {
      plan: OrgPlan.ENTERPRISE,
      activatedAt: new Date()
    }
  });

  await prisma.subscription.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: true,
      currentPeriodStart: new Date("2025-06-01T12:00:00.000Z"),
      currentPeriodEnd: pastEnd,
      coverageOverdueSince: null
    },
    update: {
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: true,
      currentPeriodStart: new Date("2025-06-01T12:00:00.000Z"),
      currentPeriodEnd: pastEnd,
      coverageOverdueSince: null,
      paystackSubscriptionCode: null
    }
  });

  /** Control: a PRO org that SHOULD be cancelled by the same cron. */
  const proSlug = "pro-period-end-control-fixture";
  const proOrg = await prisma.organization.upsert({
    where: { slug: proSlug },
    create: {
      name: "PRO Period End Control Fixture",
      slug: proSlug,
      plan: OrgPlan.PRO,
      activatedAt: new Date()
    },
    update: { plan: OrgPlan.PRO, activatedAt: new Date() }
  });

  await prisma.subscription.upsert({
    where: { orgId: proOrg.id },
    create: {
      orgId: proOrg.id,
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: pastEnd
    },
    update: {
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: pastEnd
    }
  });

  const beforeEnt = await prisma.subscription.findUniqueOrThrow({
    where: { orgId: org.id },
    select: {
      status: true,
      currentPeriodEnd: true,
      coverageOverdueSince: true,
      cancelAtPeriodEnd: true
    }
  });
  assert(beforeEnt.status === SubscriptionStatus.ACTIVE, "fixture must start ACTIVE");
  assert(beforeEnt.coverageOverdueSince === null, "fixture overdue must start null");

  const result = await runBillingLifecycleCron(now);
  console.log("lifecycle result", result);

  const afterEnt = await prisma.organization.findUniqueOrThrow({
    where: { id: org.id },
    select: {
      plan: true,
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          coverageOverdueSince: true,
          cancelAtPeriodEnd: true
        }
      }
    }
  });

  const afterPro = await prisma.subscription.findUniqueOrThrow({
    where: { orgId: proOrg.id },
    select: { status: true }
  });

  console.log("enterprise after", JSON.stringify(afterEnt, null, 2));
  console.log("pro after", afterPro);

  assert(afterEnt.plan === OrgPlan.ENTERPRISE, "Enterprise plan must be unchanged");
  assert(
    afterEnt.subscription?.status === SubscriptionStatus.ACTIVE,
    `Enterprise status must stay ACTIVE, got ${afterEnt.subscription?.status}`
  );
  assert(
    !result.periodEnded.includes(org.id),
    "Enterprise org must not appear in periodEnded (PRO cancel path)"
  );
  assert(
    result.enterpriseCoverageOverdue.includes(org.id),
    "Enterprise org must be stamped in enterpriseCoverageOverdue"
  );
  assert(
    afterEnt.subscription?.coverageOverdueSince?.getTime() === pastEnd.getTime(),
    `coverageOverdueSince must equal currentPeriodEnd (${pastEnd.toISOString()}), got ${afterEnt.subscription?.coverageOverdueSince?.toISOString()}`
  );
  assert(
    afterPro.status === SubscriptionStatus.CANCELLED,
    `PRO control org must be CANCELLED, got ${afterPro.status}`
  );
  assert(result.periodEnded.includes(proOrg.id), "PRO control must be in periodEnded");

  /** Idempotent second run: no re-stamp churn / no cancel. */
  const second = await runBillingLifecycleCron(now);
  assert(
    !second.enterpriseCoverageOverdue.includes(org.id),
    "second run should not re-stamp already overdue Enterprise org"
  );
  assert(
    !second.periodEnded.includes(org.id),
    "second run must still not cancel Enterprise"
  );

  console.log("\nPASS — Enterprise carve-out verified with real lifecycle cron run");

  await prisma.organization.delete({ where: { id: org.id } }).catch(() => undefined);
  await prisma.organization.delete({ where: { id: proOrg.id } }).catch(() => undefined);
}

main()
  .catch((e) => {
    console.error("FAIL", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
