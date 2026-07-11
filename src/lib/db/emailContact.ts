import "server-only";

import type { EmailContact, EmailMarketingConsentSource, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  consentValuesForEmailContact,
  resolveMarketingConsentForGuest,
  type EnsureEmailContactConsentInput
} from "@/lib/email/marketingConsent";

export type EnsureEmailContactResult =
  | { ok: true; contact: EmailContact; created: boolean }
  | {
      ok: false;
      code: "GUEST_NOT_FOUND" | "GUEST_NO_EMAIL" | "EMAIL_ALREADY_LINKED";
      error: string;
    };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Creates or returns the {@link EmailContact} bridge row for a {@link Guest}.
 */
export async function ensureEmailContact(
  guestId: string,
  consentInput?: EnsureEmailContactConsentInput,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<EnsureEmailContactResult> {
  const existing = await db.emailContact.findUnique({ where: { guestId } });
  if (existing) {
    if (consentInput?.marketingOptIn === true) {
      const consentRecordedAt = consentInput.consentRecordedAt ?? new Date();
      const updated = await db.emailContact.update({
        where: { id: existing.id },
        data: {
          isSubscribed: true,
          consentRecordedAt,
          consentSource: consentInput.consentSource ?? existing.consentSource,
          unsubscribedAt: null,
          unsubscribeSource: null
        }
      });
      return { ok: true, contact: updated, created: false };
    }
    return { ok: true, contact: existing, created: false };
  }

  const guest = await db.guest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      email: true,
      name: true,
      rsvpConfirmedAt: true,
      createdAt: true
    }
  });

  if (!guest) {
    return { ok: false, code: "GUEST_NOT_FOUND", error: "Guest not found." };
  }

  const rawEmail = guest.email?.trim();
  if (!rawEmail) {
    return { ok: false, code: "GUEST_NO_EMAIL", error: "Guest has no email address." };
  }

  const email = normalizeEmail(rawEmail);
  const consent = resolveMarketingConsentForGuest(guest, consentInput);
  const { isSubscribed, consentRecordedAt } = consentValuesForEmailContact(consent);

  const emailOwner = await db.emailContact.findUnique({ where: { email } });
  if (emailOwner && emailOwner.guestId !== guestId) {
    return {
      ok: false,
      code: "EMAIL_ALREADY_LINKED",
      error:
        "This email is already linked to another guest's marketing contact. Resolve the duplicate guest email before creating a contact."
    };
  }

  const contact = await db.emailContact.create({
    data: {
      guestId,
      email,
      isSubscribed,
      consentRecordedAt,
      consentSource: isSubscribed ? (consentInput?.consentSource ?? null) : null
    }
  });

  return { ok: true, contact, created: true };
}

/**
 * Records marketing consent (or ensures an unsubscribed bridge row) after RSVP/register.
 */
export async function recordGuestMarketingConsent(input: {
  guestId: string;
  marketingOptIn: boolean;
  consentSource: EmailMarketingConsentSource;
}): Promise<void> {
  const result = await ensureEmailContact(input.guestId, {
    marketingOptIn: input.marketingOptIn,
    consentSource: input.consentSource
  });
  if (!result.ok && result.code !== "EMAIL_ALREADY_LINKED") {
    console.warn("[email-contact] recordGuestMarketingConsent skipped", result.code, result.error);
  }
}
