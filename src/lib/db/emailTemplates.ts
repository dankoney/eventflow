import type { EmailTemplate, Prisma } from "@prisma/client";
import type { JSONContent } from "@tiptap/core";

import { compileEmailTemplateHtml } from "@/lib/email/compileEmailTemplate";
import { PREBUILT_EMAIL_TEMPLATE_SEEDS } from "@/lib/email/prebuiltEmailTemplates";
import { prisma } from "@/lib/prisma";

export type EmailTemplateListRow = {
  id: string;
  name: string;
  description: string | null;
  isPrebuilt: boolean;
  updatedAt: Date;
};

export async function listEmailTemplatesForOrg(orgId: string): Promise<EmailTemplateListRow[]> {
  return prisma.emailTemplate.findMany({
    where: { orgId },
    orderBy: [{ isPrebuilt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      isPrebuilt: true,
      updatedAt: true
    }
  });
}

export async function listPrebuiltEmailTemplates(orgId: string): Promise<EmailTemplateListRow[]> {
  return prisma.emailTemplate.findMany({
    where: { orgId, isPrebuilt: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      isPrebuilt: true,
      updatedAt: true
    }
  });
}

export async function getEmailTemplateForOrg(
  templateId: string,
  orgId: string
): Promise<EmailTemplate | null> {
  return prisma.emailTemplate.findFirst({
    where: { id: templateId, orgId }
  });
}

/**
 * Ensures org-scoped starter templates exist and refreshes their content from code seeds.
 */
export async function ensureOrgPrebuiltEmailTemplates(
  orgId: string,
  createdByUserId: string
): Promise<number> {
  const existing = await prisma.emailTemplate.findMany({
    where: { orgId, isPrebuilt: true },
    select: { id: true, name: true }
  });

  const byName = new Map(existing.map((row) => [row.name, row.id]));
  let changed = 0;

  for (const seed of PREBUILT_EMAIL_TEMPLATE_SEEDS) {
    const compiledHtml = await compileEmailTemplateHtml(seed.editorState as JSONContent);
    const existingId = byName.get(seed.name);

    if (existingId) {
      await prisma.emailTemplate.update({
        where: { id: existingId },
        data: {
          description: seed.description,
          editorState: seed.editorState as Prisma.InputJsonValue,
          compiledHtml
        }
      });
      changed += 1;
      continue;
    }

    await prisma.emailTemplate.create({
      data: {
        orgId,
        name: seed.name,
        description: seed.description,
        editorState: seed.editorState as Prisma.InputJsonValue,
        compiledHtml,
        isPrebuilt: true,
        createdByUserId
      }
    });
    changed += 1;
  }

  return changed;
}
