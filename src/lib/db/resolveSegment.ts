import type { AttendMode, GuestStatus, Prisma, Tier } from "@prisma/client";

import { buildBroadcastSegmentGuestWhere } from "@/lib/email/broadcastSegmentFilters";
import {
  emailSegmentDefinitionSchema,
  parseEmailSegmentDefinition,
  type EmailSegmentDefinition
} from "@/lib/email/segmentDefinition";
import { resolveGuestCompany } from "@/lib/guests/audienceRows";
import { prisma } from "@/lib/prisma";

export type SegmentRecipient = {
  guestId: string;
  eventId: string;
  eventName: string;
  guestName: string;
  guestEmail: string;
  guestStatus: GuestStatus;
  tier: Tier;
  mode: AttendMode | null;
  emailContactId: string;
  emailContactEmail: string;
  consentRecordedAt: Date | null;
  resendContactId: string | null;
  company: string | null;
  eventGuestGroupId: string | null;
  eventGuestGroupName: string | null;
  contactCategory: string | null;
};

export type SegmentExclusionCounts = {
  /** Guest has no email address on the guest record. */
  noEmailAddress: number;
  /** Guest has an email but no EmailContact bridge row yet. */
  noEmailContact: number;
  /** EmailContact exists but isSubscribed is false. */
  unsubscribed: number;
  totalExcluded: number;
};

export type ResolveSegmentResult = {
  /** Guests matching the segment filters (before subscription filtering). */
  matchedGuestCount: number;
  /** Deliverable, subscribed recipients (isSubscribed = true). */
  recipientCount: number;
  recipients: SegmentRecipient[];
  excluded: SegmentExclusionCounts;
  /** When a preview cap was applied to the recipients array. */
  previewLimitApplied: number | null;
};

export type ResolveSegmentOptions = {
  /** Cap how many recipient rows are returned (counts are still full totals). */
  previewLimit?: number;
};

const guestSelect = {
  id: true,
  eventId: true,
  name: true,
  email: true,
  status: true,
  tier: true,
  mode: true,
  company: true,
  eventGuestGroupId: true,
  event: { select: { name: true } },
  eventGuestGroup: { select: { name: true } },
  contact: { select: { category: true, company: true } },
  emailContact: {
    select: {
      id: true,
      email: true,
      isSubscribed: true,
      consentRecordedAt: true,
      resendContactId: true
    }
  }
} satisfies Prisma.GuestSelect;

type GuestSegmentRow = Prisma.GuestGetPayload<{ select: typeof guestSelect }>;

function guestHasEmail(guest: { email: string | null }): boolean {
  return Boolean(guest.email?.trim());
}

function hasDeliverableEmailWhere(): Prisma.GuestWhereInput {
  return {
    OR: [{ email: { not: null, notIn: [""] } }, { emailContact: { isNot: null } }]
  };
}

function partitionMatchedGuests(guests: GuestSegmentRow[]) {
  const recipients: GuestSegmentRow[] = [];
  let noEmailAddress = 0;
  let noEmailContact = 0;
  let unsubscribed = 0;

  for (const guest of guests) {
    const contact = guest.emailContact;

    if (!guestHasEmail(guest) && !contact?.email?.trim()) {
      noEmailAddress += 1;
      continue;
    }

    if (!contact) {
      noEmailContact += 1;
      continue;
    }

    if (!contact.isSubscribed) {
      unsubscribed += 1;
      continue;
    }

    recipients.push(guest);
  }

  return {
    recipients,
    excluded: {
      noEmailAddress,
      noEmailContact,
      unsubscribed,
      totalExcluded: noEmailAddress + noEmailContact + unsubscribed
    }
  };
}

function toSegmentRecipient(guest: GuestSegmentRow): SegmentRecipient {
  const contact = guest.emailContact!;
  return {
    guestId: guest.id,
    eventId: guest.eventId,
    eventName: guest.event.name,
    guestName: guest.name,
    guestEmail: guest.email?.trim() || contact.email,
    guestStatus: guest.status,
    tier: guest.tier,
    mode: guest.mode,
    emailContactId: contact.id,
    emailContactEmail: contact.email,
    consentRecordedAt: contact.consentRecordedAt,
    resendContactId: contact.resendContactId,
    company: resolveGuestCompany(guest.company, guest.contact?.company ?? null),
    eventGuestGroupId: guest.eventGuestGroupId,
    eventGuestGroupName: guest.eventGuestGroup?.name ?? null,
    contactCategory: guest.contact?.category ?? null
  };
}

function parseDefinitionInput(definitionInput: EmailSegmentDefinition | unknown): EmailSegmentDefinition {
  if (typeof definitionInput === "object" && definitionInput !== null && "orgId" in definitionInput) {
    return emailSegmentDefinitionSchema.parse(definitionInput);
  }
  return parseEmailSegmentDefinition(definitionInput);
}

/**
 * Resolves a broadcast segment locally from guest / CRM data, joined to EmailContact.
 * Only returns recipients where EmailContact.isSubscribed is true.
 */
export async function resolveSegment(
  definitionInput: EmailSegmentDefinition | unknown,
  options?: ResolveSegmentOptions
): Promise<ResolveSegmentResult> {
  const definition = parseDefinitionInput(definitionInput);
  const baseWhere = await buildBroadcastSegmentGuestWhere(definition);

  const matchedGuestCount = await prisma.guest.count({ where: baseWhere });

  const [noEmailAddress, noEmailContact, unsubscribed, subscribedGuests] = await Promise.all([
    prisma.guest.count({
      where: {
        AND: [baseWhere, { OR: [{ email: null }, { email: "" }] }, { emailContact: null }]
      }
    }),
    prisma.guest.count({
      where: {
        AND: [baseWhere, hasDeliverableEmailWhere(), { emailContact: null }]
      }
    }),
    prisma.guest.count({
      where: {
        AND: [baseWhere, { emailContact: { is: { isSubscribed: false } } }]
      }
    }),
    prisma.guest.findMany({
      where: {
        AND: [baseWhere, { emailContact: { is: { isSubscribed: true } } }]
      },
      select: guestSelect,
      orderBy: [{ event: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
      ...(options?.previewLimit ? { take: options.previewLimit } : {})
    })
  ]);

  const recipientCount = await prisma.guest.count({
    where: {
      AND: [baseWhere, { emailContact: { is: { isSubscribed: true } } }]
    }
  });

  const totalExcluded = matchedGuestCount - recipientCount;

  return {
    matchedGuestCount,
    recipientCount,
    recipients: subscribedGuests.map(toSegmentRecipient),
    excluded: {
      noEmailAddress,
      noEmailContact,
      unsubscribed,
      totalExcluded
    },
    previewLimitApplied: options?.previewLimit && recipientCount > options.previewLimit ? options.previewLimit : null
  };
}

/** In-memory partition helper — useful for tests and client-side previews. */
export function partitionGuestsForSegment(guests: GuestSegmentRow[]): {
  recipients: SegmentRecipient[];
  excluded: SegmentExclusionCounts;
} {
  const { recipients, excluded } = partitionMatchedGuests(guests);
  return {
    recipients: recipients.map(toSegmentRecipient),
    excluded
  };
}
