"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const profileSchema = z.object({
  name: z.string().max(120)
});

const orgSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  logo: z.string().max(2000).optional()
});

const integrationsSchema = z.object({
  zoomClientId: z.string().max(500).optional().nullable(),
  zoomClientSecret: z.string().max(500).optional().nullable(),
  zoomAccountId: z.string().max(500).optional().nullable(),
  whatsappEnabled: z.preprocess((val) => val === true || val === "on", z.boolean()),
  whatsappAccessToken: z.string().max(8000).optional().nullable(),
  whatsappPhoneNumberId: z.string().max(200).optional().nullable(),
  resendApiKey: z.string().max(500).optional().nullable()
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

function revalidateSettings() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function updateMyProfile(
  input: z.input<typeof profileSchema>
): Promise<ActionResult<{ name: string | null }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const trimmed = parsed.data.name.trim();
  const name = trimmed.length > 0 ? trimmed : null;

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name }
    });
    revalidateSettings();
    return { success: true, data: { name } };
  } catch {
    return { success: false, error: "Could not update profile" };
  }
}

export async function updateOrganizationName(
  input: z.input<typeof orgSchema>
): Promise<ActionResult<{ name: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN) {
    return { success: false, error: "Only organization admins can update the company name." };
  }

  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const name = parsed.data.name.trim();
  const logoRaw = parsed.data.logo?.trim();
  let logo: string | null | undefined;
  if (logoRaw !== undefined) {
    if (!logoRaw) {
      logo = null;
    } else if (!/^https?:\/\//i.test(logoRaw)) {
      return { success: false, error: "Logo must be a valid http(s) URL." };
    } else {
      logo = logoRaw;
    }
  }

  try {
    await prisma.organization.update({
      where: { id: session.user.orgId },
      data: {
        name,
        ...(logo !== undefined ? { logo } : {})
      }
    });
    revalidateSettings();
    return { success: true, data: { name } };
  } catch {
    return { success: false, error: "Could not update organization" };
  }
}

const zoomOnlySchema = z.object({
  zoomClientId: z.string().max(500).optional().nullable(),
  zoomClientSecret: z.string().max(500).optional().nullable(),
  zoomAccountId: z.string().max(500).optional().nullable()
});

const whatsappOnlySchema = z.object({
  whatsappEnabled: z.preprocess((val) => val === true || val === "on", z.boolean()),
  whatsappAccessToken: z.string().max(8000).optional().nullable(),
  whatsappPhoneNumberId: z.string().max(200).optional().nullable()
});

const resendOnlySchema = z.object({
  resendApiKey: z.string().max(500).optional().nullable()
});

export async function updateOrganizationZoomFields(
  input: z.input<typeof zoomOnlySchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = zoomOnlySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const d = parsed.data;
  const secretTrim = d.zoomClientSecret?.trim() ?? "";
  try {
    const data: {
      zoomClientId: string | null;
      zoomAccountId: string | null;
      zoomClientSecret?: string;
    } = {
      zoomClientId: d.zoomClientId?.trim() || null,
      zoomAccountId: d.zoomAccountId?.trim() || null
    };
    if (secretTrim.length > 0) data.zoomClientSecret = secretTrim;
    await prisma.organization.update({ where: { id: session.user.orgId }, data });
    revalidateSettings();
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save Zoom settings" };
  }
}

export async function updateOrganizationWhatsappFields(
  input: z.input<typeof whatsappOnlySchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = whatsappOnlySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const d = parsed.data;
  try {
    const data: {
      whatsappEnabled: boolean;
      whatsappPhoneNumberId: string | null;
      whatsappAccessToken?: string | null;
    } = {
      whatsappEnabled: d.whatsappEnabled,
      whatsappPhoneNumberId: d.whatsappPhoneNumberId?.trim() || null
    };
    if (d.whatsappAccessToken !== undefined) {
      const tok = d.whatsappAccessToken?.trim() ?? "";
      if (tok.length > 0) {
        data.whatsappAccessToken = tok;
      }
    }
    await prisma.organization.update({ where: { id: session.user.orgId }, data });
    revalidateSettings();
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save WhatsApp settings" };
  }
}

