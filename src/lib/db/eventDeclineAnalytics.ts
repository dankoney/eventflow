import { GuestStatus, RsvpDeclineReason } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type DeclineReasonCount = {
  reason: RsvpDeclineReason;
  count: number;
  label: string;
};

const REASON_LABEL: Record<RsvpDeclineReason, string> = {
  SCHEDULING_CONFLICT: "Scheduling conflict",
  NOT_RELEVANT: "Not relevant to role",
  OUT_OF_OFFICE: "Out of office / leave",
  PREFER_VIRTUAL_ONLY: "Prefer virtual only",
  OTHER: "Other"
};

export async function getEventDeclineReasonCounts(
  eventId: string,
  orgId: string
): Promise<DeclineReasonCount[]> {
  const ok = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true }
  });
  if (!ok) return [];

  const rows = await prisma.guest.groupBy({
    by: ["declineReason"],
    where: {
      eventId,
      status: GuestStatus.DECLINED,
      declineReason: { not: null }
    },
    _count: { id: true }
  });

  const out: DeclineReasonCount[] = [];
  for (const r of rows) {
    if (!r.declineReason) continue;
    out.push({
      reason: r.declineReason,
      count: r._count.id,
      label: REASON_LABEL[r.declineReason]
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}
