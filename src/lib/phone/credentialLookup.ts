import { z } from "zod";

import {
  composeE164,
  isValidE164,
  isValidNationalForDial,
  normalizeNationalDigits
} from "@/lib/phone/publicRegistrationPhone";

export type NormalizedCredential =
  | { ok: true; kind: "email"; value: string }
  | { ok: true; kind: "phone"; value: string }
  | { ok: false; error: string };

/** Normalize email or E.164 phone for public kiosk / feedback lookup. */
export function normalizeEmailOrPhoneCredential(raw: string): NormalizedCredential {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Enter your email or mobile number." };
  if (trimmed.includes("@")) {
    const emailParsed = z.string().email().safeParse(trimmed);
    if (!emailParsed.success) return { ok: false, error: "Enter a valid email address." };
    return { ok: true, kind: "email", value: trimmed.toLowerCase() };
  }
  let phone = trimmed.replace(/\s/g, "");
  if (!phone.startsWith("+")) {
    phone = `+${phone.replace(/\D/g, "")}`;
  }
  if (!isValidE164(phone)) {
    return {
      ok: false,
      error: "Enter a valid mobile number in international format (e.g. +233501234567)."
    };
  }
  return { ok: true, kind: "phone", value: phone };
}

/** Email or national number + dial code (feedback portal linking). */
export function normalizePortalLinkCredential(input: {
  email?: string;
  phoneDialCode?: string;
  phoneNational?: string;
}): NormalizedCredential {
  const email = input.email?.trim();
  if (email) return normalizeEmailOrPhoneCredential(email);

  const dialCode = input.phoneDialCode?.trim();
  const nationalRaw = input.phoneNational?.trim();
  if (!dialCode || !nationalRaw) {
    return { ok: false, error: "Enter your email or mobile number." };
  }

  const national = normalizeNationalDigits(nationalRaw, dialCode);
  if (!isValidNationalForDial(dialCode, national)) {
    return { ok: false, error: "Enter a valid mobile number for the selected country." };
  }

  const phone = composeE164(dialCode, national);
  if (!isValidE164(phone)) {
    return { ok: false, error: "Enter a valid mobile number." };
  }

  return { ok: true, kind: "phone", value: phone };
}
