import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { createMediaAssetRecord } from "@/lib/media/createMediaAsset";
import { detectMediaKindFromFile, maxBytesForKind, resolveFileMimeType } from "@/lib/media/mime";

export const runtime = "nodejs";
export const maxDuration = 300;

function canManage(role: Role) {
  return role === Role.ADMIN || role === Role.MARKETING;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId || !canManage(session.user.role)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Could not read upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json({ success: false, error: "Missing file." }, { status: 400 });
  }

  const kind = detectMediaKindFromFile(file);
  if (!kind) {
    return NextResponse.json(
      { success: false, error: `Unsupported file type (${resolveFileMimeType(file) || "unknown"}).` },
      { status: 400 }
    );
  }

  const max = maxBytesForKind(kind);
  if (file.size > max) {
    const mb = Math.round(max / (1024 * 1024));
    return NextResponse.json({ success: false, error: `File must be under ${mb} MB.` }, { status: 400 });
  }

  try {
    const asset = await createMediaAssetRecord(session.user.orgId, session.user.id, file);
    revalidatePath("/media");
    return NextResponse.json({ success: true, data: asset });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
