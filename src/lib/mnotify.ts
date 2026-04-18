import { prisma } from "@/lib/prisma";

const MNOTIFY_API = "https://api.mnotify.com/api";
const QUICK_CHUNK = 100;

/** Strip to digits for mNotify recipient list (no leading + in JSON). */
export function phoneToMnotifyRecipient(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}

type MnotifySuccessSummary = {
  _id?: string;
  total_sent?: number;
};

function parseMnotifyJson(text: string): { status?: string; message?: string; summary?: MnotifySuccessSummary } {
  try {
    return JSON.parse(text) as { status?: string; message?: string; summary?: MnotifySuccessSummary };
  } catch {
    return {};
  }
}

function resolveApiKey(stored: string | null | undefined): string | null {
  const fromOrg = stored?.trim() ?? "";
  if (fromOrg.length > 0) return fromOrg;
  const fromEnv = process.env.MNOTIFY_API_KEY?.trim() ?? "";
  return fromEnv.length > 0 ? fromEnv : null;
}

/**
 * POST /sms/quick — bulk same message. Omits `sms_type` and `sms_otp` (OTP payloads charge differently).
 */
export async function sendOrgMnotifyQuickSms(
  orgId: string,
  recipients: string[],
  message: string
): Promise<{ ok: boolean; error?: string; campaignId?: string; totalSent?: number }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      mnotifyEnabled: true,
      mnotifyApiKey: true,
      mnotifySenderId: true
    }
  });
  if (!org?.mnotifyEnabled) {
    return { ok: false, error: "mNotify is not enabled for this organization." };
  }
  const apiKey = resolveApiKey(org.mnotifyApiKey);
  const sender = org.mnotifySenderId?.trim() ?? "";
  if (!apiKey) {
    return { ok: false, error: "mNotify API key is not configured (org or MNOTIFY_API_KEY)." };
  }
  if (!sender || sender.length > 11) {
    return { ok: false, error: "mNotify sender ID must be 1–11 characters." };
  }

  const bodyText = message.trim().slice(0, 3200);
  if (!bodyText) {
    return { ok: false, error: "Message is empty." };
  }

  const unique = [...new Set(recipients.map((r) => r.replace(/\D/g, "")).filter((r) => r.length >= 10))];
  if (unique.length === 0) {
    return { ok: false, error: "No valid phone numbers." };
  }

  let lastCampaignId: string | undefined;
  let totalSent = 0;

  for (let i = 0; i < unique.length; i += QUICK_CHUNK) {
    const chunk = unique.slice(i, i + QUICK_CHUNK);
    const url = `${MNOTIFY_API}/sms/quick?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: chunk,
        sender: sender.slice(0, 11),
        message: bodyText,
        is_schedule: false,
        schedule_date: ""
      })
    });

    const text = await res.text();
    const data = parseMnotifyJson(text);
    if (!res.ok || data.status !== "success") {
      return {
        ok: false,
        error: (data.message ?? text).slice(0, 400) || `mNotify HTTP ${res.status}`
      };
    }
    const id = data.summary?._id;
    if (id) lastCampaignId = id;
    totalSent += data.summary?.total_sent ?? chunk.length;
  }

  return { ok: true, campaignId: lastCampaignId, totalSent };
}

/** Validate API key + sender against mNotify sender ID status. */
export async function checkMnotifySenderStatus(
  apiKey: string,
  senderName: string
): Promise<{ ok: boolean; detail: string }> {
  const key = apiKey.trim();
  const sender = senderName.trim().slice(0, 11);
  if (!key) return { ok: false, detail: "API key is empty." };
  if (!sender) return { ok: false, detail: "Sender ID is empty." };

  const url = `${MNOTIFY_API}/senderid/status?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender_name: sender })
  });
  const text = await res.text();
  const data = parseMnotifyJson(text);
  if (!res.ok) {
    return { ok: false, detail: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
  if (data.status !== "success") {
    return { ok: false, detail: (data.message ?? text).slice(0, 280) };
  }
  const summary = data.summary as Record<string, unknown> | undefined;
  const bits = summary ? JSON.stringify(summary).slice(0, 240) : data.message ?? "OK";
  return { ok: true, detail: bits };
}
