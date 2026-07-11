import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";

function contentType(filePath: string): string {
  const p = filePath.toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".pdf")) return "application/pdf";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".mp4")) return "video/mp4";
  if (p.endsWith(".webm")) return "video/webm";
  if (p.endsWith(".mov")) return "video/quicktime";
  if (p.endsWith(".m4v")) return "video/mp4";
  return "application/octet-stream";
}

function resolveUploadFile(rel: string): string | null {
  if (!rel || rel.includes("..") || path.isAbsolute(rel)) return null;

  const publicUploadsRoot = path.join(process.cwd(), "public", "uploads");
  const filePath = path.join(publicUploadsRoot, rel);
  const resolvedFile = path.resolve(filePath);
  const resolvedRoot = path.resolve(publicUploadsRoot);
  if (!resolvedFile.startsWith(resolvedRoot + path.sep) && resolvedFile !== resolvedRoot) {
    return null;
  }
  return resolvedFile;
}

function parseByteRange(
  rangeHeader: string,
  fileSize: number
): { start: number; end: number } | "unsatisfiable" | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  const [, startPart, endPart] = match;
  if (!startPart && !endPart) return null;

  let start: number;
  let end: number;

  if (!startPart) {
    const suffixLength = Number(endPart);
    if (!Number.isFinite(suffixLength) || suffixLength < 1) return null;
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = Number(startPart);
    end = endPart ? Number(endPart) : fileSize - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  }

  if (start < 0 || start >= fileSize || end < start) return "unsatisfiable";
  end = Math.min(end, fileSize - 1);
  return { start, end };
}

function streamFile(
  filePath: string,
  options?: { start?: number; end?: number }
): ReadableStream<Uint8Array> {
  const nodeStream =
    options?.start !== undefined || options?.end !== undefined
      ? createReadStream(filePath, options as { start: number; end: number })
      : createReadStream(filePath);
  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}

function baseHeaders(filePath: string, fileSize: number): HeadersInit {
  return {
    "Content-Type": contentType(filePath),
    "Accept-Ranges": "bytes",
    "Content-Length": String(fileSize),
    "Cache-Control": CACHE_CONTROL
  };
}

async function serveUpload(req: NextRequest, rel: string) {
  const resolvedFile = resolveUploadFile(rel);
  if (!resolvedFile) {
    return new NextResponse("Not found", { status: 404 });
  }

  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(resolvedFile);
    if (!fileStat.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const fileSize = fileStat.size;
  const rangeHeader = req.headers.get("range");

  if (req.method === "HEAD") {
    return new NextResponse(null, {
      status: 200,
      headers: baseHeaders(resolvedFile, fileSize)
    });
  }

  if (rangeHeader) {
    const parsed = parseByteRange(rangeHeader, fileSize);
    if (parsed === "unsatisfiable") {
      return new NextResponse("Range Not Satisfiable", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${fileSize}`
        }
      });
    }
    if (parsed) {
      const { start, end } = parsed;
      const chunkSize = end - start + 1;
      return new NextResponse(streamFile(resolvedFile, { start, end }), {
        status: 206,
        headers: {
          "Content-Type": contentType(resolvedFile),
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Cache-Control": CACHE_CONTROL
        }
      });
    }
  }

  return new NextResponse(streamFile(resolvedFile), {
    status: 200,
    headers: baseHeaders(resolvedFile, fileSize)
  });
}

/**
 * Serves user-generated files under public/uploads at /uploads/... Some hosts (e.g. Node behind
 * reverse proxies) do not expose new files in public/ after deploy; streaming from the app
 * guarantees runtime uploads are visible. Supports HTTP range requests for video seeking/streaming.
 */
export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const segs = params.path;
  if (!segs?.length) {
    return new NextResponse("Not found", { status: 404 });
  }
  return serveUpload(req, segs.join("/"));
}

export async function HEAD(req: NextRequest, { params }: { params: { path: string[] } }) {
  const segs = params.path;
  if (!segs?.length) {
    return new NextResponse(null, { status: 404 });
  }
  return serveUpload(req, segs.join("/"));
}
