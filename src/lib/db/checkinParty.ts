import { GuestStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PartyMemberRow = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  alreadyCheckedIn: boolean;
  checkedInAt: string | null;
};

/**
 * Guests in the same event guest group (table/party) for group check-in.
 * Returns empty when the guest has no group or is alone in the group.
 */
export async function listPartyMembersForGuest(
  eventId: string,
  guestId: string,
  dayIndex: number
): Promise<{ groupName: string | null; members: PartyMemberRow[] }> {
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: {
      id: true,
      eventGuestGroupId: true,
      eventGuestGroup: { select: { name: true } }
    }
  });

  if (!guest?.eventGuestGroupId) {
    return { groupName: null, members: [] };
  }

  const rows = await prisma.guest.findMany({
    where: {
      eventId,
      eventGuestGroupId: guest.eventGuestGroupId,
      status: { not: GuestStatus.DECLINED }
    },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      checkIns: {
        where: { dayIndex },
        select: { checkedInAt: true },
        take: 1
      }
    },
    orderBy: { name: "asc" }
  });

  if (rows.length <= 1) {
    return { groupName: guest.eventGuestGroup?.name ?? null, members: [] };
  }

  return {
    groupName: guest.eventGuestGroup?.name ?? null,
    members: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      company: r.company,
      alreadyCheckedIn: r.checkIns.length > 0,
      checkedInAt: r.checkIns[0]?.checkedInAt.toISOString() ?? null
    }))
  };
}
