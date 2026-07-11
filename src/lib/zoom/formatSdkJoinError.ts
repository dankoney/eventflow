/** Human-readable message from Zoom Meeting SDK embedded `join()` failures. */
export function formatZoomSdkJoinError(err: unknown): string {
  if (err instanceof Error && err.message && err.message !== "[object Object]") {
    return err.message;
  }
  if (!err || typeof err !== "object") {
    return "Failed to join meeting";
  }
  const o = err as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.type === "string") parts.push(o.type);
  if (typeof o.reason === "string") parts.push(o.reason);
  if (typeof o.message === "string") parts.push(o.message);
  if (typeof o.errorCode === "number") parts.push(`code ${o.errorCode}`);
  if (parts.length > 0) return parts.join(" — ");
  try {
    return JSON.stringify(err);
  } catch {
    return "Failed to join meeting";
  }
}
