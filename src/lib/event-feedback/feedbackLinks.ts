import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

/** Crockford-style alphabet without ambiguous characters (0/O, 1/l/I). */
const SMS_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const SMS_CODE_LENGTH = 8;

export function mintFeedbackToken(): string {
  return randomBytes(24).toString("hex");
}

export function mintFeedbackSmsCode(): string {
  const bytes = randomBytes(SMS_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < SMS_CODE_LENGTH; i++) {
    out += SMS_CODE_ALPHABET[bytes[i]! % SMS_CODE_ALPHABET.length];
  }
  return out;
}

type GuestFeedbackLinkRow = {
  id: string;
  feedbackToken: string | null;
  feedbackSmsCode: string | null;
};

/**
 * Ensures a guest has both the full feedback token and a short SMS code before
 * sending feedback links.
 */
export async function ensureGuestFeedbackLinkCredentials(
  guest: GuestFeedbackLinkRow
): Promise<{ token: string; smsCode: string } | null> {
  let token = guest.feedbackToken;
  let smsCode = guest.feedbackSmsCode;
  if (token && smsCode) return { token, smsCode };

  for (let attempt = 0; attempt < 8; attempt++) {
    const data: { feedbackToken?: string; feedbackSmsCode?: string } = {};
    if (!token) data.feedbackToken = mintFeedbackToken();
    if (!smsCode) data.feedbackSmsCode = mintFeedbackSmsCode();

    try {
      const updated = await prisma.guest.update({
        where: { id: guest.id },
        data,
        select: { feedbackToken: true, feedbackSmsCode: true }
      });
      if (updated.feedbackToken && updated.feedbackSmsCode) {
        return { token: updated.feedbackToken, smsCode: updated.feedbackSmsCode };
      }
    } catch {
      const refreshed = await prisma.guest.findUnique({
        where: { id: guest.id },
        select: { feedbackToken: true, feedbackSmsCode: true }
      });
      if (refreshed?.feedbackToken && refreshed.feedbackSmsCode) {
        return { token: refreshed.feedbackToken, smsCode: refreshed.feedbackSmsCode };
      }
      token = refreshed?.feedbackToken ?? token;
      smsCode = refreshed?.feedbackSmsCode ?? null;
    }
  }

  return null;
}

/**
 * Ensures an event has a stable short code for the public feedback portal (`/fb/[code]`).
 */
export async function ensureEventFeedbackShortCode(eventId: string): Promise<string | null> {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { feedbackShortCode: true }
  });
  if (existing?.feedbackShortCode) return existing.feedbackShortCode;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = mintFeedbackSmsCode();
    try {
      const updated = await prisma.event.update({
        where: { id: eventId },
        data: { feedbackShortCode: code },
        select: { feedbackShortCode: true }
      });
      if (updated.feedbackShortCode) return updated.feedbackShortCode;
    } catch {
      const refreshed = await prisma.event.findUnique({
        where: { id: eventId },
        select: { feedbackShortCode: true }
      });
      if (refreshed?.feedbackShortCode) return refreshed.feedbackShortCode;
    }
  }

  return null;
}
