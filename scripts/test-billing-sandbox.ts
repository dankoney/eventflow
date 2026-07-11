/**
 * In-process billing sandbox tests (no HTTP server). Run:
 *   npm run test:billing:sandbox
 */
import { createHmac } from "crypto";

import { OrgPlan, PrismaClient, SubscriptionStatus } from "@prisma/client";

import { getDunningRetryDueAt, TRIAL_REMINDER_DAYS } from "../src/lib/billing/constants";
import { deriveOrgBillingAccess } from "../src/lib/billing/entitlements";
import { processPaystackWebhook } from "../src/lib/billing/processPaystackWebhook";
import { orgCan, getOrgBillingAccess } from "../src/lib/db/billing";

const prisma = new PrismaClient();

const FIXTURE_SLUG = "billing-sandbox-fixture";
const FIXTURE_CUSTOMER = "CUS_billing_sandbox_test";
const FIXTURE_EVENT_ID = 990001;

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function signPaystackBody(rawBody: string): string {
  const secret =
    process.env.PAYSTACK_WEBHOOK_SECRET?.trim() ??
    process.env.PAYSTACK_SECRET_KEY?.trim() ??
    "sk_test_billing_sandbox";
  return createHmac("sha512", secret).update(rawBody).digest("hex");
}

async function ensureFixtureOrg() {
  const org = await prisma.organization.upsert({
    where: { slug: FIXTURE_SLUG },
    create: {
      name: "Billing Sandbox Fixture",
      slug: FIXTURE_SLUG,
      plan: OrgPlan.FREE,
      activatedAt: new Date()
    },
    update: {}
  });

  await prisma.billingCustomer.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      paystackCustomerCode: FIXTURE_CUSTOMER,
      billingEmail: "billing-sandbox@eventflow.test"
    },
    update: {
      paystackCustomerCode: FIXTURE_CUSTOMER,
      billingEmail: "billing-sandbox@eventflow.test"
    }
  });

  return org;
}

async function testPreBillingEntitlements() {
  const org = await prisma.organization.findFirst({
    where: { subscription: null, plan: OrgPlan.FREE },
    select: { id: true }
  });
  if (!org) {
    console.log("  skip pre-billing entitlements — no FREE org without subscription");
    return;
  }

  const access = await getOrgBillingAccess(org.id);
  assert(access !== null, "getOrgBillingAccess should not throw for missing subscription");
  assert(access!.status === SubscriptionStatus.NONE, "missing subscription => NONE status");
  assert(access!.canLogin === true, "NONE status should allow login");

  const canBroadcast = await orgCan(org.id, "send_broadcast");
  assert(canBroadcast === false, "FREE org without subscription should not send_broadcast");

  const derived = deriveOrgBillingAccess({
    org: { id: org.id, plan: OrgPlan.FREE },
    subscription: null
  });
  assert(derived.status === SubscriptionStatus.NONE, "deriveOrgBillingAccess handles null subscription");
  console.log("  ✓ pre-billing entitlements (no subscription row, no PRO access)");
}

async function testChargeSuccessWebhookIdempotency(orgId: string) {
  const envelope = {
    event: "charge.success",
    data: {
      id: FIXTURE_EVENT_ID,
      reference: `sandbox-charge-${FIXTURE_EVENT_ID}`,
      currency: "GHS",
      customer: {
        customer_code: FIXTURE_CUSTOMER,
        email: "billing-sandbox@eventflow.test"
      },
      authorization: {
        authorization_code: "AUTH_sandbox_test"
      },
      plan_object: {
        plan_code: process.env.PAYSTACK_PRO_PLAN_CODE ?? "PLN_sandbox_pro"
      },
      metadata: { orgId }
    }
  };

  const first = await processPaystackWebhook(envelope);
  assert(first.duplicate === false, "first webhook should not be duplicate");
  assert(first.handled === true, "charge.success should be handled");
  assert(first.orgId === orgId, "orgId should resolve");

  const subscription = await prisma.subscription.findUnique({ where: { orgId } });
  assert(subscription?.authorizationCode === "AUTH_sandbox_test", "authorization should be stored");

  const second = await processPaystackWebhook(envelope);
  assert(second.duplicate === true, "duplicate event id should be detected");
  assert(second.handled === false, "duplicate should not re-handle");

  const eventCount = await prisma.paymentEvent.count({
    where: { paystackEventId: `charge.success:${FIXTURE_EVENT_ID}` }
  });
  assert(eventCount === 1, "only one PaymentEvent row for duplicate delivery");
  console.log("  ✓ charge.success webhook + idempotent PaymentEvent insert");
}

