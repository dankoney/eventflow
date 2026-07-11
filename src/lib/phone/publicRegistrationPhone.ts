import { DEFAULT_PHONE_DIAL, PHONE_DIAL_OPTIONS } from "@/lib/register/phoneDialOptions";

/** Known dial codes longest-first so +233… is not split as +2335…. */
const KNOWN_DIAL_CODES_LONGEST_FIRST = [...new Set(PHONE_DIAL_OPTIONS.map((o) => o.value))].sort(
  (a, b) => b.length - a.length
);

function splitStoredPhoneDigits(digits: string): { dial: string; national: string } | null {
  for (const dial of KNOWN_DIAL_CODES_LONGEST_FIRST) {
    if (!digits.startsWith(dial)) continue;
    const national = digits.slice(dial.length);
    if (national.length >= 6 && national.length <= 14) {
      return { dial, national };
    }
  }
  return null;
}

/** Strip non-digits; for Ghana, strip a single leading 0 from local-style entry. */
export function normalizeNationalDigits(raw: string, dialCode: string): string {
  let d = raw.replace(/\D/g, "");
  if (dialCode === "233" && d.startsWith("0")) d = d.slice(1);
  return d;
}

export function isValidNationalForDial(dialCode: string, nationalDigits: string): boolean {
  if (!nationalDigits.length) return false;
  if (dialCode === "233") return nationalDigits.length >= 9 && nationalDigits.length <= 10;
  return nationalDigits.length >= 6 && nationalDigits.length <= 14;
}

export function composeE164(dialCode: string, nationalDigits: string): string {
  return `+${dialCode}${nationalDigits}`;
}

/** Parse stored DB phone into dial + national for form prefills. */
export function parseStoredPhoneToForm(phone: string | null | undefined): {
  dial: string;
  national: string;
} {
  if (!phone?.trim()) return { dial: DEFAULT_PHONE_DIAL, national: "" };
  const t = phone.trim();
  const digits = (t.startsWith("+") ? t.slice(1) : t).replace(/\D/g, "");

  const split = splitStoredPhoneDigits(digits);
  if (split) return split;

  if (digits.length >= 10 && digits.startsWith("233")) {
    return { dial: "233", national: digits.slice(3) };
  }
  if (digits.length >= 10 && digits.startsWith("0")) {
    return { dial: DEFAULT_PHONE_DIAL, national: digits.replace(/^0+/, "") };
  }
  return { dial: DEFAULT_PHONE_DIAL, national: digits.replace(/^0+/, "") };
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone.trim());
}
