import { prisma } from "@/lib/prisma";

const MNOTIFY_API = "https://api.mnotify.com/api";
const QUICK_CHUNK = 100;

/**
 * Value of `MNOTIFY_DEFAULT_SENDER_ID` after trim and non-alphanumeric strip (3–11 chars for mNotify).
 * Returns empty string if the variable is unset or invalid — there is no hardcoded sender fallback in code.
 */
export function getMnotifyDefaultSenderIdFromEnv(): string {
  const raw = (process.env.MNOTIFY_DEFAULT_SENDER_ID ?? "").trim().replace(/[^a-zA-Z0-9]/g, "");
  if (raw.length >= 3 && raw.length <= 11) return raw;
  if (raw.length > 11) return raw.slice(0, 11);
  return "";
}

/** Strip to digits for mNotify recipient list (no leading + in JSON). */
export function phoneToMnotifyRecipient(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}

type MnotifySuccessSummary = {
  _id?: string;
  total_sent?: number;
};

function parseMnotifyJson(text: string): {
  status?: string;
  message?: string;
  code?: string;
  summary?: MnotifySuccessSummary & Record<string, unknown>;
} {
  try {
    return JSON.parse(text) as {
      status?: string;
      message?: string;
      code?: string;
      summary?: MnotifySuccessSummary & Record<string, unknown>;
    };
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

function resolveSendSender(storedSenderId: string | null | undefined): string {
  const id = storedSenderId?.trim() ?? "";
  if (id.length >= 3 && id.length <= 11) return id.slice(0, 11);
  return getMnotifyDefaultSenderIdFromEnv();
}

/**
 * POST /sms/quick — bulk same message. Omits `sms_type` and `sms_otp` (OTP payloads charge differently).
 * Uses org API key or `MNOTIFY_API_KEY`; org sender ID or `MNOTIFY_DEFAULT_SENDER_ID` (env only, no code default).
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
  if (!org) {
    return { ok: false, error: "Organization not found." };
  }
  const apiKey = resolveApiKey(org.mnotifyApiKey);
  /** Allow server env key when the org has not saved its own key (common single-tenant setup). */
  const canUseEnvOnlyFallback =
    Boolean(process.env.MNOTIFY_API_KEY?.trim()) && !org.mnotifyApiKey?.trim();
  if (!org.mnotifyEnabled && !canUseEnvOnlyFallback) {
    return {
      ok: false,
      error:
        "mNotify SMS is not enabled for this organization. Turn it on under Settings → Integrations, or clear the organization’s mNotify API key field to use MNOTIFY_API_KEY from the server environment."
    };
  }
  if (!apiKey) {
    return { ok: false, error: "mNotify API key is not configured (org or MNOTIFY_API_KEY)." };
  }
  const sender = resolveSendSender(org.mnotifySenderId);
  if (!sender || sender.length < 3 || sender.length > 11) {
    return {
      ok: false,
      error:
        "mNotify sender ID must be 3–11 characters. Save one under Settings → Integrations or set MNOTIFY_DEFAULT_SENDER_ID in the server environment."
    };
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

/** Validate API key + sender against mNotify (POST /senderid/status). */
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
  if (summary) {
    const senderFromSummary =
      (typeof summary.sender_name === "string" && summary.sender_name) ||
      (typeof summary["sender name"] === "string" && (summary["sender name"] as string)) ||
      sender;
    const statusFromSummary =
      (typeof summary.status === "string" && summary.status) ||
      (typeof summary.Status === "string" && (summary.Status as string)) ||
      "Unknown";
    const purposeFromSummary = typeof summary.purpose === "string" ? summary.purpose : null;
    const base = `Sender ID "${senderFromSummary}" is ${statusFromSummary}.`;
    return {
      ok: true,
      detail: purposeFromSummary ? `${base} Purpose: ${purposeFromSummary}.` : base
    };
  }
  return { ok: true, detail: data.message ?? "Sender ID status looks good." };
}
