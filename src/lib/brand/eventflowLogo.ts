import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let cachedPngBase64: string | null | undefined;

/** PNG bytes for the Eventflow wordmark (used in PDF watermarks). */
export function getEventflowLogoPngBase64(): string | null {
  if (cachedPngBase64 !== undefined) return cachedPngBase64;

  const pngPath = join(process.cwd(), "public", "brand", "eventflow-logo.png");
  if (existsSync(pngPath)) {
    cachedPngBase64 = readFileSync(pngPath).toString("base64");
    return cachedPngBase64;
  }

  cachedPngBase64 = null;
  return null;
}
