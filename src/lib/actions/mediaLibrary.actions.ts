"use server";

import { unlink } from "fs/promises";
import { z } from "zod";

import { MediaAssetKind, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { planIncludesModule } from "@/lib/billing/planLimits";
import { getOrgPlanForLimits } from "@/lib/db/billing";
import type {
  MediaAssetListItem,
  MediaDateFilter,
  MediaLibraryFilter,
  MediaLibraryQuery,
  MediaLibrarySort
} from "@/lib/media/types";
import { mediaFilterToKind } from "@/lib/media/types";
import { createMediaAssetRecord } from "@/lib/media/createMediaAsset";
import { absoluteUploadPath } from "@/lib/media/storage";
import { isModuleEnabled, moduleDisabledMessage } from "@/lib/features/modules";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

function canManage(role: Role) {
  return role === Role.ADMIN || role === Role.MARKETING;
}

async function requireMediaSession() {
  if (!isModuleEnabled("media")) {
    return { success: false as const, error: moduleDisabledMessage("media") };
  }

  const session = await auth();
  if (!session?.user?.orgId || !canManage(session.user.role)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const orgPlan = await getOrgPlanForLimits(session.user.orgId);
  if (!orgPlan) return { success: false as const, error: "Workspace not found." };
  if (!planIncludesModule(orgPlan.plan, "media")) {
    return {
      success: false as const,
      error:
        "Media library is not included on your current plan. Upgrade in Settings → Billing to unlock it."
    };
  }

  return { success: true as const, session };
}

const renameSchema = z.object({
  assetId: z.string().min(1),
  title: z.string().trim().min(1).max(120)
});

const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  sort: z
    .enum(["date-desc", "date-asc", "title-asc", "title-desc", "size-desc", "size-asc"])
    .optional(),
  dateFilter: z.enum(["all", "7d", "30d", "365d"]).optional()
});

function orderByForSort(sort: MediaLibrarySort | undefined) {
  switch (sort) {
    case "date-asc":
      return { createdAt: "asc" as const };
    case "title-asc":
      return { title: "asc" as const };
    case "title-desc":
      return { title: "desc" as const };
    case "size-asc":
      return { sizeBytes: "asc" as const };
    case "size-desc":
      return { sizeBytes: "desc" as const };
    case "date-desc":
    default:
      return { createdAt: "desc" as const };
  }
}

function createdAfterForFilter(dateFilter: MediaDateFilter | undefined): Date | null {
  if (!dateFilter || dateFilter === "all") return null;
  const days = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 365;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function listMediaAssets(
  filter: MediaLibraryFilter = "all",
  query: MediaLibraryQuery = {}
): Promise<ActionResult<MediaAssetListItem[]>> {
  const gate = await requireMediaSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const parsed = listQuerySchema.safeParse(query);
  const q = parsed.success ? parsed.data : {};
  const kind = mediaFilterToKind(filter);
  const createdAfter = createdAfterForFilter(q.dateFilter as MediaDateFilter | undefined);
  const search = q.search?.trim();

  const rows = await prisma.mediaAsset.findMany({
    where: {
      orgId: session.user.orgId,
      ...(kind ? { kind } : {}),
      ...(createdAfter ? { createdAt: { gte: createdAfter } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { originalName: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: orderByForSort(q.sort as MediaLibrarySort | undefined),
    select: {
      id: true,
      title: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      kind: true,
      publicUrl: true,
      createdAt: true
    }
  });

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString()
    }))
  };
}

export async function uploadMediaAsset(formData: FormData): Promise<ActionResult<MediaAssetListItem>> {
  const gate = await requireMediaSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Missing file." };
  }

  try {
    const row = await createMediaAssetRecord(session.user.orgId, session.user.id, file);

    revalidatePath("/media");
    return {
      success: true,
      data: row
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return { success: false, error: msg };
  }
}

export async function renameMediaAsset(input: z.input<typeof renameSchema>): Promise<ActionResult<{ title: string }>> {
  const gate = await requireMediaSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid title." };
  }

  const asset = await prisma.mediaAsset.findFirst({
    where: { id: parsed.data.assetId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!asset) return { success: false, error: "Asset not found." };

  await prisma.mediaAsset.update({
    where: { id: asset.id },
    data: { title: parsed.data.title }
  });

  revalidatePath("/media");
  return { success: true, data: { title: parsed.data.title } };
}

export async function deleteMediaAsset(assetId: string): Promise<ActionResult<{ deleted: true }>> {
  const gate = await requireMediaSession();
  if (!gate.success) return gate;
  const session = gate.session;

  const asset = await prisma.mediaAsset.findFirst({
    where: { id: assetId, orgId: session.user.orgId },
    select: { id: true, storagePath: true }
  });
  if (!asset) return { success: false, error: "Asset not found." };

  try {
    await unlink(absoluteUploadPath(asset.storagePath));
  } catch {
    /* file may already be gone */
  }

  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  revalidatePath("/media");
  return { success: true, data: { deleted: true } };
}

/** Upload and return public URL — used by image/video fields across the app. */
export async function uploadMediaAssetForField(
  formData: FormData
): Promise<ActionResult<{ url: string; asset: MediaAssetListItem }>> {
  const result = await uploadMediaAsset(formData);
  if (!result.success) return { success: false, error: result.error };
  if (!result.data) return { success: false, error: "Upload failed." };
  return {
    success: true,
    data: { url: result.data.publicUrl, asset: result.data }
  };
}

export async function getMediaAssetKinds(): Promise<MediaAssetKind[]> {
  return [MediaAssetKind.IMAGE, MediaAssetKind.VIDEO, MediaAssetKind.DOCUMENT];
}
