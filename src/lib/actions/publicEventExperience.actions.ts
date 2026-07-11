"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { detectMediaKind, maxBytesForKind, persistOrgMediaAsset, resolveFileMimeType } from "@/lib/media/storage";
import { prisma } from "@/lib/prisma";
import {
  publicEventExperienceSchema,
  type PublicEventExperiencePayload
} from "@/lib/public-event/experience";
import { normalizeBackgroundVideoUrlField, toYoutubeEmbedUrl } from "@/lib/public-event/youtubeEmbed";
import type { ActionResult } from "@/types";

function canManage(role: Role) {
  return role === Role.ADMIN || role === Role.MARKETING;
}

type AssetKind = "speaker_image" | "resource_file" | "page_image";

export async function uploadPublicEventAsset(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManage(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const eventId = String(formData.get("eventId") ?? "");
  const kind = String(formData.get("kind") ?? "") as AssetKind;
  const file = formData.get("file");
  if (!eventId) return { success: false, error: "Missing event." };
  if (!(file instanceof File)) return { success: false, error: "Missing file." };
  if (kind !== "speaker_image" && kind !== "resource_file" && kind !== "page_image") {
    return { success: false, error: "Invalid upload kind." };
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  const type = resolveFileMimeType(file);
  const detected = detectMediaKind(type);
  if (!detected) {
    return { success: false, error: "Unsupported file type." };
  }
  if (kind === "speaker_image" && detected !== "IMAGE") {
    return { success: false, error: "Use JPEG, PNG, or WebP for speaker photos." };
  }
  if (kind === "page_image" && detected !== "IMAGE" && detected !== "VIDEO") {
    return { success: false, error: "Use an image or MP4/WebM video." };
  }
  if (kind === "resource_file" && detected !== "DOCUMENT") {
    return { success: false, error: "Use PDF, DOCX, PPT/PPTX, TXT, or ZIP for resources." };
  }

  const max = maxBytesForKind(detected);
  if (file.size < 1 || file.size > max) {
    const mb = Math.round(max / (1024 * 1024));
    return { success: false, error: `File must be under ${mb} MB.` };
  }

  try {
    const persisted = await persistOrgMediaAsset({
      orgId: session.user.orgId,
      file,
      uploadedByUserId: session.user.id
    });

    await prisma.mediaAsset.create({
      data: {
        id: persisted.id,
        orgId: session.user.orgId,
        uploadedByUserId: session.user.id,
        title: persisted.title,
        originalName: persisted.originalName,
        mimeType: persisted.mimeType,
        sizeBytes: persisted.sizeBytes,
        kind: persisted.kind,
        storagePath: persisted.storagePath,
        publicUrl: persisted.publicUrl
      }
    });

    return { success: true, data: { url: persisted.publicUrl } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return { success: false, error: msg };
  }
}

export async function savePublicEventExperience(
  eventId: string,
  input: PublicEventExperiencePayload
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManage(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = publicEventExperienceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const normalized = {
    ...parsed.data,
    speakers: parsed.data.speakers.map((s) => ({
      ...s,
      imageUrl:
        s.imageUrl && !/^https?:\/\//i.test(s.imageUrl) && !s.imageUrl.startsWith("/")
          ? `/${s.imageUrl}`
          : s.imageUrl
    })),
    resources: parsed.data.resources.map((r) => ({
      ...r,
      url: r.url && !/^https?:\/\//i.test(r.url) && !r.url.startsWith("/") ? `/${r.url}` : r.url,
      fileUrl:
        r.fileUrl && !/^https?:\/\//i.test(r.fileUrl) && !r.fileUrl.startsWith("/")
          ? `/${r.fileUrl}`
          : r.fileUrl
    })),
    spotlight: {
      ...parsed.data.spotlight,
      backgroundVideoUrl: normalizeBackgroundVideoUrlField(parsed.data.spotlight?.backgroundVideoUrl)
    },
    newsItems: parsed.data.newsItems.map((item) => ({
      ...item,
      videoEmbedUrl:
        item.mediaType === "video" && item.videoEmbedUrl
          ? toYoutubeEmbedUrl(item.videoEmbedUrl) ?? item.videoEmbedUrl
          : item.videoEmbedUrl
    }))
  };

  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, orgId: session.user.orgId },
      select: { id: true }
    });
    if (!event) return { success: false, error: "Event not found." };

    await prisma.event.update({
      where: { id: eventId },
      data: { publicExperience: normalized }
    });

    revalidatePath(`/events/${eventId}/edit`);
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/public`);
    revalidatePath(`/register/${eventId}`);
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not save public page content." };
  }
}

