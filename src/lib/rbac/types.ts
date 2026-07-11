import { Role, type EventTeamMember } from "@prisma/client";

/** Workspace roles with org-wide visibility. */
export function isOrgWideRole(role: Role): boolean {
  return role === Role.ADMIN || role === Role.MARKETING;
}

/** Event-linked roles scoped by team assignment and/or guest ownership. */
export function isEventLinkedRole(role: Role): boolean {
  return role === Role.SALES_REP || role === Role.STAFF;
}

export function isSalesRepRole(role: Role): boolean {
  return role === Role.SALES_REP;
}

export function isStaffRole(role: Role): boolean {
  return role === Role.STAFF;
}

/**
 * @deprecated Use isEventLinkedRole, isSalesRepRole, or isStaffRole.
 * Kept temporarily for incremental migration — maps to sales rep only.
 */
export function isRepScopedRole(role: Role): boolean {
  return isSalesRepRole(role);
}

export const PII_OVERRIDE_BUFFER_MS = 2 * 60 * 60 * 1000;

/** Default follow-up window when re-granting access after the event has ended. */
export const POST_EVENT_PII_GRANT_MS = 72 * 60 * 60 * 1000;

export type PiiGrantDurationHours = 24 | 72 | 168;

export function defaultPiiOverrideExpiresAt(eventEndDate: Date): Date {
  return new Date(eventEndDate.getTime() + PII_OVERRIDE_BUFFER_MS);
}

/**
 * When the event is still in its live window, default to event end + 2h.
 * After that, grants start from `now` (rolling follow-up access for sales reps).
 */
export function resolvePiiOverrideExpiresAt(
  eventEndDate: Date,
  now: Date = new Date(),
  options?: { explicit?: Date; grantDurationHours?: PiiGrantDurationHours }
): Date {
  if (options?.explicit) return options.explicit;

  if (options?.grantDurationHours) {
    return new Date(now.getTime() + options.grantDurationHours * 60 * 60 * 1000);
  }

  const duringEventDefault = defaultPiiOverrideExpiresAt(eventEndDate);
  if (duringEventDefault.getTime() > now.getTime()) {
    return duringEventDefault;
  }

  return new Date(now.getTime() + POST_EVENT_PII_GRANT_MS);
}

export function eventPiiGrantWindowHasEnded(eventEndDate: Date, now: Date = new Date()): boolean {
  return defaultPiiOverrideExpiresAt(eventEndDate).getTime() <= now.getTime();
}

/** Whether marketing-enabled PII override is active for a team member at `now`. */
export function isPiiOverrideActive(
  member: Pick<EventTeamMember, "dataAccessOverride" | "toggleExpiresAt"> | null | undefined,
  now: Date = new Date()
): boolean {
  if (!member?.dataAccessOverride) return false;
  if (member.toggleExpiresAt && now.getTime() > member.toggleExpiresAt.getTime()) {
    return false;
  }
  return true;
}

export type ViewerContext = {
  userId: string;
  role: Role;
  orgId: string;
  /** JWT session id — required for staff walk-in PII visibility. */
  sessionId?: string | null;
};

export type GuestPiiRecord = {
  id: string;
  email: string | null;
  phone: string | null;
  repId: string | null;
  createdByUserId?: string | null;
  staffVisibleSessionId?: string | null;
};

export type EventAccessContext = {
  eventId: string;
  eventEndDate: Date;
  teamMember: Pick<
    EventTeamMember,
    "userId" | "role" | "dataAccessOverride" | "toggleExpiresAt"
  > | null;
};
