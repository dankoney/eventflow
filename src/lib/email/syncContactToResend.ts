import "server-only";

import type { EmailContact } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  ResendMarketingApiError,
  splitDisplayName,
  upsertResendMarketingContact
} from "@/lib/email/resendMarketingClient";

export type SyncContactToResendResult =
  | {
      ok: true;
      contact: EmailContact;
      resendContactId: string;
      created: boolean;
      skipped: false;
    }
  | {
      ok: true;
      contact: EmailContact;
      skipped: true;
      reason: "CONSENT_NOT_RECORDED";
      resendContactId?: string;
    }
  | {
      ok: false;
      code:
        | "CONTACT_NOT_FOUND"
        | "RESEND_NOT_CONFIGURED"
        | "ORG_NOT_FOUND"
        | "RESEND_API_ERROR";
      error: string;
    };

/**
 * Mirrors a local {@link EmailContact} to Resend's global Contacts API.
 * Idempotent: safe to re-run; updates subscription state when the row changes.
 *
 * Contacts without {@link EmailContact.consentRecordedAt} are **not** pushed to
 * Resend (compliance guard until registration captures explicit opt-in).
 */
export async function syncContactToResend(
  emailContactId: string
): Promise<SyncContactToResendResult> {
  const row = await prisma.emailContact.findUnique({
    where: { id: emailContactId },
    include: {
      guest: {
        select: {
          name: true,
          event: {
            select: {
              org: {
                select: { id: true, resendApiKey: true }
              }
            }
          }
        }
      }
    }
  });

  if (!row) {
    return { ok: false, code: "CONTACT_NOT_FOUND", error: "Email contact not found." };
  }

  if (!row.consentRecordedAt) {
    return {
      ok: true,
      contact: row,
      skipped: true,
      reason: "CONSENT_NOT_RECORDED"
    };
  }

  const org = row.guest.event.org;
  if (!org) {
    return { ok: false, code: "ORG_NOT_FOUND", error: "Organization not found for guest." };
  }

  const apiKey = org.resendApiKey?.trim() || process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      code: "RESEND_NOT_CONFIGURED",
      error: "Resend API key is not configured for this workspace."
    };
  }

  const { firstName, lastName } = splitDisplayName(row.guest.name);

  try {
    const upserted = await upsertResendMarketingContact({
      apiKey,
      email: row.email,
      firstName,
      lastName,
      isSubscribed: row.isSubscribed,
      existingResendContactId: row.resendContactId
    });

    if (row.resendContactId === upserted.resendContactId && !upserted.created) {
      // Still PATCHed subscription state above when id was known.
    }

    const contact =
      row.resendContactId === upserted.resendContactId
        ? row
        : await prisma.emailContact.update({
            where: { id: row.id },
            data: { resendContactId: upserted.resendContactId }
          });

    return {
      ok: true,
      contact,
      resendContactId: upserted.resendContactId,
      created: upserted.created,
      skipped: false
    };
  } catch (e) {
    const message =
      e instanceof ResendMarketingApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Resend contact sync failed.";
    return { ok: false, code: "RESEND_API_ERROR", error: message };
  }
}
