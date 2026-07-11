import "server-only";

import { Role } from "@prisma/client";

import { maskEmail, maskPhone } from "@/lib/masking";
import { canViewGuestContact } from "./rbac/capabilities";

export {
  canBlastGuests,
  canEditOrgBranding,
  canExportFeedback,
  canExportGuestData,
  canImportGuests,
  canInviteFromCrm,
  canManageCheckInRoster,
  canManageCrm,
  canManageEventGuests,
  canManageEvents,
  canManageEventTeam,
  canManageIntegrations,
  canManageUsers,
  canManageWaitlist,
  canSendFeedbackBlast,
  canToggleRepPiiOverride,
  canUseCheckIn,
  canUseKioskMode,
  canUseMediaLibrary,
  canViewDeliveryReports,
  canViewEventDeliveryReport,
  canViewFeedbackAnalytics,
  canViewGuestContact,
  mayEditOrDeleteGuestRow
} from "./rbac/capabilities";

export {
  eventPiiGrantWindowHasEnded,
  isEventLinkedRole,
  isOrgWideRole,
  isPiiOverrideActive,
  isRepScopedRole,
  isSalesRepRole,
  isStaffRole,
  resolvePiiOverrideExpiresAt,
  type PiiGrantDurationHours
} from "./rbac/types";

export {
  assertEventAccess,
  getEventTeamMember,
  isPiiOverrideActiveForViewer,
  loadEventAccessContext,
  resolveActiveTeamMemberForPii,
  userHasEventAccess,
  visibleEventsWhere
} from "./rbac/eventAccess";

export {
  canExportFullGuestData,
  canExportFullGuestDataForEvent,
  canExportPrivacySafeGuestCsv,
  canViewGuestPii,
  formatEmailForViewer,
  formatPhoneForViewer,
  omitGuestFieldsForViewer,
  resolveGuestContactPolicy,
  resolveGuestExportCapability,
  toPrivacySafeExportRow
} from "./rbac/guestDataAccess";

export type { GuestExportCapability } from "./rbac/guestExport";

export { scrubFeedbackResponseForSalesRep, scrubFeedbackText } from "./rbac/feedbackPrivacy";

/** @deprecated Prefer formatEmailForViewer with EventAccessContext */
export function displayEmailForGuest(
  role: Role,
  userId: string,
  guest: { email: string | null; repId: string | null }
): string | null {
  if (!guest.email?.trim()) return null;
  return canViewGuestContact(role, userId, guest.repId) ? guest.email : maskEmail(guest.email);
}

/** @deprecated Prefer formatPhoneForViewer */
export function displayPhoneForGuest(
  role: Role,
  userId: string,
  guest: { phone: string | null; repId: string | null }
): string | null {
  if (!guest.phone) return null;
  return canViewGuestContact(role, userId, guest.repId) ? guest.phone : maskPhone(guest.phone);
}
