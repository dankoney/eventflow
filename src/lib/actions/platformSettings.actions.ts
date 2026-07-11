"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  getPlatformBillingAlertSettings,
  normalizeEmailList
} from "@/lib/billing/platformSettings";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const PLATFORM_SETTINGS_ID = "default";

async function requirePlatformOwner(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in." };
  if (!session.user.isPlatformOwner) {
    return { ok: false, error: "Only platform owners can manage platform settings." };
  }
  return { ok: true, userId: session.user.id };
}

const updateSchema = z.object({
  supportEmail: z.string().trim().max(320).optional().nullable(),
  /** One email per line, or comma/semicolon separated. */
  billingAlertCcEmailsText: z.string().max(4000)
});

export async function getPlatformSettingsAction(): Promise<
  ActionResult<{
    supportEmail: string;
    billingAlertCcEmailsText: string;
  }>
> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const settings = await getPlatformBillingAlertSettings();
  return {
    success: true,
    data: {
      supportEmail: settings.supportEmail ?? "",
      billingAlertCcEmailsText: settings.billingAlertCcEmails.join("\n")
    }
  };
}

export async function updatePlatformBillingAlertSettingsAction(
  input: z.input<typeof updateSchema>
): Promise<ActionResult<{ supportEmail: string; billingAlertCcEmails: string[] }>> {
  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join("; ")
    };
  }

  const supportRaw = parsed.data.supportEmail?.trim() || "";
  const supportEmail = supportRaw.length ? supportRaw.toLowerCase() : null;
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    return { success: false, error: "Enter a valid support email." };
  }

  const billingAlertCcEmails = normalizeEmailList(parsed.data.billingAlertCcEmailsText);
  const invalidParts = parsed.data.billingAlertCcEmailsText
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(p));
  if (invalidParts.length) {
    return {
      success: false,
      error: `Invalid email(s): ${invalidParts.slice(0, 5).join(", ")}`
    };
  }

  await prisma.platformSettings.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    create: {
      id: PLATFORM_SETTINGS_ID,
      supportEmail,
      billingAlertCcEmails,
      updatedByUserId: guard.userId
    },
    update: {
      supportEmail,
      billingAlertCcEmails,
      updatedByUserId: guard.userId
    }
  });

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/settings");

  return {
    success: true,
    data: {
      supportEmail: supportEmail ?? "",
      billingAlertCcEmails
    }
  };
}
