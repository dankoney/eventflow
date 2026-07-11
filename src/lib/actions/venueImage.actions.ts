"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { Role } from "@prisma/client";

import { auth } from "@/auth";
import type { ActionResult } from "@/types";

const MAX_BYTES = 3 * 1024 * 1024;

function canUpload(role: Role) {
  return role === Role.ADMIN || role === Role.MARKETING;
}

/** Upload a venue facility image; returns public path under /uploads/venues/. */
export async function uploadVenueFacilityImage(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canUpload(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Missing file" };
  }
  if (file.size < 1 || file.size > MAX_BYTES) {
    return { success: false, error: "Image must be under 3 MB." };
  }

  const type = file.type;
  if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp") {
    return { success: false, error: "Use JPEG, PNG, or WebP." };
  }

  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const id = randomUUID();
  const filename = `${id}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "venues");
  await mkdir(dir, { recursive: true });

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buf);

  const url = `/uploads/venues/${filename}`;
  return { success: true, data: { url } };
}
