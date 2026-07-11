import {
  EmailCampaignRecipientStatus,
  EmailUnsubscribeSource,
  type Prisma
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ResendWebhookEnvelope = {
  type: string;
  created_at?: string;
  data?: Record<string, unknown>;
};

const EMAIL_ENGAGEMENT_EVENTS = new Set([
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.opened",
  "email.clicked"
]);

const CONTACT_UNSUBSCRIBE_EVENTS = new Set(["contact.updated", "contact.deleted", "email.suppressed"]);

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function parseEventTime(envelope: ResendWebhookEnvelope): Date {
  const fromEnvelope = envelope.created_at ? Date.parse(envelope.created_at) : NaN;
  if (!Number.isNaN(fromEnvelope)) return new Date(fromEnvelope);
  const dataCreated = envelope.data?.created_at;
  if (typeof dataCreated === "string") {
    const parsed = Date.parse(dataCreated);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return new Date();
}

function extractEmailId(data: Record<string, unknown> | undefined): string | null {
  return asString(data?.email_id ?? data?.emailId);
}

function extractRecipientEmails(data: Record<string, unknown> | undefined): string[] {
  const to = data?.to;
  if (!Array.isArray(to)) return [];
  return to.map((v) => asString(v)).filter((v): v is string => Boolean(v));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Append-only audit log — always called before derived state updates.
 */
export async function logResendEmailEvent(
  envelope: ResendWebhookEnvelope,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
  const row = await db.emailEvent.create({
    data: {
      eventType: envelope.type,
      resendEmailId: extractEmailId(envelope.data),
      payload: envelope as Prisma.InputJsonValue
    }
  });
  return row.id;
}

async function unsubscribeEmailContact(
  lookup: { email?: string | null; resendContactId?: string | null },
  source: EmailUnsubscribeSource,
  at: Date,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  const email = lookup.email ? normalizeEmail(lookup.email) : null;
  const resendContactId = asString(lookup.resendContactId);

  const contact = await db.emailContact.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(resendContactId ? [{ resendContactId }] : [])
      ]
    }
  });

  if (!contact) return false;

  if (!contact.isSubscribed && contact.unsubscribedAt) {
    return true;
  }

  await db.emailContact.update({
    where: { id: contact.id },
    data: {
      isSubscribed: false,
      unsubscribedAt: at,
      unsubscribeSource: source
    }
  });
  return true;
}

function statusForEmailEvent(eventType: string): EmailCampaignRecipientStatus | null {
  switch (eventType) {
    case "email.sent":
      return EmailCampaignRecipientStatus.SENT;
    case "email.delivered":
      return EmailCampaignRecipientStatus.DELIVERED;
    case "email.bounced":
      return EmailCampaignRecipientStatus.BOUNCED;
    case "email.complained":
      return EmailCampaignRecipientStatus.COMPLAINED;
    case "email.opened":
      return EmailCampaignRecipientStatus.OPENED;
    case "email.clicked":
      return EmailCampaignRecipientStatus.CLICKED;
    default:
      return null;
  }
}

const STATUS_RANK: Record<EmailCampaignRecipientStatus, number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  OPENED: 3,
  CLICKED: 4,
  BOUNCED: 5,
  COMPLAINED: 6,
  SKIPPED_UNSUBSCRIBED: 7
};

