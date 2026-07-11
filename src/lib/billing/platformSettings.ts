import { prisma } from "@/lib/prisma";

const PLATFORM_SETTINGS_ID = "default";

export type PlatformBillingAlertSettings = {
  supportEmail: string | null;
  billingAlertCcEmails: string[];
};

export async function getPlatformBillingAlertSettings(): Promise<PlatformBillingAlertSettings> {
  const row = await prisma.platformSettings.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    create: { id: PLATFORM_SETTINGS_ID, billingAlertCcEmails: [] },
    update: {},
    select: { supportEmail: true, billingAlertCcEmails: true }
  });

  return {
    supportEmail: row.supportEmail?.trim() || null,
    billingAlertCcEmails: normalizeEmailList(row.billingAlertCcEmails)
  };
}

/** BCC list for due alerts, excluding the primary `to` recipient. */
export async function getBillingAlertCcEmails(excludeTo?: string | null): Promise<string[]> {
  const { billingAlertCcEmails } = await getPlatformBillingAlertSettings();
  const exclude = excludeTo?.trim().toLowerCase() ?? "";
  return billingAlertCcEmails.filter((email) => email.toLowerCase() !== exclude);
}

export function normalizeEmailList(raw: string[] | string | null | undefined): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\n,;]+/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const email = part.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}
