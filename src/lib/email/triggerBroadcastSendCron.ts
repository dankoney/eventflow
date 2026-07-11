import { resolvePublicAppBaseUrl } from "@/lib/url";

/**
 * Fire-and-forget kick to the broadcast-send cron worker (same host + CRON_SECRET).
 */
export async function triggerBroadcastSendCron(campaignId?: string): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  const base = resolvePublicAppBaseUrl();
  if (!secret || !base) return;

  const url = new URL("/api/cron/broadcast-send", base);
  if (campaignId) url.searchParams.set("campaignId", campaignId);

  try {
    await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store"
    });
  } catch {
    /* cron will retry on schedule */
  }
}
