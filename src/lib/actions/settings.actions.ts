"use server";

import { AttendeeTheme, Prisma, PublicPageTemplate, Role, ZoomSessionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { getMnotifyDefaultSenderIdFromEnv } from "@/lib/mnotify";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const profileSchema = z.object({
  name: z.string().max(120)
});

const optionalHttpsUrl = z
  .string()
  .max(2048)
  .optional()
  .nullable()
  .transform((s) => {
    const t = typeof s === "string" ? s.trim() : "";
    return t.length ? t : null;
  })
  .superRefine((val, ctx) => {
    if (!val) return;
    if (val.startsWith("/uploads/")) {
      if (val.includes("..") || val.length > 500) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid uploaded asset path" });
      }
      return;
    }
    try {
      const u = new URL(val);
      if (u.protocol !== "https:") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "URL must use https://" });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid https URL or upload from media" });
    }
  });

const optionalHexColor = z
  .string()
  .max(32)
  .optional()
  .nullable()
  .transform((s) => {
    const t = typeof s === "string" ? s.trim() : "";
    return t.length ? t : null;
  })
  .superRefine((val, ctx) => {
    if (!val) return;
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use hex like #0f172a or leave empty" });
    }
  });

const orgWorkspaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(120)
});

const orgNewEventDefaultsSchema = z.object({
  defaultEventVirtualCapacity: z.coerce.number().int().min(1).max(50000),
  defaultZoomSessionKind: z.nativeEnum(ZoomSessionKind)
});

const orgEventBrandingDefaultsSchema = z.object({
  defaultEventBannerImageUrl: optionalHttpsUrl,
  defaultEventBrandLogoUrl: optionalHttpsUrl,
  defaultEventAttendeeTheme: z.nativeEnum(AttendeeTheme),
  defaultEventPublicPageTemplate: z.nativeEnum(PublicPageTemplate),
  defaultEventBrandPrimaryColor: optionalHexColor,
  defaultEventBrandSecondaryColor: optionalHexColor,
  defaultEventBrandTertiaryColor: optionalHexColor
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
  revalidatePath("/events/new");
  revalidatePath("/events/new/classic");
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

export async function updateOrganizationWorkspace(
  input: z.input<typeof orgWorkspaceSchema>
): Promise<ActionResult<{ name: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN) {
    return { success: false, error: "Only organization admins can update organization settings." };
  }

  const parsed = orgWorkspaceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const name = parsed.data.name.trim();

  try {
    await prisma.organization.update({
      where: { id: session.user.orgId },
      data: { name }
    });
    revalidateSettings();
    return { success: true, data: { name } };
  } catch {
    return { success: false, error: "Could not update organization" };
  }
}

export async function updateOrganizationNewEventDefaults(
  input: z.input<typeof orgNewEventDefaultsSchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN) {
    return { success: false, error: "Only organization admins can update new event defaults." };
  }

  const parsed = orgNewEventDefaultsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  try {
    await prisma.organization.update({
      where: { id: session.user.orgId },
      data: {
        defaultEventVirtualCapacity: parsed.data.defaultEventVirtualCapacity,
        defaultZoomSessionKind: parsed.data.defaultZoomSessionKind
      }
    });
    revalidateSettings();
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save new event defaults" };
  }
}

export async function updateOrganizationEventBrandingDefaults(
  input: z.input<typeof orgEventBrandingDefaultsSchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN) {
    return { success: false, error: "Only organization admins can update branding defaults." };
  }

  const parsed = orgEventBrandingDefaultsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  try {
    await prisma.organization.update({
      where: { id: session.user.orgId },
      data: {
        defaultEventBannerImageUrl: parsed.data.defaultEventBannerImageUrl ?? null,
        defaultEventBrandLogoUrl: parsed.data.defaultEventBrandLogoUrl ?? null,
        defaultEventAttendeeTheme: parsed.data.defaultEventAttendeeTheme,
        defaultEventPublicPageTemplate: parsed.data.defaultEventPublicPageTemplate,
        defaultEventBrandPrimaryColor: parsed.data.defaultEventBrandPrimaryColor,
        defaultEventBrandSecondaryColor: parsed.data.defaultEventBrandSecondaryColor,
        defaultEventBrandTertiaryColor: parsed.data.defaultEventBrandTertiaryColor
      }
    });
    revalidateSettings();
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save branding defaults" };
  }
}

const zoomOauthOnlySchema = z.object({
  zoomClientId: z.string().max(500).optional().nullable(),
  zoomClientSecret: z.string().max(500).optional().nullable(),
  zoomAccountId: z.string().max(500).optional().nullable()
});

const zoomMeetingSdkOnlySchema = z.object({
  zoomMeetingSdkKey: z.string().max(500).optional().nullable(),
  zoomMeetingSdkSecret: z.string().max(500).optional().nullable()
});

const googleMapsOnlySchema = z.object({
  googleMapsApiKey: z.string().max(500).optional().nullable()
});

const whatsappOnlySchema = z.object({
  whatsappEnabled: z.preprocess((val) => val === true || val === "on", z.boolean()),
  whatsappAccessToken: z.string().max(8000).optional().nullable(),
  whatsappPhoneNumberId: z.string().max(200).optional().nullable()
});

const resendOnlySchema = z.object({
  resendApiKey: z.string().max(500).optional().nullable()
});

export async function updateOrganizationGoogleMapsFields(
  input: z.input<typeof googleMapsOnlySchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = googleMapsOnlySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const k = parsed.data.googleMapsApiKey?.trim() ?? "";
  try {
    await prisma.organization.update({
      where: { id: session.user.orgId },
      data: { googleMapsApiKey: k.length > 0 ? k : null }
    });
    revalidateSettings();
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save Google Maps settings" };
  }
}

