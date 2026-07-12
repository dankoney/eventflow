import { NextResponse } from "next/server";

import { checkBillingCronHealthAndAlert } from "@/lib/billing/cronHeartbeat";
import { prisma } from "@/lib/prisma";
import { runDueRemindersForOrg } from "@/lib/reminders/dispatch";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({ select: { id: true } });
  let scanned = 0;
  for (const o of orgs) {
    const r = await runDueRemindersForOrg(o.id, new Date());
    scanned += r.eventsScanned;
  }

  /** Watchdog: alert if billing lifecycle/dunning haven't run in >25h. */
  let billingCronHealth: Awaited<ReturnType<typeof checkBillingCronHealthAndAlert>> | null =
    null;
  try {
    billingCronHealth = await checkBillingCronHealthAndAlert();
  } catch (error) {
    console.error("[cron/reminders] billing cron health check failed", error);
  }

  return NextResponse.json({
    ok: true,
    orgs: orgs.length,
    eventsScanned: scanned,
    billingCronHealth
  });
}
