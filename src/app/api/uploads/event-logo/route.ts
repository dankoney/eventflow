import { writeFile, mkdir } from "fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (file.size < 1 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 2MB" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Use JPG, PNG, WebP, GIF, or SVG" }, { status: 400 });
  }

  const ext =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/gif"
          ? "gif"
          : file.type === "image/svg+xml"
            ? "svg"
            : "webp";
  const filename = `org-${session.user.orgId.slice(0, 8)}-${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", "event-logos");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);

  const url = `/uploads/event-logos/${filename}`;
  return NextResponse.json({ url } satisfies { url: string });
}
