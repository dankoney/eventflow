import { writeFile, mkdir } from "fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { canManageEvents } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
/**
 * MIME types accepted for candidate "supporting documents" — typically a manifesto,
 * CV, or biography. We intentionally allow a small allow-list rather than `*` so a
 * misuploaded executable / archive can never end up linked from the public ballot.
 */
const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/jpeg": "jpg",
  "image/png": "png"
};

function sanitizeFilename(input: string): string {
  const base = input.replace(/[^\w.\- ]+/g, "").trim().slice(0, 80);
  return base.length === 0 ? "document" : base;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageEvents(session.user.role)) {
    return NextResponse.json({ error: "You don't have permission to manage poll media." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (file.size < 1 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Document must be under 10MB" }, { status: 400 });
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Use PDF, DOC/DOCX, PPT/PPTX, JPG, or PNG" },
      { status: 400 }
    );
  }

  const filename = `cand-doc-${session.user.orgId.slice(0, 8)}-${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", "poll-candidate-docs");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);

  const url = `/uploads/poll-candidate-docs/${filename}`;
  const originalName = sanitizeFilename(file.name || `document.${ext}`);
  return NextResponse.json(
    { url, originalName, mimeType: file.type } satisfies { url: string; originalName: string; mimeType: string }
  );
}
