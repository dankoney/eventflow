import type { CrmContactKind, GuestStatus } from "@prisma/client";

import type { GuestWithRep } from "@/lib/db/guests";
import {
  collectCompanyFilterOptions,
  normalizeCompanyForStorage,
  type CompanyFilterOption
} from "@/lib/guests/companyNormalization";
import { extractEmailDomain } from "@/lib/guests/segmentFilters";

export type { CompanyFilterOption };

/** Row shape for export / feedback audience pickers. */
export type GuestAudienceRow = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  tier: string;
  status: GuestStatus | string;
  hasCheckedIn: boolean;
  contactCrmKind: CrmContactKind | null;
  contactCategory: string | null;
  eventGuestGroupId: string | null;
  eventGuestGroupName: string | null;
};

export function resolveGuestCompany(
  guestCompany: string | null | undefined,
  contactCompany: string | null | undefined
): string | null {
  const fromContact = normalizeCompanyForStorage(contactCompany);
  if (fromContact) return fromContact;
  return normalizeCompanyForStorage(guestCompany);
}

export function guestWithRepToAudienceRow(g: GuestWithRep): GuestAudienceRow {
  return {
    id: g.id,
    name: g.name,
    email: g.email,
    company: resolveGuestCompany(g.company, g.contactCompany),
    tier: g.tier,
    status: g.status,
    hasCheckedIn: g.checkedInAt != null,
    contactCrmKind: g.contactCrmKind,
    contactCategory: g.contactCategory,
    eventGuestGroupId: g.eventGuestGroupId,
    eventGuestGroupName: g.eventGuestGroupName
  };
}

export function collectDistinctCompanies(rows: GuestAudienceRow[]): string[] {
  return collectCompanyFilterOptions(rows).map((o) => o.label);
}

export function collectCompanyFilterOptionsFromRows(
  rows: GuestAudienceRow[]
): CompanyFilterOption[] {
  return collectCompanyFilterOptions(rows);
}

export function collectDistinctEmailDomains(rows: GuestAudienceRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const domain = extractEmailDomain(row.email);
    if (domain) set.add(domain);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
