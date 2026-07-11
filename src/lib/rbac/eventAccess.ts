import { Role, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  isEventLinkedRole,
  isOrgWideRole,
  isSalesRepRole,
  isStaffRole,
  type EventAccessContext,
  type ViewerContext
} from "./types";
import { isPiiOverrideActive } from "./types";

/** Prisma where clause: events visible to the viewer in list/hub views. */
export function visibleEventsWhere(
  orgId: string,
  userId: string,
  role: Role
): Prisma.EventWhereInput {
  if (isOrgWideRole(role)) {
    return { orgId };
  }
  if (isStaffRole(role)) {
    return {
      orgId,
      teamMembers: { some: { userId } }
    };
  }
  if (isSalesRepRole(role)) {
    return {
      orgId,
      OR: [
        { guests: { some: { repId: userId } } },
        { teamMembers: { some: { userId } } }
      ]
    };
  }
  return { orgId, id: "__none__" };
}

/** Guests visible in event roster queries for event-linked roles. */
export function visibleGuestsWhereForEvent(
  eventId: string,
  viewer: Pick<ViewerContext, "userId" | "role">
): Prisma.GuestWhereInput {
  if (isOrgWideRole(viewer.role)) {
    return { eventId };
  }
  if (isStaffRole(viewer.role)) {
    return { eventId };
  }
  if (isSalesRepRole(viewer.role)) {
    return { eventId };
  }
  return { eventId, id: "__none__" };
}

export async function getEventTeamMember(
  eventId: string,
  userId: string
): Promise<EventAccessContext["teamMember"]> {
  return prisma.eventTeamMember.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: {
      userId: true,
      role: true,
      dataAccessOverride: true,
      toggleExpiresAt: true
    }
  });
}

export async function loadEventAccessContext(
  eventId: string,
  userId: string
): Promise<{ eventEndDate: Date } | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { endDate: true }
  });
  if (!event) return null;
  return { eventEndDate: event.endDate };
}

/**
 * Returns true when the user may open an event workspace (overview, check-in, etc.).
 */
export async function userHasEventAccess(
  eventId: string,
  orgId: string,
  viewer: ViewerContext
): Promise<boolean> {
  if (isOrgWideRole(viewer.role)) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, orgId },
      select: { id: true }
    });
    return Boolean(event);
  }

  if (!isEventLinkedRole(viewer.role)) return false;

  const teamMember = await prisma.eventTeamMember.findUnique({
    where: { eventId_userId: { eventId, userId: viewer.userId } },
    select: { id: true }
  });
  if (teamMember) return true;

  if (isStaffRole(viewer.role)) {
    return false;
  }

  const ownedGuest = await prisma.guest.findFirst({
    where: { eventId, repId: viewer.userId, event: { orgId } },
    select: { id: true }
  });
  return Boolean(ownedGuest);
}

export async function assertEventAccess(
  eventId: string,
  orgId: string,
  viewer: ViewerContext
): Promise<EventAccessContext | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true, endDate: true }
  });
  if (!event) return null;

  const allowed = await userHasEventAccess(eventId, orgId, viewer);
  if (!allowed) return null;

  const teamMember = await getEventTeamMember(eventId, viewer.userId);
  return {
    eventId,
    eventEndDate: event.endDate,
    teamMember
  };
}

/** Re-validate PII override at read time; auto-disable if expired. */
export async function resolveActiveTeamMemberForPii(
  eventId: string,
  userId: string,
  now: Date = new Date()
): Promise<EventAccessContext["teamMember"]> {
  const member = await prisma.eventTeamMember.findUnique({
    where: { eventId_userId: { eventId, userId } }
  });
  if (!member) return null;

  if (member.dataAccessOverride && member.toggleExpiresAt && now > member.toggleExpiresAt) {
    await prisma.eventTeamMember.update({
      where: { id: member.id },
      data: {
        dataAccessOverride: false,
        toggleEnabledAt: null,
        toggleExpiresAt: null
      }
    });
    return {
      userId: member.userId,
      role: member.role,
      dataAccessOverride: false,
      toggleExpiresAt: null
    };
  }

  return {
    userId: member.userId,
    role: member.role,
    dataAccessOverride: member.dataAccessOverride,
    toggleExpiresAt: member.toggleExpiresAt
  };
}

export function isPiiOverrideActiveForViewer(
  teamMember: EventAccessContext["teamMember"],
  now: Date = new Date()
): boolean {
  return isPiiOverrideActive(teamMember, now);
}
