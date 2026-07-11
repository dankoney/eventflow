import { Role } from "@prisma/client";

import { isEventLinkedRole, isOrgWideRole, isSalesRepRole, isStaffRole } from "./types";

/** Client-safe capability checks — no database imports. */

export function canManageUsers(role: Role): boolean {
  return role === Role.ADMIN;
}

export function canManageIntegrations(role: Role): boolean {
  return role === Role.ADMIN;
}

export function canEditOrgBranding(role: Role): boolean {
  return role === Role.ADMIN;
}

export function canManageEventTeam(role: Role): boolean {
  return role === Role.ADMIN || role === Role.MARKETING;
}

export function canToggleRepPiiOverride(role: Role): boolean {
  return role === Role.ADMIN || role === Role.MARKETING;
}

export function canManageEvents(role: Role): boolean {
  return isOrgWideRole(role);
}

export function canManageCrm(role: Role): boolean {
  return isOrgWideRole(role);
}

export function canUseMediaLibrary(role: Role): boolean {
  return isOrgWideRole(role);
}

export function canExportGuestData(role: Role): boolean {
  return isOrgWideRole(role);
}

export function canBlastGuests(role: Role): boolean {
  return isOrgWideRole(role);
}

export function canManageWaitlist(role: Role): boolean {
  return isOrgWideRole(role);
}

export function canSendFeedbackBlast(role: Role): boolean {
  return isOrgWideRole(role);
}

export function canViewDeliveryReports(role: Role): boolean {
  return isOrgWideRole(role) || isSalesRepRole(role);
}

export function canViewEventDeliveryReport(role: Role): boolean {
  return canViewDeliveryReports(role);
}

export function canViewFeedbackAnalytics(role: Role): boolean {
  return isOrgWideRole(role) || isSalesRepRole(role);
}

export function canExportFeedback(role: Role): boolean {
  return isOrgWideRole(role) || isSalesRepRole(role);
}

export function canUseCheckIn(role: Role): boolean {
  return isOrgWideRole(role) || isEventLinkedRole(role);
}

export function canUseKioskMode(role: Role): boolean {
  return isOrgWideRole(role) || isStaffRole(role);
}

export function canManageCheckInRoster(role: Role): boolean {
  return isOrgWideRole(role);
}

export function canManageEventGuests(role: Role): boolean {
  return isOrgWideRole(role) || isSalesRepRole(role);
}

export function canImportGuests(role: Role): boolean {
  return isOrgWideRole(role) || isSalesRepRole(role);
}

export function canInviteFromCrm(role: Role): boolean {
  return isOrgWideRole(role);
}

export function mayEditOrDeleteGuestRow(
  role: Role,
  userId: string,
  guestRepId: string | null
): boolean {
  if (isOrgWideRole(role)) return true;
  if (isSalesRepRole(role)) return Boolean(guestRepId && guestRepId === userId);
  return false;
}

export function canViewGuestContact(
  role: Role,
  userId: string,
  guestRepId: string | null
): boolean {
  if (isOrgWideRole(role)) return true;
  if (isSalesRepRole(role)) return Boolean(guestRepId && guestRepId === userId);
  return false;
}
