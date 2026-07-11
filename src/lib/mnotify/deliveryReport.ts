import { prisma } from "@/lib/prisma";
import { phoneToMnotifyRecipient } from "@/lib/mnotify";

const MNOTIFY_API = "https://api.mnotify.com/api";

export type MnotifyReportEntry = {
  _id?: number | string;
  recipient?: string;
  message?: string;
  sender?: string;
  status?: string;
  date_sent?: string;
  campaign_id?: string;
  retries?: number;
};

function parseMnotifyJson(text: string): {
  status?: string;
  message?: string;
  report?: MnotifyReportEntry | MnotifyReportEntry[];
} {
  try {
    return JSON.parse(text) as {
      status?: string;
      message?: string;
      report?: MnotifyReportEntry | MnotifyReportEntry[];
    };
  } catch {
    return {};
  }
}

export async function getOrgMnotifyApiKey(orgId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { mnotifyApiKey: true }
  });
  const fromOrg = org?.mnotifyApiKey?.trim() ?? "";
  if (fromOrg.length > 0) return fromOrg;
  const fromEnv = process.env.MNOTIFY_API_KEY?.trim() ?? "";
  return fromEnv.length > 0 ? fromEnv : null;
}

/** GET /campaign/<id>[/<status>] — per-recipient rows for a campaign. */
export async function fetchMnotifyCampaignReport(
  apiKey: string,
  campaignId: string,
  status?: string | null
): Promise<{ ok: boolean; report: MnotifyReportEntry[]; error?: string }> {
  const key = apiKey.trim();
  const id = campaignId.trim();
  if (!key || !id) return { ok: false, report: [], error: "Missing API key or campaign id." };

  const statusPath = status?.trim() ? `/${encodeURIComponent(status.trim())}` : "";
  const url = `${MNOTIFY_API}/campaign/${encodeURIComponent(id)}${statusPath}?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const text = await res.text();
  const data = parseMnotifyJson(text);

  if (!res.ok || data.status !== "success") {
    return {
      ok: false,
      report: [],
      error: (data.message ?? text).slice(0, 400) || `mNotify HTTP ${res.status}`
    };
  }

  const raw = data.report;
  const report = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return { ok: true, report };
}

/** GET /status/<id> — single message row by mNotify _id from a campaign report. */
export async function fetchMnotifyMessageStatus(
  apiKey: string,
  messageId: string | number
): Promise<{ ok: boolean; report: MnotifyReportEntry | null; error?: string }> {
  const key = apiKey.trim();
  const id = String(messageId).trim();
  if (!key || !id) return { ok: false, report: null, error: "Missing API key or message id." };

  const url = `${MNOTIFY_API}/status/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const text = await res.text();
  const data = parseMnotifyJson(text);

  if (!res.ok || data.status !== "success") {
    return {
      ok: false,
      report: null,
      error: (data.message ?? text).slice(0, 400) || `mNotify HTTP ${res.status}`
    };
  }

  const raw = data.report;
  const report = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
  return { ok: true, report };
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Match stored phone to mNotify recipient (handles +233 vs 233). */
export function mnotifyRecipientsMatch(storedPhone: string, reportRecipient: string): boolean {
  const a = normalizePhoneDigits(storedPhone);
  const b = normalizePhoneDigits(reportRecipient);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.endsWith(b) || b.endsWith(a)) return true;
  return a.slice(-9) === b.slice(-9);
}

export function findMnotifyReportForRecipient(
  report: MnotifyReportEntry[],
  phone: string | null | undefined
): MnotifyReportEntry | null {
  const digits = phoneToMnotifyRecipient(phone);
  if (!digits) return null;
  return (
    report.find((row) => row.recipient && mnotifyRecipientsMatch(digits, row.recipient)) ?? null
  );
}

export function mapMnotifyDeliveryStatus(
  status: string | null | undefined
): "SENT" | "FAILED" {
  const s = (status ?? "").trim().toUpperCase();
  if (s === "DELIVERED" || s === "SUBMITTED") return "SENT";
  if (s === "FAILED" || s === "REJECTED" || s === "UNDELIVERED") return "FAILED";
  return "SENT";
}

export function mnotifyStatusDetail(entry: MnotifyReportEntry): string {
  const status = (entry.status ?? "unknown").toUpperCase();
  if (status === "DELIVERED") return "sms (delivered)";
  if (status === "SUBMITTED") return "sms (submitted to carrier)";
  if (status === "FAILED" || status === "REJECTED" || status === "UNDELIVERED") {
    return `mNotify ${status}${entry.retries ? ` · ${entry.retries} retries` : ""}`;
  }
  return `mNotify ${status}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll campaign report until a recipient row appears (mNotify can lag a few seconds).
 */
export async function resolveMnotifyRecipientDelivery(
  apiKey: string,
  campaignId: string,
  phone: string | null | undefined,
  fallbackMessage: string
): Promise<{
  status: "SENT" | "FAILED";
  detail: string;
  message: string;
  providerRef: string;
  mnotifyStatus: string | null;
}> {
  const delays = [0, 1500, 4000];
  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    const fetched = await fetchMnotifyCampaignReport(apiKey, campaignId);
    if (!fetched.ok) continue;
    const entry = findMnotifyReportForRecipient(fetched.report, phone);
    if (!entry) continue;

    const providerRef =
      entry._id != null ? String(entry._id) : entry.campaign_id ?? campaignId;
    return {
      status: mapMnotifyDeliveryStatus(entry.status),
      detail: mnotifyStatusDetail(entry),
      message: entry.message?.trim() || fallbackMessage,
      providerRef,
      mnotifyStatus: entry.status ?? null
    };
  }

  return {
    status: "SENT",
    detail: "sms (submitted — delivery report pending)",
    message: fallbackMessage,
    providerRef: campaignId,
    mnotifyStatus: null
  };
}
