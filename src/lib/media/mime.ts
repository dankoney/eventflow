import { MediaAssetKind } from "@prisma/client";

import type { MediaLibraryFilter } from "@/lib/media/types";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml"
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"]);
const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "text/plain"
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  pdf: "application/pdf",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  txt: "text/plain"
};

export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "mp4",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "text/plain": "txt"
};

const MAX_BYTES: Record<MediaAssetKind, number> = {
  IMAGE: 5 * 1024 * 1024,
  VIDEO: 80 * 1024 * 1024,
  DOCUMENT: 20 * 1024 * 1024
};

export function detectMediaKind(mimeType: string): MediaAssetKind | null {
  if (IMAGE_TYPES.has(mimeType)) return MediaAssetKind.IMAGE;
  if (VIDEO_TYPES.has(mimeType)) return MediaAssetKind.VIDEO;
  if (DOCUMENT_TYPES.has(mimeType)) return MediaAssetKind.DOCUMENT;
  return null;
}

export function resolveFileMimeType(file: File): string {
  if (file.type?.trim()) return file.type.trim();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "";
}

export function detectMediaKindFromFile(file: File): MediaAssetKind | null {
  return detectMediaKind(resolveFileMimeType(file));
}

export function extensionForFile(mimeType: string, fileName: string): string | null {
  const fromMime = EXT_BY_MIME[mimeType];
  if (fromMime) return fromMime;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext || null;
}

export function isAllowedMimeForFilter(mimeType: string, filter: MediaLibraryFilter): boolean {
  const kind = detectMediaKind(mimeType);
  if (!kind) return false;
  if (filter === "all") return true;
  if (filter === "image") return kind === MediaAssetKind.IMAGE;
  if (filter === "video") return kind === MediaAssetKind.VIDEO;
  return kind === MediaAssetKind.DOCUMENT;
}

export function maxBytesForKind(kind: MediaAssetKind): number {
  return MAX_BYTES[kind];
}

export function acceptForMediaFilter(filter: MediaLibraryFilter): string {
  if (filter === "image") return "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";
  if (filter === "video") return "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v";
  if (filter === "document") return ".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip";
  return "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v,.pdf,.doc,.docx,.ppt,.pptx,.txt,.zip";
}

export function validateFileForUpload(
  file: File,
  filter: MediaLibraryFilter = "all"
): { ok: true; kind: MediaAssetKind } | { ok: false; error: string } {
  const mimeType = resolveFileMimeType(file);
  const kind = detectMediaKind(mimeType);
  if (!kind) {
    return { ok: false, error: `"${file.name}" is not a supported file type.` };
  }
  if (!isAllowedMimeForFilter(mimeType, filter)) {
    return { ok: false, error: `"${file.name}" does not match the current filter.` };
  }
  const max = maxBytesForKind(kind);
  if (file.size < 1 || file.size > max) {
    const mb = Math.round(max / (1024 * 1024));
    return { ok: false, error: `"${file.name}" must be under ${mb} MB.` };
  }
  return { ok: true, kind };
}