async function updateCampaignRecipientForEmailEvent(
  eventType: string,
  emailId: string,
  at: Date,
  recipientEmails: string[],
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<{ updated: boolean; emailContactId?: string }> {
  const nextStatus = statusForEmailEvent(eventType);
  if (!nextStatus) return { updated: false };

  let recipient = await db.emailCampaignRecipient.findUnique({
    where: { resendEmailId: emailId },
    select: { id: true, status: true, emailContactId: true }
  });

  if (!recipient && recipientEmails.length > 0) {
    const normalized = normalizeEmail(recipientEmails[0]!);
    recipient = await db.emailCampaignRecipient.findFirst({
      where: {
        resendEmailId: null,
        emailContact: { email: normalized },
        campaign: {
          status: { in: ["SENDING", "SENT", "SCHEDULED"] },
          resendBroadcastId: { not: null }
        }
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, emailContactId: true }
    });

    if (recipient) {
      await db.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data: { resendEmailId: emailId }
      });
    }
  }

  if (!recipient) return { updated: false };

  const currentRank = STATUS_RANK[recipient.status];
  const nextRank = STATUS_RANK[nextStatus];
  const shouldAdvanceStatus = nextRank >= currentRank;

  const patch: Prisma.EmailCampaignRecipientUpdateInput = {};
  if (shouldAdvanceStatus) {
    patch.status = nextStatus;
  }
  if (eventType === "email.sent" && !shouldAdvanceStatus && recipient.status === EmailCampaignRecipientStatus.PENDING) {
    patch.status = EmailCampaignRecipientStatus.SENT;
  }

  if (eventType === "email.sent" || eventType === "email.delivered") {
    if (eventType === "email.sent") patch.sentAt = at;
    if (eventType === "email.delivered") patch.deliveredAt = at;
  } else if (eventType === "email.bounced") {
    patch.bouncedAt = at;
  } else if (eventType === "email.opened") {
    patch.openedAt = at;
  } else if (eventType === "email.clicked") {
    patch.firstClickedAt = at;
  }

  if (Object.keys(patch).length === 0) {
    return { updated: false, emailContactId: recipient.emailContactId };
  }

  await db.emailCampaignRecipient.update({
    where: { id: recipient.id },
    data: patch
  });

  return { updated: true, emailContactId: recipient.emailContactId };
}

async function handleContactUnsubscribeEvent(
  envelope: ResendWebhookEnvelope,
  at: Date,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  const data = envelope.data ?? {};

  if (envelope.type === "contact.updated") {
    if (!asBool(data.unsubscribed)) return false;
    return unsubscribeEmailContact(
      {
        email: asString(data.email),
        resendContactId: asString(data.id)
      },
      EmailUnsubscribeSource.EMAIL_LINK,
      at,
      db
    );
  }

  if (envelope.type === "contact.deleted" || envelope.type === "email.suppressed") {
    const emails = extractRecipientEmails(data);
    const email = asString(data.email) ?? emails[0] ?? null;
    return unsubscribeEmailContact(
      {
        email,
        resendContactId: asString(data.id ?? data.contact_id)
      },
      EmailUnsubscribeSource.EMAIL_LINK,
      at,
      db
    );
  }

  return false;
}

async function handleEmailEngagementEvent(
  envelope: ResendWebhookEnvelope,
  at: Date,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<{ recipientUpdated: boolean; contactUnsubscribed: boolean }> {
  const emailId = extractEmailId(envelope.data);
  if (!emailId) return { recipientUpdated: false, contactUnsubscribed: false };

  const emails = extractRecipientEmails(envelope.data);
  const { updated, emailContactId } = await updateCampaignRecipientForEmailEvent(
    envelope.type,
    emailId,
    at,
    emails,
    db
  );

  let contactUnsubscribed = false;
  if (envelope.type === "email.complained") {
    const contact = emailContactId
      ? await db.emailContact.findUnique({ where: { id: emailContactId } })
      : null;
    contactUnsubscribed = await unsubscribeEmailContact(
      {
        email: contact?.email ?? emails[0] ?? null,
        resendContactId: contact?.resendContactId ?? null
      },
      EmailUnsubscribeSource.EMAIL_LINK,
      at,
      db
    );
  }

  return { recipientUpdated: updated, contactUnsubscribed };
}

/**
 * Dispatch a verified Resend webhook envelope. Caller must verify the signature first.
 * Logs to {@link EmailEvent} before mutating contacts/recipients.
 */
export async function processResendWebhook(
  envelope: ResendWebhookEnvelope
): Promise<{
  loggedEventId: string;
  contactUnsubscribed: boolean;
  recipientUpdated: boolean;
}> {
  const at = parseEventTime(envelope);

  return prisma.$transaction(async (tx) => {
    const loggedEventId = await logResendEmailEvent(envelope, tx);

    let contactUnsubscribed = false;
    let recipientUpdated = false;

    if (CONTACT_UNSUBSCRIBE_EVENTS.has(envelope.type)) {
      contactUnsubscribed = await handleContactUnsubscribeEvent(envelope, at, tx);
    }

    if (EMAIL_ENGAGEMENT_EVENTS.has(envelope.type)) {
      const result = await handleEmailEngagementEvent(envelope, at, tx);
      recipientUpdated = result.recipientUpdated;
      contactUnsubscribed = contactUnsubscribed || result.contactUnsubscribed;
    }

    return { loggedEventId, contactUnsubscribed, recipientUpdated };
  });
}
