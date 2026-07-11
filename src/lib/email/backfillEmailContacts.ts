import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureEmailContact } from "@/lib/db/emailContact";
import { syncContactToResend } from "@/lib/email/syncContactToResend";

export type EmailContactsBackfillRowResult = {
  guestId: string;
  emailContactId?: string;
  ensure: "created" | "existing" | "skipped";
  sync: "synced" | "skipped_no_consent" | "skipped_not_attempted" | "failed";
  error?: string;
  resendContactId?: string;
};

export type EmailContactsBackfillResult = {
  scanned: number;
  ensureCreated: number;
  ensureExisting: number;
  ensureSkipped: number;
  syncSynced: number;
  syncSkippedNoConsent: number;
  syncFailed: number;
  results: EmailContactsBackfillRowResult[];
};

export type EmailContactsBackfillOptions = {
  /** Limit guests processed in this run (default 100). */
  limit?: number;
  /** Resume after this guest id (ascending). */
  cursorGuestId?: string;
  /** Only guests for this event. */
  eventId?: string;
  /** Only guests for events in this org. */
  orgId?: string;
  /** When false, only runs ensureEmailContact (no Resend calls). Default true. */
  syncToResend?: boolean;
  /** Delay between Resend API calls in ms (default 250 ≈ 4 req/s). */
  resendDelayMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Backfills local {@link EmailContact} rows for guests with email addresses,
 * then optionally syncs consented contacts to Resend.
 */
export async function runEmailContactsBackfill(
  options: EmailContactsBackfillOptions = {}
): Promise<EmailContactsBackfillResult> {
  const limit = options.limit ?? 100;
  const syncToResend = options.syncToResend ?? true;
  const resendDelayMs = options.resendDelayMs ?? 250;

  const guests = await prisma.guest.findMany({
    where: {
      email: { not: null },
      ...(options.eventId ? { eventId: options.eventId } : {}),
      ...(options.orgId ? { event: { orgId: options.orgId } } : {}),
      ...(options.cursorGuestId ? { id: { gt: options.cursorGuestId } } : {})
    },
    select: { id: true, email: true },
    orderBy: { id: "asc" },
    take: limit
  });

  const results: EmailContactsBackfillRowResult[] = [];
  let ensureCreated = 0;
  let ensureExisting = 0;
  let ensureSkipped = 0;
  let syncSynced = 0;
  let syncSkippedNoConsent = 0;
  let syncFailed = 0;

  for (const guest of guests) {
    const row: EmailContactsBackfillRowResult = {
      guestId: guest.id,
      ensure: "skipped",
      sync: "skipped_not_attempted"
    };

    if (!guest.email?.trim()) {
      ensureSkipped += 1;
      row.error = "No email";
      results.push(row);
      continue;
    }

    const ensured = await ensureEmailContact(guest.id);
    if (!ensured.ok) {
      ensureSkipped += 1;
      row.ensure = "skipped";
      row.error = ensured.error;
      results.push(row);
      continue;
    }

    row.emailContactId = ensured.contact.id;
    if (ensured.created) {
      ensureCreated += 1;
      row.ensure = "created";
    } else {
      ensureExisting += 1;
      row.ensure = "existing";
    }

    if (!syncToResend) {
      results.push(row);
      continue;
    }

    const synced = await syncContactToResend(ensured.contact.id);
    if (!synced.ok) {
      syncFailed += 1;
      row.sync = "failed";
      row.error = synced.error;
      results.push(row);
      continue;
    }

    if (synced.skipped) {
      syncSkippedNoConsent += 1;
      row.sync = "skipped_no_consent";
      row.resendContactId = synced.resendContactId;
    } else {
      syncSynced += 1;
      row.sync = "synced";
      row.resendContactId = synced.resendContactId;
      await sleep(resendDelayMs);
    }

    results.push(row);
  }

  return {
    scanned: guests.length,
    ensureCreated,
    ensureExisting,
    ensureSkipped,
    syncSynced,
    syncSkippedNoConsent,
    syncFailed,
    results
  };
}
