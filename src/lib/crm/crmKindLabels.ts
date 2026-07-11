import { CrmContactKind } from "@prisma/client";

export const CRM_KIND_LABELS: Record<CrmContactKind, string> = {
  ATTENDEE: "Attendee / guest",
  EMPLOYEE: "Employee / internal",
  STAKEHOLDER: "Stakeholder",
  SPONSOR: "Sponsor",
  MEDIA_PRESS: "Media / press",
  VIP: "VIP",
  VENDOR: "Vendor",
  SPEAKER: "Speaker / faculty",
  OTHER: "Other"
};

export const CRM_KIND_OPTIONS = (Object.keys(CRM_KIND_LABELS) as CrmContactKind[]).map((value) => ({
  value,
  label: CRM_KIND_LABELS[value]
}));

export function formatCrmKindLabel(kind: CrmContactKind | string | null | undefined): string | null {
  if (!kind) return null;
  return CRM_KIND_LABELS[kind as CrmContactKind] ?? String(kind);
}
