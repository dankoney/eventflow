import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let cachedPngBase64: string | null | undefined;
let cachedPngSize: { width: number; height: number } | null | undefined;

function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  // PNG IHDR: bytes 16–23 are width/height big-endian
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20)
  };
}

function loadLogoPng(): { base64: string; width: number; height: number } | null {
  const pngPath = join(process.cwd(), "public", "brand", "eventflow-logo.png");
  if (!existsSync(pngPath)) return null;
  const buf = readFileSync(pngPath);
  const size = readPngSize(buf);
  if (!size || size.width < 1 || size.height < 1) return null;
  return { base64: buf.toString("base64"), width: size.width, height: size.height };
}

/** PNG bytes for the Eventflow wordmark (used in PDF watermarks). */
export function getEventflowLogoPngBase64(): string | null {
  if (cachedPngBase64 !== undefined) return cachedPngBase64;
  const loaded = loadLogoPng();
  if (!loaded) {
    cachedPngBase64 = null;
    cachedPngSize = null;
    return null;
  }
  cachedPngBase64 = loaded.base64;
  cachedPngSize = { width: loaded.width, height: loaded.height };
  return cachedPngBase64;
}

/** Intrinsic pixel size of eventflow-logo.png (for aspect-correct PDF placement). */
export function getEventflowLogoPngSize(): { width: number; height: number } | null {
  if (cachedPngSize !== undefined) return cachedPngSize;
  getEventflowLogoPngBase64();
  return cachedPngSize ?? null;
}

/**
 * Place the Eventflow logo in a PDF at (x, y) with a fixed height (pt),
 * width derived from the PNG’s real aspect ratio — never a forced box.
 */
export function eventflowLogoPdfSizeForHeight(heightPt: number): {
  widthPt: number;
  heightPt: number;
} {
  const size = getEventflowLogoPngSize();
  const ratio = size ? size.width / size.height : 2;
  return { widthPt: heightPt * ratio, heightPt };
}
