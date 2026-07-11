/** Zoom meeting/webinar passcode rules (visible ASCII, no spaces). */

const VISIBLE_ASCII_PASSCODE = /^[\x21-\x7E]+$/;

export type ZoomPasscodeValidation = { ok: true; value: string } | { ok: false; message: string };

export function validateZoomPasscode(raw: string): ZoomPasscodeValidation {
  const value = raw.trim();
  if (!value) {
    return { ok: false, message: "Enter a passcode or choose Zoom default instead." };
  }
  if (/\s/.test(value)) {
    return {
      ok: false,
      message: "Passcode cannot contain spaces. Use only visible characters (letters, numbers, symbols)."
    };
  }
  if (value.length > 10) {
    return { ok: false, message: "Passcode must be 10 characters or fewer." };
  }
  if (!VISIBLE_ASCII_PASSCODE.test(value)) {
    return {
      ok: false,
      message: "Passcode may only use visible ASCII characters (no spaces or hidden characters)."
    };
  }
  return { ok: true, value };
}

export function zoomPasscodeForApi(
  mode: "default" | "custom",
  custom: string | null | undefined
): string | null {
  if (mode !== "custom") return null;
  const parsed = validateZoomPasscode(custom ?? "");
  if (!parsed.ok) return null;
  return parsed.value;
}
