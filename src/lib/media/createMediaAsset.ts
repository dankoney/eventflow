import { prisma } from "@/lib/prisma";
import type { MediaAssetListItem } from "@/lib/media/types";
import { persistOrgMediaAsset } from "@/lib/media/storage";

export async function createMediaAssetRecord(
  orgId: string,
  userId: string | null | undefined,
  file: File
): Promise<MediaAssetListItem> {
  const persisted = await persistOrgMediaAsset({
    orgId,
    file,
    uploadedByUserId: userId
  });

  const row = await prisma.mediaAsset.create({
    data: {
      id: persisted.id,
      orgId,
      uploadedByUserId: userId ?? null,
      title: persisted.title,
      originalName: persisted.originalName,
      mimeType: persisted.mimeType,
      sizeBytes: persisted.sizeBytes,
      kind: persisted.kind,
      storagePath: persisted.storagePath,
      publicUrl: persisted.publicUrl
    },
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

  return { ...row, createdAt: row.createdAt.toISOString() };
}
