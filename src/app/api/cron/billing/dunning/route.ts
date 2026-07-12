import { NextResponse } from "next/server";

import { recordBillingCronOk } from "@/lib/billing/cronHeartbeat";
import { runBillingDunningCron } from "@/lib/billing/runBillingDunningCron";

export const maxDuration = 300;

/**
 * Re-attempt failed subscription charges against stored Paystack authorizations.
 *
 * Example:
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://YOUR_HOST/api/cron/billing/dunning"
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

  const result = await runBillingDunningCron();
  await recordBillingCronOk("dunning");
  return NextResponse.json({ ok: true, ...result });
}
