import type { CrmContactKind, OrgContact, Prisma, StaffEmploymentStatus } from "@prisma/client";

import { isCrmInviteableProfile } from "@/lib/crm/contactEligibility";
import { prisma } from "@/lib/prisma";

export type OrgContactListRow = Pick<
  OrgContact,
  | "id"
  | "name"
  | "staffEmployeeId"
  | "email"
  | "department"
  | "phone"
  | "hasWhatsapp"
  | "category"
  | "branch"
  | "employmentStatus"
  | "dateJoined"
  | "rank"
  | "userId"
  | "company"
  | "jobTitle"
  | "crmKind"
  | "lifecycleStage"
  | "notes"
  | "tags"
  | "linkedinUrl"
  | "website"
  | "source"
>;

const listSelect = {
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
  source: true
} satisfies Prisma.OrgContactSelect;

export async function listOrgContactRows(orgId: string): Promise<OrgContactListRow[]> {
  return prisma.orgContact.findMany({
    where: { orgId },
    select: listSelect,
    orderBy: [{ name: "asc" }, { email: "asc" }]
  });
}

export async function countOrgContacts(orgId: string): Promise<number> {
  return prisma.orgContact.count({ where: { orgId } });
}

export async function listOrgContactRowsPaged(
  orgId: string,
  skip: number,
  take: number
): Promise<OrgContactListRow[]> {
  return prisma.orgContact.findMany({
    where: { orgId },
    select: listSelect,
    orderBy: [{ name: "asc" }, { email: "asc" }],
    skip,
    take
  });
}

export type OrgContactWizardPickRow = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  rank: string | null;
  category: string | null;
  crmKind: CrmContactKind;
};

export async function listOrgContactsForWizardPick(
  orgId: string,
  take = 800
): Promise<OrgContactWizardPickRow[]> {
  return prisma.orgContact.findMany({
    where: { orgId },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      rank: true,
      category: true,
      crmKind: true
    },
    orderBy: { name: "asc" },
    take
  });
}

/** CRM rows for “invite to event” (admin/marketing). Includes group ids for client-side segment filter. */
export type OrgContactGuestInvitePickRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  jobTitle: string | null;
  department: string | null;
  branch: string | null;
  staffEmployeeId: string | null;
  groupIds: string[];
};

export async function listOrgContactsForGuestInvitePicker(
  orgId: string,
  take = 800
): Promise<OrgContactGuestInvitePickRow[]> {
  const rows = await prisma.orgContact.findMany({
    where: { orgId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      department: true,
      branch: true,
      staffEmployeeId: true,
      groupMembers: { select: { groupId: true } }
    },
    orderBy: { name: "asc" },
    take
  });
  return rows
    .map((r) => {
      const { groupMembers, ...rest } = r;
      return {
        ...rest,
        groupIds: groupMembers.map((m) => m.groupId)
      };
    })
    .filter((r) => isCrmInviteableProfile(r.email, r.phone));
}

export async function distinctOrgContactFieldValues(
  orgId: string
): Promise<{ departments: string[]; ranks: string[]; categories: string[] }> {
  const rows = await prisma.orgContact.findMany({
    where: { orgId },
    select: { department: true, rank: true, category: true }
  });
  const departments = new Set<string>();
  const ranks = new Set<string>();
  const categories = new Set<string>();
  for (const r of rows) {
    const d = r.department?.trim();
    if (d) departments.add(d);
    const rk = r.rank?.trim();
    if (rk) ranks.add(rk);
    const c = r.category?.trim();
    if (c) categories.add(c);
  }
  return {
    departments: [...departments].sort((a, b) => a.localeCompare(b)),
    ranks: [...ranks].sort((a, b) => a.localeCompare(b)),
    categories: [...categories].sort((a, b) => a.localeCompare(b))
  };
}

export function parseContactCategoryLabelsJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .slice(0, 80);
}

export async function getOrgContactCategoryLabels(orgId: string): Promise<string[]> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { contactCategoryLabels: true }
  });
  return parseContactCategoryLabelsJson(org?.contactCategoryLabels ?? null);
}

/** Returns a row if another contact in the org already uses this email or phone (excluding excludeId). */
export async function orgContactConflictsForOrg(
  orgId: string,
  email: string,
  phone: string,
  excludeId?: string
) {
  const em = email.trim().toLowerCase();
  const ph = phone.trim();
  return prisma.orgContact.findFirst({
    where: {
      orgId,
      OR: [{ email: em }, { phone: ph }],
      ...(excludeId ? { NOT: { id: excludeId } } : {})
    },
    select: { id: true, email: true, phone: true }
  });
}

export type OrgContactUpsertInput = {
  name: string;
  staffEmployeeId?: string | null;
  email: string;
  phone: string;
  company?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  hasWhatsapp: boolean;
  category?: string | null;
  branch?: string | null;
  employmentStatus: StaffEmploymentStatus;
  dateJoined: Date;
  rank?: string | null;
  crmKind?: CrmContactKind;
  lifecycleStage?: string | null;
  notes?: string | null;
  tags?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  linkedinUrl?: string | null;
  website?: string | null;
  source?: string | null;
};
