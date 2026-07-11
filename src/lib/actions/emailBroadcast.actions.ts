"use server";

import { Role } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import {
  listBroadcastSegmentFilterOptions,
  type BroadcastSegmentFilterOptions
} from "@/lib/db/emailBroadcast";
import { resolveSegment, type ResolveSegmentResult, type SegmentRecipient } from "@/lib/db/resolveSegment";
import { emailSegmentDefinitionSchema } from "@/lib/email/segmentDefinition";
import { guardModuleAction } from "@/lib/features/moduleGuards";
import { canBlastGuests } from "@/lib/rbac/capabilities";
import type { ActionResult } from "@/types";

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

const previewSegmentSchema = z.object({
  definition: emailSegmentDefinitionSchema,
  previewLimit: z.number().int().min(1).max(50).optional()
});

const filterOptionsSchema = z.object({
  eventIds: z.array(z.string().min(1)).nullable()
});

export type BroadcastSegmentPreviewData = {
  matchedGuestCount: number;
  recipientCount: number;
  excluded: ResolveSegmentResult["excluded"];
  recipients: SegmentRecipient[];
  previewLimitApplied: number | null;
};

export async function previewEmailBroadcastSegment(
  input: z.input<typeof previewSegmentSchema>
): Promise<ActionResult<BroadcastSegmentPreviewData>> {
  const blocked = guardModuleAction("broadcast");
  if (blocked) return blocked;

  const session = await auth();
  if (!session?.user?.orgId || !canBlastGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Only admins and marketing can preview broadcast segments." };
  }

  const parsed = previewSegmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  if (parsed.data.definition.orgId !== session.user.orgId) {
    return { success: false, error: "Invalid organization." };
  }

  const scopedIds =
    parsed.data.definition.eventIds?.length
      ? parsed.data.definition.eventIds
      : parsed.data.definition.eventId
        ? [parsed.data.definition.eventId]
        : null;

  if (scopedIds?.length) {
    const count = await prismaEventScopeCheck(session.user.orgId, scopedIds);
    if (count !== scopedIds.length) {
      return { success: false, error: "One or more events were not found." };
    }
  }

  const result = await resolveSegment(parsed.data.definition, {
    previewLimit: parsed.data.previewLimit ?? 25
  });

  return {
    success: true,
    data: {
      matchedGuestCount: result.matchedGuestCount,
      recipientCount: result.recipientCount,
      excluded: result.excluded,
      recipients: result.recipients,
      previewLimitApplied: result.previewLimitApplied
    }
  };
}

export async function getBroadcastSegmentFilterOptions(
  input: z.input<typeof filterOptionsSchema>
): Promise<ActionResult<BroadcastSegmentFilterOptions>> {
  const blocked = guardModuleAction("broadcast");
  if (blocked) return blocked;

  const session = await auth();
  if (!session?.user?.orgId || !canBlastGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Only admins and marketing can manage broadcast segments." };
  }

  const parsed = filterOptionsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  if (parsed.data.eventIds?.length) {
    const count = await prismaEventScopeCheck(session.user.orgId, parsed.data.eventIds);
    if (count !== parsed.data.eventIds.length) {
      return { success: false, error: "One or more events were not found." };
    }
  }

  const options = await listBroadcastSegmentFilterOptions(session.user.orgId, parsed.data.eventIds);
  return { success: true, data: options };
}

async function prismaEventScopeCheck(orgId: string, eventIds: string[]): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  return prisma.event.count({
    where: { orgId, id: { in: eventIds } }
  });
}
