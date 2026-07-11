import type { CrmContactKind, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { OrgContactListRow } from "./orgContact";

export type CrmEventPickerRow = {
  id: string;
  name: string;
  date: Date;
};

export type OrgContactGroupListRow = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  memberCount: number;
};

export type CrmHubContactRow = OrgContactListRow & {
  guestCount: number;
  groups: { id: string; name: string; color: string | null }[];
};

export type CrmHubSortField =
  | "name"
  | "email"
  | "company"
  | "crmKind"
  | "lifecycleStage"
  | "source"
  | "updatedAt";

export type CrmHubFilters = {
  q?: string;
  crmKind?: CrmContactKind;
  groupId?: string;
  sortBy?: CrmHubSortField;
  sortDir?: "asc" | "desc";
};

function orderByForHub(
  sortBy: CrmHubSortField | undefined,
  sortDir: "asc" | "desc" | undefined
): Prisma.OrgContactOrderByWithRelationInput[] {
  const dir = sortDir === "asc" ? "asc" : "desc";
  switch (sortBy) {
    case "name":
      return [{ name: dir }, { email: "asc" }];
    case "email":
      return [{ email: dir }, { name: "asc" }];
    case "company":
      return [{ company: dir }, { name: "asc" }];
    case "crmKind":
      return [{ crmKind: dir }, { name: "asc" }];
    case "lifecycleStage":
      return [{ lifecycleStage: dir }, { name: "asc" }];
    case "source":
      return [{ source: dir }, { name: "asc" }];
    case "updatedAt":
      return [{ updatedAt: dir }, { name: "asc" }];
    default:
      return [{ updatedAt: "desc" }, { name: "asc" }];
  }
}

function buildContactWhere(orgId: string, filters: CrmHubFilters): Prisma.OrgContactWhereInput {
  const q = filters.q?.trim();
  const parts: Prisma.OrgContactWhereInput[] = [{ orgId }];
  if (filters.crmKind) {
    parts.push({ crmKind: filters.crmKind });
  }
  if (filters.groupId) {
    parts.push({ groupMembers: { some: { groupId: filters.groupId } } });
  }
  if (q) {
    parts.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
        { jobTitle: { contains: q, mode: "insensitive" } },
        { department: { contains: q, mode: "insensitive" } },
        { staffEmployeeId: { contains: q, mode: "insensitive" } }
      ]
    });
  }
  return { AND: parts };
}

const hubSelect = {
  id: true,
  name: true,
  staffEmployeeId: true,
  email: true,
  department: true,
  phone: true,
  hasWhatsapp: true,
  category: true,
  branch: true,
  employmentStatus: true,
  dateJoined: true,
  rank: true,
  userId: true,
  company: true,
  jobTitle: true,
  crmKind: true,
  lifecycleStage: true,
  notes: true,
  tags: true,
  linkedinUrl: true,
  website: true,
  source: true,
  _count: { select: { guests: true } },
  groupMembers: {
    select: {
      group: { select: { id: true, name: true, color: true } }
    }
  }
} satisfies Prisma.OrgContactSelect;

export async function countCrmHubContacts(orgId: string, filters: CrmHubFilters): Promise<number> {
  return prisma.orgContact.count({ where: buildContactWhere(orgId, filters) });
}

export async function listCrmHubContactsPage(
  orgId: string,
  filters: CrmHubFilters,
  skip: number,
  take: number
): Promise<CrmHubContactRow[]> {
  const rows = await prisma.orgContact.findMany({
    where: buildContactWhere(orgId, filters),
    select: hubSelect,
    orderBy: orderByForHub(filters.sortBy, filters.sortDir),
    skip,
    take
  });
  return rows.map((r) => {
    const { _count, groupMembers, ...rest } = r;
    return {
      ...rest,
      guestCount: _count.guests,
      groups: groupMembers.map((m) => m.group)
    };
  });
}

export async function listEventsForCrmPicker(orgId: string): Promise<CrmEventPickerRow[]> {
  return prisma.event.findMany({
    where: { orgId },
    orderBy: { date: "desc" },
    take: 200,
    select: { id: true, name: true, date: true }
  });
}

export async function listOrgContactGroupsForOrg(orgId: string): Promise<OrgContactGroupListRow[]> {
  const groups = await prisma.orgContactGroup.findMany({
    where: { orgId },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      _count: { select: { members: true } }
    },
    orderBy: { name: "asc" }
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    color: g.color,
    memberCount: g._count.members
  }));
}
