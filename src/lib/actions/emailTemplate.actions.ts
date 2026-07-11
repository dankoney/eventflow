"use server";

import type { JSONContent } from "@tiptap/core";
import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { compileEmailTemplateHtml } from "@/lib/email/compileEmailTemplate";
import {
  ensureOrgPrebuiltEmailTemplates,
  getEmailTemplateForOrg,
  listEmailTemplatesForOrg,
  listPrebuiltEmailTemplates
} from "@/lib/db/emailTemplates";
import { isModuleEnabled, moduleDisabledMessage } from "@/lib/features/modules";
import { canBlastGuests } from "@/lib/rbac/capabilities";
import { prisma } from "@/lib/prisma";
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
  return { success: true as const, session };
}

const saveTemplateSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, "Template name is required.").max(120),
  description: z.string().trim().max(2000).optional(),
  editorState: z.record(z.unknown())
});

export async function listEmailTemplatesAction(): Promise<
  ActionResult<{ templates: Awaited<ReturnType<typeof listEmailTemplatesForOrg>> }>
> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  await ensureOrgPrebuiltEmailTemplates(session.user.orgId, session.user.id);

  const templates = await listEmailTemplatesForOrg(session.user.orgId);
  return { success: true, data: { templates } };
}

export async function listPrebuiltEmailTemplatesAction(): Promise<
  ActionResult<{ templates: Awaited<ReturnType<typeof listPrebuiltEmailTemplates>> }>
> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  await ensureOrgPrebuiltEmailTemplates(session.user.orgId, session.user.id);

  const templates = await listPrebuiltEmailTemplates(session.user.orgId);
  return { success: true, data: { templates } };
}

export async function getEmailTemplateAction(
  templateId: string
): Promise<
  ActionResult<{
    id: string;
    name: string;
    description: string | null;
    editorState: unknown;
    compiledHtml: string;
    isPrebuilt: boolean;
  }>
> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const template = await getEmailTemplateForOrg(templateId, session.user.orgId);
  if (!template) return { success: false, error: "Template not found." };

  return {
    success: true,
    data: {
      id: template.id,
      name: template.name,
      description: template.description,
      editorState: template.editorState,
      compiledHtml: template.compiledHtml,
      isPrebuilt: template.isPrebuilt
    }
  };
}

export async function saveEmailTemplateAction(
  input: z.input<typeof saveTemplateSchema>
): Promise<ActionResult<{ id: string; compiledHtml: string }>> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const parsed = saveTemplateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  let compiledHtml: string;
  try {
    compiledHtml = await compileEmailTemplateHtml(parsed.data.editorState as JSONContent);
  } catch (err) {
    console.error("compileEmailTemplateHtml failed", err);
    return { success: false, error: "Could not compile template HTML." };
  }

  if (parsed.data.id) {
    const existing = await getEmailTemplateForOrg(parsed.data.id, session.user.orgId);
    if (!existing) return { success: false, error: "Template not found." };
    if (existing.isPrebuilt) {
      return { success: false, error: "Prebuilt starter templates cannot be edited. Duplicate as a new template." };
    }

    const updated = await prisma.emailTemplate.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        editorState: parsed.data.editorState as Prisma.InputJsonValue,
        compiledHtml
      }
    });

    revalidatePath("/broadcasts/templates");
    revalidatePath(`/broadcasts/templates/${updated.id}/edit`);
    return { success: true, data: { id: updated.id, compiledHtml } };
  }

  const created = await prisma.emailTemplate.create({
    data: {
      orgId: session.user.orgId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      editorState: parsed.data.editorState as Prisma.InputJsonValue,
      compiledHtml,
      isPrebuilt: false,
      createdByUserId: session.user.id
    }
  });

  revalidatePath("/broadcasts/templates");
  return { success: true, data: { id: created.id, compiledHtml } };
}

export async function duplicatePrebuiltEmailTemplateAction(
  prebuiltId: string,
  name: string
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const source = await getEmailTemplateForOrg(prebuiltId, session.user.orgId);
  if (!source?.isPrebuilt) {
    return { success: false, error: "Starter template not found." };
  }

  const compiledHtml = await compileEmailTemplateHtml(source.editorState as JSONContent);

  const created = await prisma.emailTemplate.create({
    data: {
      orgId: session.user.orgId,
      name: name.trim() || `${source.name} copy`,
      description: source.description,
      editorState: source.editorState as Prisma.InputJsonValue,
      compiledHtml,
      isPrebuilt: false,
      createdByUserId: session.user.id
    }
  });

  revalidatePath("/broadcasts/templates");
  return { success: true, data: { id: created.id } };
}

export async function getPrebuiltTemplateEditorStateAction(
  prebuiltId: string
): Promise<ActionResult<{ editorState: unknown; name: string; description: string | null }>> {
  const gate = await requireBroadcastSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const template = await getEmailTemplateForOrg(prebuiltId, session.user.orgId);
  if (!template?.isPrebuilt) {
    return { success: false, error: "Starter template not found." };
  }

  return {
    success: true,
    data: {
      editorState: template.editorState,
      name: template.name,
      description: template.description
    }
  };
}
