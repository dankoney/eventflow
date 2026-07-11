"use server";

import { EmailCampaignStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  assertCanCreateBroadcastCampaign,
  assertCanSendBroadcastRecipients,
  planIncludesModule
} from "@/lib/billing/planLimits";
import {
  campaignIsEditable,
  createEmailCampaignRow,
  getCampaignRecipientStatusCounts,
  getEmailCampaignForOrg,
  listEmailCampaignsForOrg,
  updateEmailCampaignRow
} from "@/lib/db/emailCampaign";
import { resolveSegment } from "@/lib/db/resolveSegment";
import { getEmailTemplateForOrg } from "@/lib/db/emailTemplates";
import {
  substituteBroadcastMergeTagsForPreview,
  validateBroadcastHtmlForSend
} from "@/lib/email/compileEmailTemplate";
import { resolveOrgEmailBranding } from "@/lib/email/orgBranding";
import { emailSegmentDefinitionSchema } from "@/lib/email/segmentDefinition";
import {
  executeEmailCampaignSend,
  formatResendBroadcastError
} from "@/lib/email/sendEmailCampaign";
import { triggerBroadcastSendCron } from "@/lib/email/triggerBroadcastSendCron";
import { sendTransactionalEmail } from "@/lib/email";
import { isModuleEnabled, moduleDisabledMessage } from "@/lib/features/modules";
import { getOrgPlanForLimits, requireBillingCapability } from "@/lib/db/billing";
import { prisma } from "@/lib/prisma";
import { canBlastGuests } from "@/lib/rbac/capabilities";
import type { ActionResult } from "@/types";

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

function canManageBroadcast(role: Role) {
  return canBlastGuests(role) && (role === Role.ADMIN || role === Role.MARKETING);
}

async function requireBroadcastSession() {
  if (!isModuleEnabled("broadcast")) {
    return { success: false as const, error: moduleDisabledMessage("broadcast") };
  }

  const session = await auth();
  if (!session?.user?.orgId || !canManageBroadcast(session.user.role)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const orgPlan = await getOrgPlanForLimits(session.user.orgId);
  if (!orgPlan) return { success: false as const, error: "Workspace not found." };
  if (!planIncludesModule(orgPlan.plan, "broadcast")) {
    return {
      success: false as const,
      error:
        "Email broadcasts are not included on your current plan. Upgrade in Settings → Billing to unlock campaigns."
    };
  }

  return { success: true as const, session, orgPlan };
}

const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required.").max(120),
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  templateId: z.string().min(1),
  segmentDefinition: emailSegmentDefinitionSchema
});

const updateCampaignSchema = createCampaignSchema.partial().extend({
  id: z.string().min(1)
});

const sendCampaignSchema = z.object({
  campaignId: z.string().min(1),
  /** ISO 8601 datetime-local value or natural language for Resend. Omit for send now. */
  scheduledAt: z.string().trim().optional().nullable(),
  /** Must be true to execute live Resend broadcast APIs. */
  confirmLiveSend: z.boolean().optional()
});

export type CampaignPreviewData = {
  compiledHtml: string;
  recipientCount: number;
  matchedGuestCount: number;
  excluded: Awaited<ReturnType<typeof resolveSegment>>["excluded"];
  sendValidation: ReturnType<typeof validateBroadcastHtmlForSend>;
};

export async function listEmailCampaignsAction(): Promise<
  ActionResult<{ campaigns: Awaited<ReturnType<typeof listEmailCampaignsForOrg>> }>
> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const campaigns = await listEmailCampaignsForOrg(session.user.orgId);
  return { success: true, data: { campaigns } };
}

export async function getEmailCampaignAction(
  campaignId: string
): Promise<ActionResult<{ campaign: NonNullable<Awaited<ReturnType<typeof getEmailCampaignForOrg>>> }>> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const campaign = await getEmailCampaignForOrg(campaignId, session.user.orgId);
  if (!campaign) return { success: false, error: "Campaign not found." };

  return { success: true, data: { campaign } };
}

