"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  eventFeedbackQuestionsSchema,
  normalizeFeedbackQuestionsForPersistence,
  parseEventFeedbackQuestionsJson
} from "@/lib/event-feedback/feedbackQuestions";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const saveTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  questions: eventFeedbackQuestionsSchema
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

export type OrgFeedbackQuestionTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  updatedAt: Date;
};

export async function listOrgFeedbackQuestionTemplates(): Promise<
  ActionResult<OrgFeedbackQuestionTemplateRow[]>
> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Unauthorized" };
  }

  const rows = await prisma.orgFeedbackQuestionTemplate.findMany({
    where: { orgId: session.user.orgId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, description: true, questions: true, updatedAt: true }
  });

  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      questionCount: parseEventFeedbackQuestionsJson(r.questions).length,
      updatedAt: r.updatedAt
    }))
  };
}

export async function saveOrgFeedbackQuestionTemplate(
  input: z.input<typeof saveTemplateSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = saveTemplateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const questions = normalizeFeedbackQuestionsForPersistence(parsed.data.questions);
  if (questions.length === 0) {
    return { success: false, error: "Add at least one question before saving a template." };
  }

  const row = await prisma.orgFeedbackQuestionTemplate.upsert({
    where: {
      orgId_name: { orgId: session.user.orgId, name: parsed.data.name }
    },
    create: {
      orgId: session.user.orgId,
      name: parsed.data.name,
      description: parsed.data.description?.trim() || null,
      questions
    },
    update: {
      description: parsed.data.description?.trim() || null,
      questions
    },
    select: { id: true }
  });

  revalidatePath("/dashboard/settings");
  return { success: true, data: { id: row.id } };
}

export async function deleteOrgFeedbackQuestionTemplate(input: {
  id: string;
}): Promise<ActionResult<{ deleted: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Unauthorized" };
  }

  const existing = await prisma.orgFeedbackQuestionTemplate.findFirst({
    where: { id: input.id, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!existing) return { success: false, error: "Template not found." };

  await prisma.orgFeedbackQuestionTemplate.delete({ where: { id: existing.id } });
  revalidatePath("/dashboard/settings");
  return { success: true, data: { deleted: true } };
}

export async function getOrgFeedbackQuestionTemplateQuestions(input: {
  id: string;
}): Promise<
  ActionResult<{
    name: string;
    description: string | null;
    questions: ReturnType<typeof parseEventFeedbackQuestionsJson>;
  }>
> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Unauthorized" };
  }

  const row = await prisma.orgFeedbackQuestionTemplate.findFirst({
    where: { id: input.id, orgId: session.user.orgId },
    select: { name: true, description: true, questions: true }
  });
  if (!row) return { success: false, error: "Template not found." };

  return {
    success: true,
    data: {
      name: row.name,
      description: row.description,
      questions: parseEventFeedbackQuestionsJson(row.questions)
    }
  };
}
