import { NextResponse } from "next/server";

import { recordBillingCronOk } from "@/lib/billing/cronHeartbeat";
import { runBillingLifecycleCron } from "@/lib/billing/runBillingLifecycleCron";
import { runBillingTrialReminderCron } from "@/lib/billing/runBillingTrialReminderCron";
import { runEnterpriseCoverageReminderCron } from "@/lib/billing/runEnterpriseCoverageReminderCron";

export const maxDuration = 120;

/**
 * Trial expiry + PRO cancel-at-period-end + Enterprise overdue stamp +
 * trial / Enterprise coverage reminders.
 *
 * Example:
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://YOUR_HOST/api/cron/billing/lifecycle"
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const lifecycle = await runBillingLifecycleCron();
  const reminders = await runBillingTrialReminderCron();
  const enterpriseCoverageReminders = await runEnterpriseCoverageReminderCron();
  await recordBillingCronOk("lifecycle");
  return NextResponse.json({
    ok: true,
    ...lifecycle,
    reminders,
    enterpriseCoverageReminders
  });
}