export async function createCampaignAction(
  input: z.input<typeof createCampaignSchema>
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const billing = await requireBillingCapability(session.user.orgId, "send_broadcast");
  if (!billing.ok) return { success: false, error: billing.error };

  const campaignLimit = await assertCanCreateBroadcastCampaign(gate.orgPlan);
  if (!campaignLimit.ok) return { success: false, error: campaignLimit.error };

  const parsed = createCampaignSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  if (parsed.data.segmentDefinition.orgId !== session.user.orgId) {
    return { success: false, error: "Invalid organization." };
  }

  const template = await getEmailTemplateForOrg(parsed.data.templateId, session.user.orgId);
  if (!template) return { success: false, error: "Template not found." };

  const created = await createEmailCampaignRow({
    orgId: session.user.orgId,
    name: parsed.data.name,
    subject: parsed.data.subject,
    templateId: parsed.data.templateId,
    segmentDefinition: parsed.data.segmentDefinition,
    createdByUserId: session.user.id,
    status: EmailCampaignStatus.DRAFT
  });

  revalidatePath("/broadcasts/campaigns");
  return { success: true, data: { id: created.id } };
}

export async function updateCampaignAction(
  input: z.input<typeof updateCampaignSchema>
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const parsed = updateCampaignSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await getEmailCampaignForOrg(parsed.data.id, session.user.orgId);
  if (!existing) return { success: false, error: "Campaign not found." };
  if (!campaignIsEditable(existing.status)) {
    return { success: false, error: "Only draft campaigns can be edited." };
  }

  if (parsed.data.templateId) {
    const template = await getEmailTemplateForOrg(parsed.data.templateId, session.user.orgId);
    if (!template) return { success: false, error: "Template not found." };
  }

  if (
    parsed.data.segmentDefinition &&
    parsed.data.segmentDefinition.orgId !== session.user.orgId
  ) {
    return { success: false, error: "Invalid organization." };
  }

  try {
    await updateEmailCampaignRow(parsed.data.id, session.user.orgId, {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.subject !== undefined ? { subject: parsed.data.subject } : {}),
      ...(parsed.data.templateId !== undefined ? { templateId: parsed.data.templateId } : {}),
      ...(parsed.data.segmentDefinition !== undefined
        ? { segmentDefinition: parsed.data.segmentDefinition }
        : {})
    });
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not update campaign."
    };
  }

  revalidatePath("/broadcasts/campaigns");
  revalidatePath(`/broadcasts/campaigns/${parsed.data.id}`);
  return { success: true, data: { id: parsed.data.id } };
}

export async function previewEmailCampaignAction(
  campaignId: string
): Promise<ActionResult<CampaignPreviewData>> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const campaign = await getEmailCampaignForOrg(campaignId, session.user.orgId);
  if (!campaign) return { success: false, error: "Campaign not found." };

  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: {
      name: true,
      logoUrl: true,
      logo: true,
      defaultEventBrandLogoUrl: true,
      primaryColor: true,
      accentColor: true,
      defaultEventBrandPrimaryColor: true
    }
  });
  if (!org) return { success: false, error: "Organization not found." };

  const segment = await resolveSegment(campaign.segmentDefinition);
  const branding = resolveOrgEmailBranding(org);
  const previewHtml = substituteBroadcastMergeTagsForPreview(campaign.template.compiledHtml, {
    ...branding,
    org_name: org.name
  });

  return {
    success: true,
    data: {
      compiledHtml: previewHtml,
      recipientCount: segment.recipientCount,
      matchedGuestCount: segment.matchedGuestCount,
      excluded: segment.excluded,
      sendValidation: validateBroadcastHtmlForSend(campaign.template.compiledHtml)
    }
  };
}