export async function updateOrganizationZoomOauthFields(
  input: z.input<typeof zoomOauthOnlySchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = zoomOauthOnlySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const d = parsed.data;
  const oauthSecretTrim = d.zoomClientSecret?.trim() ?? "";
  try {
    await prisma.organization.update({
      where: { id: session.user.orgId },
      data: {
        zoomClientId: d.zoomClientId?.trim() || null,
        zoomAccountId: d.zoomAccountId?.trim() || null,
        zoomClientSecret: oauthSecretTrim.length > 0 ? oauthSecretTrim : null
      }
    });
    revalidateSettings();
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save Zoom OAuth settings" };
  }
}

export async function updateOrganizationZoomMeetingSdkFields(
  input: z.input<typeof zoomMeetingSdkOnlySchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = zoomMeetingSdkOnlySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const d = parsed.data;
  const meetingSdkSecretTrim = d.zoomMeetingSdkSecret?.trim() ?? "";
  try {
    await prisma.organization.update({
      where: { id: session.user.orgId },
      data: {
        zoomMeetingSdkKey: d.zoomMeetingSdkKey?.trim() || null,
        zoomMeetingSdkSecret: meetingSdkSecretTrim.length > 0 ? meetingSdkSecretTrim : null
      }
    });
    revalidateSettings();
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save Zoom Meeting SDK settings" };
  }
}

/** @deprecated Use {@link updateOrganizationZoomOauthFields} or {@link updateOrganizationZoomMeetingSdkFields}. */
export async function updateOrganizationZoomFields(
  input: z.input<typeof zoomOauthOnlySchema & typeof zoomMeetingSdkOnlySchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }
  const oauth = zoomOauthOnlySchema.safeParse(input);
  const sdk = zoomMeetingSdkOnlySchema.safeParse(input);
  if (!oauth.success && !sdk.success) {
    return { success: false, error: "Invalid Zoom settings" };
  }
  if (oauth.success) {
    const r = await updateOrganizationZoomOauthFields(oauth.data);
    if (!r.success) return r;
  }
  if (sdk.success) {
    return updateOrganizationZoomMeetingSdkFields(sdk.data);
  }
  return { success: true, data: { updated: true } };
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
  mnotifySenderId: z.string().max(11).optional().nullable(),
  /** When true, remove the org-stored API key so `MNOTIFY_API_KEY` from the server is used. */
  clearMnotifyApiKey: z.preprocess((val) => val === true || val === "on", z.boolean()).optional()
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
  const clearKey = d.clearMnotifyApiKey === true;
  try {
    const keyTrim = d.mnotifyApiKey?.trim() ?? "";
    const existingKey = await prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: { mnotifyApiKey: true }
    });
    const storedKeyLen = (existingKey?.mnotifyApiKey?.trim() ?? "").length;
    const envKeyLen = (process.env.MNOTIFY_API_KEY?.trim() ?? "").length;
    if (clearKey && d.mnotifyEnabled && envKeyLen === 0) {
      return {
        success: false,
        error: "Cannot clear the organization API key while mNotify is on: set MNOTIFY_API_KEY on the server first."
      };
    }
    const orgKeyAfterSave = clearKey ? 0 : keyTrim.length > 0 ? keyTrim.length : storedKeyLen;
    const hasApiKeyAfterSave = orgKeyAfterSave > 0 || envKeyLen > 0;
    if (d.mnotifyEnabled && !hasApiKeyAfterSave) {
      return {
        success: false,
        error: "Save an organization API key or set MNOTIFY_API_KEY on the server before enabling mNotify."
      };
    }
    const fromEnvSender = getMnotifyDefaultSenderIdFromEnv();
    const effectiveSender =
      senderTrim && senderTrim.length >= 3 ? senderTrim : fromEnvSender;
    if (d.mnotifyEnabled && (!effectiveSender || effectiveSender.length < 3)) {
      return {
        success: false,
        error:
          "Save a sender ID (3–11 characters) or set MNOTIFY_DEFAULT_SENDER_ID on the server before enabling mNotify."
      };
    }

    const data: Prisma.OrganizationUpdateInput = {
      mnotifyEnabled: d.mnotifyEnabled,
      mnotifySenderId: senderTrim
    };
    if (keyTrim.length > 0) {
      data.mnotifyApiKey = keyTrim;
    } else if (clearKey) {
      data.mnotifyApiKey = null;
    }

    await prisma.organization.update({
      where: { id: session.user.orgId },
      data
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

const orgMarketingSchema = z.object({
  marketingEmailEnabled: z.preprocess((val) => val === true || val === "on", z.boolean()),
  marketingConsentCopy: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((s) => {
      const t = typeof s === "string" ? s.trim() : "";
      return t.length ? t : null;
    }),
  marketingPrivacyPolicyUrl: optionalHttpsUrl
});

export async function updateOrganizationMarketingSettings(
  input: z.input<typeof orgMarketingSchema>
): Promise<ActionResult<{ saved: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = orgMarketingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) };
  }

  try {
    await prisma.organization.update({
      where: { id: session.user.orgId },
      data: {
        marketingEmailEnabled: parsed.data.marketingEmailEnabled,
        marketingConsentCopy: parsed.data.marketingConsentCopy,
        marketingPrivacyPolicyUrl: parsed.data.marketingPrivacyPolicyUrl
      }
    });
    revalidateSettings();
    return { success: true, data: { saved: true } };
  } catch {
    return { success: false, error: "Could not save marketing settings" };
  }
}
