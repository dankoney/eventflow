import {
  AttendMode,
  EventType,
  GuestJoinSource,
  GuestStatus,
  Tier,
  type Prisma
} from "@prisma/client";

import { newInternalCheckInToken } from "./personalLinkToken";
import type { ContactGuestSeed } from "./resolveContactsForAudience";

export async function insertContactGuestsFromDirectory(
  tx: Prisma.TransactionClient,
  eventId: string,
  eventType: EventType,
  contacts: ContactGuestSeed[],
  options?: { issuePersonalCheckInLinks?: boolean }
): Promise<number> {
  if (contacts.length === 0) return 0;

  const existingEmails = new Set(
    (await tx.guest.findMany({ where: { eventId }, select: { email: true } }))
      .map((g) => g.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e))
  );

  const mode = eventType === EventType.VIRTUAL ? AttendMode.VIRTUAL : AttendMode.IN_PERSON;
  const issueLinks = Boolean(options?.issuePersonalCheckInLinks);
  let added = 0;

  for (const row of contacts) {
    const email = row.email.trim().toLowerCase();
    if (existingEmails.has(email)) continue;
    existingEmails.add(email);

    await tx.guest.create({
      data: {
        eventId,
        name: row.name.trim(),
        email,
        phone: row.phone.trim(),
        contactId: row.id,
        staffEmployeeId: row.staffEmployeeId?.trim() || null,
        department: row.department?.trim() || undefined,
        branch: row.branch?.trim() || undefined,
        tier: Tier.C,
        mode,
        status: GuestStatus.INVITED,
        joinSource: GuestJoinSource.REGISTERED,
        qrCode: null,
        zoomLink: null,
        internalCheckInToken: issueLinks ? newInternalCheckInToken() : null
      }
    });
    added += 1;
  }

  return added;
}
