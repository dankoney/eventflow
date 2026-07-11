import { CrmContactKind, GuestStatus, Tier, type Prisma } from "@prisma/client";

import { normalizeCompanyKey } from "@/lib/guests/companyNormalization";

/** Sentinel for guests not assigned to any event group. */
export const SEGMENT_GROUP_UNGROUPED = "__UNGROUPED__" as const;

export type SegmentFilterMode = "include" | "exclude";

/** Physical check-in presence (has at least one check-in record). */
export type SegmentCheckInPresence = "checked_in" | "not_checked_in";

export type GuestSegmentFilterInput = {
  mode: SegmentFilterMode;
  /** Tier values (A/B/C) — shown as "Guest category" in the UI. */
  tiers?: Tier[];
  /** Guest lifecycle status (INVITED, REGISTERED, CHECKED_IN, etc.). */
  statuses?: GuestStatus[];
  /** Filter by whether the guest has checked in at least once. */
  checkInPresence?: SegmentCheckInPresence[];
  /** EventGuestGroup ids, or {@link SEGMENT_GROUP_UNGROUPED}. */
  groupIds?: string[];
  /** Org CRM contact categories (from linked OrgContact). */
  contactCategories?: string[];
  /** CRM contact type (crmKind), e.g. EMPLOYEE. */
  crmKinds?: CrmContactKind[];
  /** Normalized company keys (see {@link normalizeCompanyKey}). */
  companies?: string[];
  /** Email domain (part after @), e.g. acme.com */
  emailDomains?: string[];
};

export type GuestSegmentRow = {
  tier: Tier | string;
  status?: GuestStatus | string;
  /** True when guest has at least one check-in record. */
  hasCheckedIn?: boolean;
  eventGuestGroupId: string | null;
  contactCategory?: string | null;
  contactCrmKind?: CrmContactKind | null;
  company?: string | null;
  email?: string | null;
};

export const EMPTY_SEGMENT_FILTER: GuestSegmentFilterInput = {
  mode: "include",
  tiers: [],
  statuses: [],
  checkInPresence: [],
  groupIds: [],
  contactCategories: [],
  crmKinds: [],
  companies: [],
  emailDomains: []
};

export function extractEmailDomain(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  const domain = value.split("@").pop()?.trim();
  return domain || null;
}

export function segmentFilterIsActive(filter: GuestSegmentFilterInput): boolean {
  return (
    (filter.tiers?.length ?? 0) > 0 ||
    (filter.statuses?.length ?? 0) > 0 ||
    (filter.checkInPresence?.length ?? 0) > 0 ||
    (filter.groupIds?.length ?? 0) > 0 ||
    (filter.contactCategories?.length ?? 0) > 0 ||
    (filter.crmKinds?.length ?? 0) > 0 ||
    (filter.companies?.length ?? 0) > 0 ||
    (filter.emailDomains?.length ?? 0) > 0
  );
}

function matchesDimension<T extends string>(
  selected: T[] | undefined,
  value: T | null | undefined,
  normalize: (v: string) => string = (v) => v
): boolean {
  if (!selected?.length) return true;
  const norm = value ? normalize(String(value)) : "";
  return selected.some((s) => normalize(String(s)) === norm);
}

function matchesGroupDimension(
  selected: string[] | undefined,
  groupId: string | null | undefined
): boolean {
  if (!selected?.length) return true;
  const wantsUngrouped = selected.includes(SEGMENT_GROUP_UNGROUPED);
  if (!groupId) return wantsUngrouped;
  return selected.includes(groupId);
}

/** Client-side filter for guest list rows (export UI, previews). */
export function guestMatchesSegmentFilter(row: GuestSegmentRow, filter: GuestSegmentFilterInput): boolean {
  if (!segmentFilterIsActive(filter)) return true;

  const tierMatch = matchesDimension(filter.tiers, row.tier as Tier);
  const statusMatch = matchesDimension(filter.statuses, row.status as GuestStatus | undefined);
  const checkInMatch = matchesCheckInPresence(filter.checkInPresence, row.hasCheckedIn);
  const groupMatch = matchesGroupDimension(filter.groupIds, row.eventGuestGroupId);
  const categoryMatch = matchesDimension(
    filter.contactCategories,
    row.contactCategory,
    (v) => v.trim().toLowerCase()
  );
  const crmKindMatch = matchesDimension(filter.crmKinds, row.contactCrmKind ?? undefined);
  const companyMatch = matchesDimension(filter.companies, row.company, normalizeCompanyKey);
  const domainMatch = matchesDimension(
    filter.emailDomains,
    extractEmailDomain(row.email),
    (v) => v.trim().toLowerCase()
  );

  const matched =
    tierMatch && statusMatch && checkInMatch && groupMatch && categoryMatch && crmKindMatch && companyMatch && domainMatch;
  return filter.mode === "include" ? matched : !matched;
}

