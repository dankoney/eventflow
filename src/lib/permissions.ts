import { Role } from "@prisma/client";

import { maskEmail, maskPhone } from "@/lib/masking";

export function isRepScopedRole(role: Role): boolean {
  return role === Role.STAFF || role === Role.SALES_REF;
}

export function canExportGuestData(role: Role): boolean {
  return role === Role.ADMIN || role === Role.MARKETING;
}

/** Full PII for guest contacts (email/phone) visible in UI and exports. */
export function canViewGuestContact(role: Role, userId: string, guestRepId: string | null): boolean {
  if (role === Role.ADMIN || role === Role.MARKETING) return true;
  if (isRepScopedRole(role)) return !!guestRepId && guestRepId === userId;
  return false;
}

export function displayEmailForGuest(
  role: Role,
  userId: string,
  guest: { email: string; repId: string | null }
): string {
  return canViewGuestContact(role, userId, guest.repId) ? guest.email : maskEmail(guest.email);
}

export function displayPhoneForGuest(
  role: Role,
  userId: string,
  guest: { phone: string | null; repId: string | null }
): string | null {
  if (!guest.phone) return null;
  return canViewGuestContact(role, userId, guest.repId) ? guest.phone : maskPhone(guest.phone);
}

export function canUseCheckIn(role: Role): boolean {
  return role === Role.ADMIN || role === Role.MARKETING || isRepScopedRole(role);
}

export function canManageEvents(role: Role): boolean {
  return role === Role.ADMIN || role === Role.MARKETING;
}
