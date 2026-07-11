/** Server action errors that map to a specific form field: `FIELD:<name>:<message>` */

export function actionErrorForField(field: string, message: string): string {
  return `FIELD:${field}:${message}`;
}

export function parseActionFieldError(
  error: string | undefined
): { field: string; message: string } | null {
  if (!error?.startsWith("FIELD:")) return null;
  const rest = error.slice("FIELD:".length);
  const colon = rest.indexOf(":");
  if (colon < 1) return null;
  return { field: rest.slice(0, colon), message: rest.slice(colon + 1) };
}