function matchesCheckInPresence(
  selected: SegmentCheckInPresence[] | undefined,
  hasCheckedIn: boolean | undefined
): boolean {
  if (!selected?.length) return true;
  const checkedIn = Boolean(hasCheckedIn);
  return selected.some((value) => (value === "checked_in" ? checkedIn : !checkedIn));
}

/** Prisma where fragment for server-side guest queries. */
export function buildGuestSegmentPrismaWhere(
  filter: GuestSegmentFilterInput
): Prisma.GuestWhereInput | undefined {
  if (!segmentFilterIsActive(filter)) return undefined;

  const parts: Prisma.GuestWhereInput[] = [];

  if (filter.tiers?.length) {
    parts.push({ tier: { in: filter.tiers } });
  }

  if (filter.statuses?.length) {
    parts.push({ status: { in: filter.statuses } });
  }

  if (filter.checkInPresence?.length === 1) {
    const [presence] = filter.checkInPresence;
    if (presence === "checked_in") {
      parts.push({ checkIns: { some: {} } });
    } else if (presence === "not_checked_in") {
      parts.push({ checkIns: { none: {} } });
    }
  } else if (filter.checkInPresence?.length === 2) {
    // both selected — no narrowing
  }

  if (filter.groupIds?.length) {
    const ids = filter.groupIds.filter((id) => id !== SEGMENT_GROUP_UNGROUPED);
    const wantsUngrouped = filter.groupIds.includes(SEGMENT_GROUP_UNGROUPED);
    if (ids.length && wantsUngrouped) {
      parts.push({
        OR: [{ eventGuestGroupId: { in: ids } }, { eventGuestGroupId: null }]
      });
    } else if (ids.length) {
      parts.push({ eventGuestGroupId: { in: ids } });
    } else if (wantsUngrouped) {
      parts.push({ eventGuestGroupId: null });
    }
  }

  if (filter.contactCategories?.length) {
    const cats = filter.contactCategories.map((c) => c.trim()).filter(Boolean);
    if (cats.length) {
      parts.push({
        contact: {
          category: { in: cats, mode: "insensitive" }
        }
      });
    }
  }

  if (filter.crmKinds?.length) {
    parts.push({
      contact: { crmKind: { in: filter.crmKinds } }
    });
  }

  if (filter.companies?.length) {
    const keys = filter.companies.map((c) => c.trim()).filter(Boolean);
    if (keys.length) {
      parts.push({
        OR: keys.map((key) => companyKeyToPrismaWhere(key))
      });
    }
  }

  if (filter.emailDomains?.length) {
    const domains = filter.emailDomains.map((d) => d.trim().toLowerCase()).filter(Boolean);
    if (domains.length) {
      parts.push({
        OR: domains.map((domain) => ({
          email: { endsWith: `@${domain}`, mode: "insensitive" as const }
        }))
      });
    }
  }

  if (parts.length === 0) return undefined;

  const combined: Prisma.GuestWhereInput =
    parts.length === 1 ? (parts[0] as Prisma.GuestWhereInput) : { AND: parts };

  return filter.mode === "include" ? combined : { NOT: combined };
}

/** Loose server match for a normalized company key (word overlap). */
function companyKeyToPrismaWhere(key: string): Prisma.GuestWhereInput {
  const words = key.split(" ").filter((w) => w.length > 2);
  if (words.length === 0) {
    return {
      OR: [
        { company: { equals: key, mode: "insensitive" } },
        { contact: { company: { equals: key, mode: "insensitive" } } }
      ]
    };
  }
  return {
    AND: words.map((word) => ({
      OR: [
        { company: { contains: word, mode: "insensitive" } },
        { contact: { company: { contains: word, mode: "insensitive" } } }
      ]
    }))
  };
}

export function mergeGuestWhereWithSegment(
  base: Prisma.GuestWhereInput,
  filter: GuestSegmentFilterInput
): Prisma.GuestWhereInput {
  const segment = buildGuestSegmentPrismaWhere(filter);
  if (!segment) return base;
  return { AND: [base, segment] };
}
