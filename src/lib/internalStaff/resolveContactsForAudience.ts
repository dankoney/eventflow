import type { Prisma } from "@prisma/client";
import { CrmContactKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { InternalStaffAudience } from "./audience";

const contactSelect = {
  id: true,
  name: true,
  email: true,
  staffEmployeeId: true,
  department: true,
  branch: true,
  phone: true
} satisfies Prisma.OrgContactSelect;

export type ContactGuestSeed = {
  id: string;
  name: string;
  email: string;
  staffEmployeeId: string | null;
  department: string | null;
  branch: string | null;
  phone: string;
};

export async function listOrgContactsMatchingAudience(
  orgId: string,
  audience: InternalStaffAudience
): Promise<ContactGuestSeed[]> {
  const includeAll = audience.includeAllContactTypes === true;
  const base: Prisma.OrgContactWhereInput = { orgId };

  const staffWhere: Prisma.OrgContactWhereInput = includeAll ? {} : { crmKind: { in: [CrmContactKind.EMPLOYEE] } };

  switch (audience.mode) {
    case "ENTIRE_ORG": {
      const exclude = (audience.excludeCategories ?? []).map((c) => c.trim()).filter(Boolean);
      const where: Prisma.OrgContactWhereInput =
        exclude.length === 0
          ? base
          : {
              ...base,
              OR: [{ category: null }, { category: "" }, { NOT: { category: { in: exclude } } }]
            };
      const mergedWhere: Prisma.OrgContactWhereInput = includeAll ? where : { ...where, ...staffWhere };
      return prisma.orgContact.findMany({ where: mergedWhere, select: contactSelect, orderBy: { name: "asc" } });
    }
    case "DEPARTMENTS":
      return prisma.orgContact.findMany({
        where: {
          ...base,
          ...staffWhere,
          department: { in: audience.departments }
        },
        select: contactSelect,
        orderBy: { name: "asc" }
      });
    case "RANKS":
      return prisma.orgContact.findMany({
        where: {
          ...base,
          ...staffWhere,
          rank: { in: audience.ranks }
        },
        select: contactSelect,
        orderBy: { name: "asc" }
      });
    case "EMPLOYMENT_STATUS":
      return prisma.orgContact.findMany({
        where: { ...base, ...staffWhere, employmentStatus: { in: audience.employmentStatuses } },
        select: contactSelect,
        orderBy: { name: "asc" }
      });
    case "CRM_KINDS":
      return prisma.orgContact.findMany({
        where: {
          ...base,
          ...(includeAll ? {} : { crmKind: { in: [CrmContactKind.EMPLOYEE] } }),
          ...(includeAll ? { crmKind: { in: audience.crmKinds } } : {})
        },
        select: contactSelect,
        orderBy: { name: "asc" }
      });
    case "GROUPS":
      return prisma.orgContact.findMany({
        where: {
          ...base,
          ...staffWhere,
          groupMembers: { some: { groupId: { in: audience.groupIds } } }
        },
        select: contactSelect,
        orderBy: { name: "asc" }
      });
    case "MANUAL":
      return prisma.orgContact.findMany({
        where: { ...base, ...staffWhere, id: { in: audience.contactIds } },
        select: contactSelect,
        orderBy: { name: "asc" }
      });
  }
}
