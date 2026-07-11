import { Tier } from "@prisma/client";

import { getOrgContactCategoryLabels } from "@/lib/db/orgContact";
import { collectCompanyFilterOptions } from "@/lib/guests/companyNormalization";
import { extractEmailDomain } from "@/lib/guests/segmentFilters";
import { prisma } from "@/lib/prisma";

export type BroadcastEventOption = {
  id: string;
  name: string;
  date: string;
};

export type BroadcastGroupOption = {
  id: string;
  name: string;
  eventName: string;
};

export type BroadcastCompanyOption = {
  key: string;
  label: string;
  count: number;
};

export type BroadcastSegmentFilterOptions = {
  tiers: Tier[];
  groups: BroadcastGroupOption[];
  contactCategories: string[];
  companies: BroadcastCompanyOption[];
  emailDomains: string[];
};

export async function listBroadcastEventOptions(orgId: string): Promise<BroadcastEventOption[]> {
  const events = await prisma.event.findMany({
    where: { orgId },
    orderBy: { date: "desc" },
    take: 200,
    select: { id: true, name: true, date: true }
  });
  return events.map((e) => ({
    id: e.id,
    name: e.name,
    date: e.date.toISOString()
  }));
}

export async function listBroadcastSegmentFilterOptions(
  orgId: string,
  scopedEventIds: string[] | null
): Promise<BroadcastSegmentFilterOptions> {
  const guestScope: { event: { orgId: string }; eventId?: { in: string[] } } = {
    event: { orgId }
  };
  if (scopedEventIds?.length) {
    guestScope.eventId = { in: scopedEventIds };
  }

  const groupWhere = scopedEventIds?.length
    ? { eventId: { in: scopedEventIds }, event: { orgId } }
    : { event: { orgId } };

  const [groups, companyRows, domainRows, contactCategories] = await Promise.all([
    prisma.eventGuestGroup.findMany({
      where: groupWhere,
      orderBy: [{ event: { date: "desc" } }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        event: { select: { name: true } }
      },
      take: 300
    }),
    prisma.guest.findMany({
      where: {
        ...guestScope,
        OR: [{ company: { not: null } }, { contact: { company: { not: null } } }]
      },
      select: {
        company: true,
        contact: { select: { company: true } }
      },
      take: 5000
    }),
    prisma.guest.findMany({
      where: { ...guestScope, email: { not: null } },
      select: { email: true },
      take: 5000
    }),
    getOrgContactCategoryLabels(orgId)
  ]);

  const companySource = companyRows.map((row) => ({
    company: row.company ?? row.contact?.company ?? null
  }));

  const emailDomains = [
    ...new Set(
      domainRows
        .map((row) => extractEmailDomain(row.email))
        .filter((domain): domain is string => Boolean(domain))
    )
  ].sort((a, b) => a.localeCompare(b));

  return {
    tiers: [Tier.A, Tier.B, Tier.C],
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      eventName: g.event.name
    })),
    contactCategories,
    companies: collectCompanyFilterOptions(companySource),
    emailDomains
  };
}
