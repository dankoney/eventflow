import { randomInt } from "crypto";

import bcrypt from "bcryptjs";

/** Poll OTP lifetime — long enough for SMS latency, short enough to be useful. */
export const POLL_OTP_TTL_MS = 10 * 60 * 1000;

/** Max verify attempts per row before we treat the code as burned. */
export const POLL_OTP_MAX_ATTEMPTS = 5;

/**
 * bcrypt cost factor — mirrors the cost used by NextAuth sign-in OTP records
 * (`bcrypt.compare(code, row.token)` in src/auth.ts). 10 keeps verify ≈ 60ms which is
 * well below the action SLO and unbearable for an offline brute force at 10^6 keys.
 */
const POLL_OTP_BCRYPT_COST = 10;

/** Generate a 6-digit, zero-padded numeric code from a CSPRNG. */
export function generatePollOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Hash the plaintext code at rest; the plaintext is then discarded. */
export async function hashPollOtpCode(code: string): Promise<string> {
  return bcrypt.hash(code, POLL_OTP_BCRYPT_COST);
}

/** Constant-time check against the stored hash. */
export async function verifyPollOtpCode(code: string, codeHash: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  return bcrypt.compare(code, codeHash);
}
