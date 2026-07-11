import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runEmailCampaignSendCron } from "@/lib/email/sendEmailCampaign";
import { isModuleEnabled } from "@/lib/features/modules";

export const maxDuration = 300;

/**
 * Continues PREPARING broadcast campaigns (Resend contact sync batches).
 *
 * Example:
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://YOUR_HOST/api/cron/broadcast-send"
 *
 * Optional: ?campaignId=... to drain a single campaign.
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

  if (!isModuleEnabled("broadcast")) {
    return NextResponse.json({ ok: true, skipped: true, reason: "broadcast module disabled" });
  }

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId") ?? undefined;

  const { campaigns } = await runEmailCampaignSendCron({
    campaignId,
    maxBatches: 8
  });

  for (const row of campaigns) {
    revalidatePath("/broadcasts/campaigns");
    revalidatePath(`/broadcasts/campaigns/${row.campaignId}`);
  }

  return NextResponse.json({ ok: true, campaigns });
}