const mnotifyOnlySchema = z.object({
  mnotifyEnabled: z.preprocess((val) => val === true || val === "on", z.boolean()),
  mnotifyApiKey: z.string().max(500).optional().nullable(),
  mnotifySenderId: z.string().max(11).optional().nullable()
});

export async function updateOrganizationMnotifyFields(
  input: z.input<typeof mnotifyOnlySchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = mnotifyOnlySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const d = parsed.data;
  const senderTrim = d.mnotifySenderId?.trim().slice(0, 11) || null;
  if (d.mnotifyEnabled && !senderTrim) {
    return { success: false, error: "Sender ID is required when mNotify is enabled." };
  }
  try {
    const keyTrim = d.mnotifyApiKey?.trim() ?? "";
    const existingKey = await prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: { mnotifyApiKey: true }
    });
    const storedKeyLen = (existingKey?.mnotifyApiKey?.trim() ?? "").length;
    const envKeyLen = (process.env.MNOTIFY_API_KEY?.trim() ?? "").length;
    if (d.mnotifyEnabled && keyTrim.length === 0 && storedKeyLen === 0 && envKeyLen === 0) {
      return {
        success: false,
        error: "Save an organization API key or set MNOTIFY_API_KEY on the server before enabling mNotify."
      };
    }
    await prisma.organization.update({
      where: { id: session.user.orgId },
      data: {
        mnotifyEnabled: d.mnotifyEnabled,
        mnotifySenderId: senderTrim,
        ...(keyTrim.length > 0 ? { mnotifyApiKey: keyTrim } : {})
      }
    });
    revalidateSettings();
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save mNotify settings" };
  }
}

export async function updateOrganizationResendFields(
  input: z.input<typeof resendOnlySchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = resendOnlySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const k = parsed.data.resendApiKey?.trim() ?? "";
  try {
    if (parsed.data.resendApiKey === undefined) {
      return { success: true, data: { updated: true } };
    }
    await prisma.organization.update({
      where: { id: session.user.orgId },
      data: { resendApiKey: k.length > 0 ? k : null }
    });
    revalidateSettings();
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save Resend settings" };
  }
}

export async function updateOrganizationIntegrations(
  input: z.input<typeof integrationsSchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN) {
    return { success: false, error: "Only admins can update integrations." };
  }

  const parsed = integrationsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const d = parsed.data;
  const zoomClientId = d.zoomClientId?.trim() || null;
  const zoomAccountId = d.zoomAccountId?.trim() || null;
  const secretTrim = d.zoomClientSecret?.trim() ?? "";
  const waTokenTrim = d.whatsappAccessToken?.trim() ?? "";
  const waPhoneTrim = d.whatsappPhoneNumberId?.trim() || null;
  const resendTrim = d.resendApiKey?.trim() ?? "";

  try {
    const data: {
      zoomClientId: string | null;
      zoomAccountId: string | null;
      whatsappEnabled: boolean;
      zoomClientSecret?: string;
      whatsappAccessToken?: string | null;
      whatsappPhoneNumberId?: string | null;
      resendApiKey?: string | null;
    } = {
      zoomClientId,
      zoomAccountId,
      whatsappEnabled: d.whatsappEnabled,
      whatsappPhoneNumberId: waPhoneTrim
    };

    if (secretTrim.length > 0) {
      data.zoomClientSecret = secretTrim;
    }
    if (d.whatsappAccessToken !== undefined) {
      data.whatsappAccessToken = waTokenTrim.length > 0 ? waTokenTrim : null;
    }
    if (d.resendApiKey !== undefined) {
      data.resendApiKey = resendTrim.length > 0 ? resendTrim : null;
    }

    await prisma.organization.update({
      where: { id: session.user.orgId },
      data
    });
    revalidateSettings();
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save integrations" };
  }
}
