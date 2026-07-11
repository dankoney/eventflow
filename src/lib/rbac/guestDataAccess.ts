import { Role } from "@prisma/client";

import { maskEmail, maskPhone } from "@/lib/masking";

import { isPiiOverrideActiveForViewer } from "./eventAccess";
import type { GuestExportCapability } from "./guestExport";
import {
  isOrgWideRole,
  isSalesRepRole,
  isStaffRole,
  type EventAccessContext,
  type GuestPiiRecord,
  type ViewerContext
} from "./types";

export type GuestContactFieldPolicy = "full" | "masked" | "hidden";

export function resolveGuestContactPolicy(
  viewer: ViewerContext,
  guest: GuestPiiRecord,
  access: EventAccessContext
): GuestContactFieldPolicy {
  if (isOrgWideRole(viewer.role)) return "full";

  if (isStaffRole(viewer.role)) {
    const sessionMatch =
      Boolean(viewer.sessionId) &&
      guest.staffVisibleSessionId === viewer.sessionId &&
      guest.createdByUserId === viewer.userId;
    return sessionMatch ? "full" : "hidden";
  }

  if (isSalesRepRole(viewer.role)) {
    if (guest.repId === viewer.userId) return "full";
    if (isPiiOverrideActiveForViewer(access.teamMember)) return "full";
    return "masked";
  }

  return "hidden";
}

export function canViewGuestPii(
  viewer: ViewerContext,
  guest: GuestPiiRecord,
  access: EventAccessContext
): boolean {
  return resolveGuestContactPolicy(viewer, guest, access) === "full";
}

export function formatEmailForViewer(
  viewer: ViewerContext,
  guest: GuestPiiRecord,
  access: EventAccessContext
): string | null {
  if (!guest.email?.trim()) return null;
  const policy = resolveGuestContactPolicy(viewer, guest, access);
  if (policy === "hidden") return null;
  if (policy === "full") return guest.email;
  return maskEmail(guest.email);
}

export function formatPhoneForViewer(
  viewer: ViewerContext,
  guest: GuestPiiRecord,
  access: EventAccessContext
): string | null {
  if (!guest.phone?.trim()) return null;
  const policy = resolveGuestContactPolicy(viewer, guest, access);
  if (policy === "hidden") return null;
  if (policy === "full") return guest.phone;
  return maskPhone(guest.phone);
}

/** Strip sensitive guest fields for Staff and partially for Sales Rep responses. */
export function omitGuestFieldsForViewer<T extends Record<string, unknown>>(
  viewer: ViewerContext,
  row: T,
  access: EventAccessContext
): T {
  const guest: GuestPiiRecord = {
    id: String(row.id ?? ""),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    repId: (row.repId as string | null) ?? null,
    createdByUserId: (row.createdByUserId as string | null) ?? null,
    staffVisibleSessionId: (row.staffVisibleSessionId as string | null) ?? null
  };

  const email = formatEmailForViewer(viewer, guest, access);
  const phone = formatPhoneForViewer(viewer, guest, access);
  const contactsRedacted = !canViewGuestPii(viewer, guest, access);

  const out: Record<string, unknown> = {
    ...row,
    email,
    phone,
    contactsRedacted
  };

  if (isStaffRole(viewer.role)) {
    delete out.tier;
    delete out.repId;
    delete out.repName;
    delete out.repEmail;
    delete out.contactCategory;
    delete out.contactCrmKind;
    delete out.openZoomJoinUrl;
  }

  if (isSalesRepRole(viewer.role) && !canViewGuestPii(viewer, guest, access)) {
    delete out.openZoomJoinUrl;
  }

  return out as T;
}

export function canExportFullGuestData(viewer: Pick<ViewerContext, "role">): boolean {
  return viewer.role === Role.ADMIN || viewer.role === Role.MARKETING;
}

export function canExportPrivacySafeGuestCsv(
  viewer: Pick<ViewerContext, "role">,
  access: EventAccessContext
): boolean {
  if (viewer.role === Role.ADMIN || viewer.role === Role.MARKETING) return false;
  if (viewer.role === Role.SALES_REP) {
    return !isPiiOverrideActiveForViewer(access.teamMember);
  }
  return false;
}

export function canExportFullGuestDataForEvent(
  viewer: Pick<ViewerContext, "role">,
  access: EventAccessContext
): boolean {
  if (canExportFullGuestData(viewer)) return true;
  if (viewer.role === Role.SALES_REP && isPiiOverrideActiveForViewer(access.teamMember)) {
    return true;
  }
  return false;
}

export type { GuestExportCapability } from "./guestExport";

export function resolveGuestExportCapability(
  viewer: Pick<ViewerContext, "role">,
  access: EventAccessContext
): GuestExportCapability {
  if (canExportFullGuestDataForEvent(viewer, access)) return "full";
  if (canExportPrivacySafeGuestCsv(viewer, access)) return "privacy_safe";
  return "none";
}

export type PrivacySafeGuestExportRow = {
  name: string;
  company: string | null;
  jobTitle: string | null;
  tier: string;
};

export function toPrivacySafeExportRow(guest: {
  name: string;
  company: string | null;
  jobTitle: string | null;
  tier: string;
}): PrivacySafeGuestExportRow {
  return {
    name: guest.name,
    company: guest.company,
    jobTitle: guest.jobTitle,
    tier: guest.tier
  };
}
