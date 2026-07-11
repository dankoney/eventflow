import { DEFAULT_PHONE_DIAL } from "@/lib/register/phoneDialOptions";
import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";

type NormalizePhoneResult =
  | { ok: true; phone: string }
  | {
      ok: false;
      message: string;
    };

const COUNTRY_DIAL_MAP: Record<string, string> = {
  GH: "233",
  GHA: "233",
  GHANA: "233",
  NG: "234",
  NIGERIA: "234",
  KE: "254",
  KENYA: "254",
  US: "1",
  USA: "1",
  "UNITED STATES": "1",
  CA: "1",
  CANADA: "1",
  GB: "44",
  UK: "44",
  "UNITED KINGDOM": "44"
};

function normalizeCountryCode(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "")
    .trim()
    .replace(/^\+/, "")
    .replace(/\D/g, "");
  return digits || null;
}

function inferDialCode(country: string | null | undefined, countryCode: string | null | undefined): string {
  const directCode = normalizeCountryCode(countryCode);
  if (directCode) return directCode;
  const key = (country ?? "").trim().toUpperCase();
  if (!key) return DEFAULT_PHONE_DIAL;
  return COUNTRY_DIAL_MAP[key] ?? DEFAULT_PHONE_DIAL;
}

/**
 * Import-safe phone normalizer:
 * - handles apostrophe-prefixed Excel text cells
 * - handles spaces/dashes/brackets
 * - converts 00-prefixed international numbers to +
 * - accepts plus-less values and infers country dial code
 * - catches scientific-notation corruption from spreadsheets
 */
export function normalizeImportedPhoneToE164(
  rawPhone: string | null | undefined,
  opts?: { country?: string | null; countryCode?: string | null }
): NormalizePhoneResult {
  const raw = String(rawPhone ?? "").trim();
  if (!raw) return { ok: false, message: "missing phone." };

  if (/e[+-]?\d+/i.test(raw)) {
    return {
      ok: false,
      message:
        "phone appears Excel-corrupted (scientific notation). Format this column as Text and use full digits."
    };
  }

  let v = raw.replace(/^'+/, "").trim();
  v = v.replace(/[()\-\s.]/g, "");

  if (v.startsWith("00")) v = `+${v.slice(2)}`;

  if (v.startsWith("+")) {
    const plusNorm = `+${v.slice(1).replace(/\D/g, "")}`;
    if (!isValidE164(plusNorm)) {
      return { ok: false, message: "phone must be in international format, for example +14155552671." };
    }
    return { ok: true, phone: plusNorm };
  }

  let digits = v.replace(/\D/g, "");
  if (!digits) return { ok: false, message: "missing phone digits." };
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    const usLike = `+${digits}`;
    if (isValidE164(usLike)) return { ok: true, phone: usLike };
  }

  const dial = inferDialCode(opts?.country ?? null, opts?.countryCode ?? null);
  if (digits.startsWith(dial)) {
    const alreadyInternational = `+${digits}`;
    if (isValidE164(alreadyInternational)) return { ok: true, phone: alreadyInternational };
  }

  const e164 = `+${dial}${digits}`;
  if (!isValidE164(e164)) {
    return {
      ok: false,
      message: "phone could not be normalized. Use full international format, for example +14155552671."
    };
  }
  return { ok: true, phone: e164 };
}