async function testUnresolvedOrgAlert() {
  const envelope = {
    event: "invoice.payment_failed",
    data: {
      id: FIXTURE_EVENT_ID + 1,
      reference: "sandbox-unresolved-invoice"
    }
  };

  const result = await processPaystackWebhook(envelope);
  assert(result.orgUnresolved === true, "unresolved actionable event should flag orgUnresolved");
  assert(result.handled === false, "unresolved event should not handle billing state");

  const row = await prisma.paymentEvent.findUnique({
    where: { paystackEventId: `invoice.payment_failed:${FIXTURE_EVENT_ID + 1}` }
  });
  assert(row?.processingError?.startsWith("org_unresolved:") === true, "processingError should be set");
  console.log("  ✓ unresolved org logged on PaymentEvent (not silently dropped)");
}

async function testDunningScheduleOffsets(orgId: string) {
  const pastDueSince = new Date("2026-01-01T12:00:00.000Z");
  const day1 = getDunningRetryDueAt(pastDueSince, 0)!;
  const day3 = getDunningRetryDueAt(pastDueSince, 1)!;
  const day5 = getDunningRetryDueAt(pastDueSince, 2)!;

  assert(day1.toISOString() === "2026-01-02T12:00:00.000Z", "retry 0 = day 1 after pastDueSince");
  assert(day3.toISOString() === "2026-01-04T12:00:00.000Z", "retry 1 = day 3 after pastDueSince");
  assert(day5.toISOString() === "2026-01-06T12:00:00.000Z", "retry 2 = day 5 after pastDueSince");
  assert(getDunningRetryDueAt(pastDueSince, 3) === null, "no retry after index 2");

  await prisma.subscription.upsert({
    where: { orgId },
    create: {
      orgId,
      status: SubscriptionStatus.PAST_DUE,
      pastDueSince,
      dunningAttempt: 0,
      nextDunningAt: day1,
      authorizationCode: "AUTH_sandbox_dunning",
      paystackPlanCode: "PLN_nonexistent_sandbox"
    },
    update: {
      status: SubscriptionStatus.PAST_DUE,
      pastDueSince,
      dunningAttempt: 0,
      nextDunningAt: day1,
      authorizationCode: "AUTH_sandbox_dunning",
      paystackPlanCode: "PLN_nonexistent_sandbox",
      suspendedAt: null
    }
  });

  const cronNow = new Date("2026-01-02T13:00:00.000Z");
  assert(cronNow.getTime() >= day1.getTime(), "fixture cron time should be on/after day-1 retry");

  // Simulate failed dunning charge (same DB updates as runBillingDunningCron on failure).
  const nextAttempt = 1;
  const nextAt = getDunningRetryDueAt(pastDueSince, nextAttempt)!;
  await prisma.subscription.update({
    where: { orgId },
    data: {
      dunningAttempt: nextAttempt,
      lastDunningAttemptAt: cronNow,
      nextDunningAt: nextAt
    }
  });

  const after = await prisma.subscription.findUnique({ where: { orgId } });
  assert(after?.dunningAttempt === 1, "failed retry should increment dunningAttempt");
  assert(
    after?.nextDunningAt?.toISOString() === day3.toISOString(),
    "next retry anchored to day 3 from pastDueSince, not cron tick count"
  );
  console.log("  ✓ dunning retry schedule anchored to pastDueSince (days 1/3/5)");
}

async function main() {
  console.log("Billing sandbox tests\n");

  console.log("1. Entitlements");
  await testPreBillingEntitlements();

  console.log("2. Webhook idempotency");
  const org = await ensureFixtureOrg();
  await testChargeSuccessWebhookIdempotency(org.id);

  console.log("3. Unresolved org");
  await testUnresolvedOrgAlert();

  console.log("4. Dunning schedule");
  await testDunningScheduleOffsets(org.id);

  console.log("\nTrial reminder day constants:", TRIAL_REMINDER_DAYS.join(", "));
  console.log("All billing sandbox checks passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
