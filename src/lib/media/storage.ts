import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import {
  detectMediaKind,
  extensionForFile,
  maxBytesForKind,
  resolveFileMimeType
} from "@/lib/media/mime";

export {
  detectMediaKind,
  detectMediaKindFromFile,
  isAllowedMimeForFilter,
  maxBytesForKind,
  resolveFileMimeType
} from "@/lib/media/mime";

export function sanitizeTitleFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim();
  return base.slice(0, 120) || "Untitled asset";
}

export type PersistMediaInput = {
  orgId: string;
  file: File;
  uploadedByUserId?: string | null;
};

export type PersistMediaResult = {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  kind: import("@prisma/client").MediaAssetKind;
  storagePath: string;
  publicUrl: string;
};

export async function persistOrgMediaAsset(input: PersistMediaInput): Promise<PersistMediaResult> {
  const { orgId, file } = input;
  const mimeType = resolveFileMimeType(file);
  const kind = detectMediaKind(mimeType);
  if (!kind) {
    throw new Error("Unsupported file type.");
  }
  const max = maxBytesForKind(kind);
  if (file.size < 1 || file.size > max) {
    const mb = Math.round(max / (1024 * 1024));
    throw new Error(`File must be under ${mb} MB.`);
  }

  const ext = extensionForFile(mimeType, file.name);
  if (!ext) throw new Error("Unsupported file type.");

  const id = randomUUID();
  const filename = `${id}.${ext}`;
  const storagePath = path.posix.join("orgs", orgId, "assets", filename);
  const dir = path.join(process.cwd(), "public", "uploads", "orgs", orgId, "assets");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buf);

  const publicUrl = `/uploads/${storagePath.replace(/\\/g, "/")}`;
  const originalName = file.name.slice(0, 255) || filename;
  const title = sanitizeTitleFromFilename(originalName);

  return {
    id,
    title,
    originalName,
    mimeType,
    sizeBytes: file.size,
    kind,
    storagePath: storagePath.replace(/\\/g, "/"),
    publicUrl
  };
}

export function absoluteUploadPath(storagePath: string): string {
  return path.join(process.cwd(), "public", "uploads", storagePath);
}