export async function testSendEmailCampaignAction(
  campaignId: string
): Promise<ActionResult<{ messageId?: string }>> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const userEmail = session.user.email?.trim();
  if (!userEmail) {
    return { success: false, error: "Your account has no email address for test sends." };
  }

  const campaign = await getEmailCampaignForOrg(campaignId, session.user.orgId);
  if (!campaign) return { success: false, error: "Campaign not found." };
  if (!campaignIsEditable(campaign.status)) {
    return { success: false, error: "Test sends are only available for draft campaigns." };
  }

  const validation = validateBroadcastHtmlForSend(campaign.template.compiledHtml);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(" ") };
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: {
      name: true,
      resendApiKey: true,
      logoUrl: true,
      logo: true,
      defaultEventBrandLogoUrl: true,
      primaryColor: true,
      accentColor: true,
      defaultEventBrandPrimaryColor: true
    }
  });
  if (!org) return { success: false, error: "Organization not found." };

  const branding = resolveOrgEmailBranding(org);
  const html = substituteBroadcastMergeTagsForPreview(campaign.template.compiledHtml, {
    ...branding,
    org_name: org.name
  });

  try {
    const res = await sendTransactionalEmail({
      to: userEmail,
      subject: `[TEST] ${campaign.subject}`,
      html,
      resendApiKeyOverride: org.resendApiKey?.trim() || undefined
    });
    return { success: true, data: { messageId: res.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Test send failed." };
  }
}

/**
 * Live broadcast send — requires `confirmLiveSend: true` after reviewing Resend API steps.
 */
export async function sendCampaignAction(
  input: z.input<typeof sendCampaignSchema>
): Promise<
  ActionResult<{
    mode: "preparing" | "complete";
    recipientCount: number;
    syncedCount: number;
    pendingCount: number;
    resendBroadcastId?: string;
    resendSegmentId: string;
    scheduled: boolean;
  }>
> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const billing = await requireBillingCapability(session.user.orgId, "send_broadcast");
  if (!billing.ok) return { success: false, error: billing.error };

  const parsed = sendCampaignSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  if (!parsed.data.confirmLiveSend) {
    return {
      success: false,
      error:
        "Live send not confirmed. Review the Resend API sequence and pass confirmLiveSend: true."
    };
  }

  if (process.env.BROADCAST_LIVE_SEND_ENABLED !== "true") {
    return {
      success: false,
      error:
        "Live broadcast sends are disabled on this server. Set BROADCAST_LIVE_SEND_ENABLED=true after validating Resend API calls in your test account."
    };
  }

  try {
    const campaign = await getEmailCampaignForOrg(parsed.data.campaignId, session.user.orgId);
    if (!campaign) return { success: false, error: "Campaign not found." };

    const segment = await resolveSegment(campaign.segmentDefinition);
    const recipientLimit = await assertCanSendBroadcastRecipients(
      gate.orgPlan,
      segment.recipientCount
    );
    if (!recipientLimit.ok) return { success: false, error: recipientLimit.error };

    const result = await executeEmailCampaignSend(
      parsed.data.campaignId,
      session.user.orgId,
      {
        scheduledAt: parsed.data.scheduledAt ?? null,
        inlineFirstBatch: true
      }
    );

    if (result.mode === "preparing" && result.pendingCount > 0) {
      void triggerBroadcastSendCron(parsed.data.campaignId);
    }

    revalidatePath("/broadcasts/campaigns");
    revalidatePath(`/broadcasts/campaigns/${parsed.data.campaignId}`);

    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: formatResendBroadcastError(e) };
  }
}

export async function getCampaignSendProgressAction(
  campaignId: string
): Promise<
  ActionResult<{
    status: EmailCampaignStatus;
    counts: Awaited<ReturnType<typeof getCampaignRecipientStatusCounts>>;
    total: number;
  }>
> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const campaign = await getEmailCampaignForOrg(campaignId, session.user.orgId);
  if (!campaign) return { success: false, error: "Campaign not found." };

  const counts = await getCampaignRecipientStatusCounts(campaignId);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return {
    success: true,
    data: { status: campaign.status, counts, total }
  };
}
