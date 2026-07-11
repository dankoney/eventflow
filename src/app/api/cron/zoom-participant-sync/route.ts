import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runZoomParticipantSyncCron } from "@/lib/zoom/cronZoomParticipantSync";

/**
 * Scheduled Zoom roster sync. Secure with `CRON_SECRET` (same as other cron routes).
 *
 * Example (Plesk / system crontab — run every 15 minutes):
 *   curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" "https://YOUR_HOST/api/cron/zoom-participant-sync"
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

  const { scanned, results } = await runZoomParticipantSyncCron(new Date(), { maxEvents: 40 });

  const okRows = results.filter((r) => r.ok);
  for (const r of okRows) {
    revalidatePath(`/events/${r.eventId}/guests`);
    revalidatePath(`/events/${r.eventId}/analytics`);
    revalidatePath(`/events/${r.eventId}`);
  }

  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    ok: true,
    scanned,
    succeeded: okRows.length,
    failed,
    results
  });
}
