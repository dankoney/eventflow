import { AttendMode, CrmContactKind, EventStatus, EventType, GuestStatus, Role, ZoomSessionKind } from "@prisma/client";

import { visibleEventsWhere } from "@/lib/db/events";
import { eventAllowsGuestInvitationResend } from "@/lib/lifecycle/eventTiming";
import {
  getParsedMultiDayOrNull,
  getPerDayZoomJoinUrl,
  resolveActiveSessionDayIndex
} from "@/lib/event-schedule/multiDayConfig";
import { prisma } from "@/lib/prisma";
import {
  assertEventAccess,
  canViewGuestPii,
  formatEmailForViewer,
  formatPhoneForViewer,
  isOrgWideRole,
  isSalesRepRole,
  isStaffRole,
  omitGuestFieldsForViewer,
  resolveActiveTeamMemberForPii
} from "@/lib/permissions";
import { getOpenZoomJoinAbsoluteUrl } from "@/lib/url";
import { formatLocationLine } from "@/lib/utils";
import type { EventAccessContext } from "@/lib/rbac/types";

/** Latest guest row in the same org (excluding this event) for public registration autofill. */
export type PriorGuestProfileForRegistration = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  country: string | null;
};

export async function findPriorGuestProfileForOrg(
  orgId: string,
  currentEventId: string,
  email: string
): Promise<PriorGuestProfileForRegistration | null> {
  const norm = email.trim().toLowerCase();
  if (!norm) return null;

  const row = await prisma.guest.findFirst({
    where: {
      email: norm,
      eventId: { not: currentEventId },
      event: { orgId }
    },
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      country: true
    }
  });
  if (!row) return null;

  const parts = row.name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return {
    firstName,
    lastName,
    email: row.email,
    phone: row.phone,
    company: row.company,
    jobTitle: row.jobTitle,
    country: row.country
  };
}

/** Latest guest row in the same org (excluding this event), matched by E.164 phone. */
export async function findPriorGuestProfileForOrgByPhone(
  orgId: string,
  currentEventId: string,
  phoneE164: string
): Promise<PriorGuestProfileForRegistration | null> {
  const norm = phoneE164.trim();
  if (!norm) return null;

  const row = await prisma.guest.findFirst({
    where: {
      phone: norm,
      eventId: { not: currentEventId },
      event: { orgId }
    },
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      country: true
    }
  });
  if (!row) return null;

  const parts = row.name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return {
    firstName,
    lastName,
    email: row.email,
    phone: row.phone,
    company: row.company,
    jobTitle: row.jobTitle,
    country: row.country
  };
}

export type GuestJoinContext = {
  guestName: string;
  /** Company from registration (used with workspace name for Zoom display label). */
  guestCompany: string | null;
  /** Null for hybrid guests who have not yet joined virtually or checked in onsite. */
  mode: AttendMode | null;
  status: GuestStatus;
  zoomLink: string | null;
  /** Host join URL when guest has no personal Zoom row yet */
  eventZoomJoinUrl: string | null;
  eventName: string;
  eventDate: Date;
  eventLocation: string;
  zoomMeetingId: string | null;
  zoomPasscode: string | null;
  zoomSessionKind: ZoomSessionKind;
  organizationName: string;
  eventStatus: EventStatus;
  eventType: EventType;
};

export type GuestJoinPassContext = GuestJoinContext & {
  guestId: string;
  qrCode: string | null;
  brandLogoUrl: string | null;
  orgLogoUrl: string | null;
  orgDefaultBrandLogoUrl: string | null;
  brandPrimaryColor: string | null;
  locationName: string | null;
  locationAddress: string | null;
};

export async function getGuestJoinContext(guestId: string): Promise<GuestJoinContext | null> {
  const pass = await getGuestJoinPassContext(guestId);
  if (!pass) return null;
  const { guestId: _id, qrCode: _qr, brandLogoUrl: _b, orgLogoUrl: _o, orgDefaultBrandLogoUrl: _d, brandPrimaryColor: _c, locationName: _ln, locationAddress: _la, ...ctx } = pass;
  return ctx;
}

export async function getGuestJoinPassContext(guestId: string): Promise<GuestJoinPassContext | null> {
  const row = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      name: true,
      company: true,
      mode: true,
      status: true,
      zoomLink: true,
      qrCode: true,
      event: {
        select: {
          name: true,
          date: true,
          orgId: true,
          scheduleMode: true,
          multiDayConfig: true,
          brandLogoUrl: true,
          brandPrimaryColor: true,
          location: { select: { name: true, address: true } },
          zoomMeetingId: true,
          zoomJoinUrl: true,
          zoomPasscode: true,
          zoomSessionKind: true,
          status: true,
          type: true,
          org: {
            select: {
              name: true,
              logo: true,
              defaultEventBrandLogoUrl: true
            }
          }
        }
      }
    }
  });
  if (!row) return null;

  const md = getParsedMultiDayOrNull(row.event.scheduleMode, row.event.multiDayConfig);
  let eventZoomJoinUrl = row.event.zoomJoinUrl;
  if (md?.virtualLinkMode === "PER_DAY") {
    const idx = resolveActiveSessionDayIndex(md);
    const dayUrl = idx != null ? getPerDayZoomJoinUrl(md, idx) : null;
    eventZoomJoinUrl = dayUrl ?? getPerDayZoomJoinUrl(md, 1) ?? row.event.zoomJoinUrl;
  }

  return {
    guestId,
    guestName: row.name,
    guestCompany: row.company,
    mode: row.mode,
    status: row.status,
    zoomLink: row.zoomLink,
    qrCode: row.qrCode,
    eventZoomJoinUrl,
    eventName: row.event.name,
    eventDate: row.event.date,
    eventLocation: formatLocationLine(row.event.location),
    locationName: row.event.location?.name ?? null,
    locationAddress: row.event.location?.address ?? null,
    zoomMeetingId: row.event.zoomMeetingId,
    zoomPasscode: row.event.zoomPasscode,
    zoomSessionKind: row.event.zoomSessionKind,
    organizationName: row.event.org.name,
    brandLogoUrl: row.event.brandLogoUrl,
    orgLogoUrl: row.event.org.logo,
    orgDefaultBrandLogoUrl: row.event.org.defaultEventBrandLogoUrl,
    brandPrimaryColor: row.event.brandPrimaryColor,
    eventStatus: row.event.status,
    eventType: row.event.type
  };
}

export type GuestWithRep = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  country: string | null;
  accessibilityNotes: string | null;
  referralSource: string | null;
  staffEmployeeId: string | null;
  department: string | null;
  branch: string | null;
  tier: string;
  mode: string | null;
  status: string;
  joinSource: string;
  qrCode: string | null;
  /** Event-side guest group (not CRM org contact group). */
  eventGuestGroupId: string | null;
  eventGuestGroupName: string | null;
  /** Linked CRM contact category, when available. */
  contactCategory: string | null;
  /** Linked CRM contact type (crmKind), when available. */
  contactCrmKind: CrmContactKind | null;
  /** Linked CRM contact company (falls back to guest company in audience filters). */
  contactCompany: string | null;
  zoomLink: string | null;
  /**
   * Same per-guest `/join/{id}/open-zoom` URL as confirmation email (null if site base URL is unset).
   */
  openZoomJoinUrl: string | null;
  dietary: string | null;
  repId: string | null;
  eventId: string;
  createdAt: Date;
  repName: string | null;
  repEmail: string | null;
  checkedInAt: Date | null;
  /** When true, QR and sensitive actions should be hidden in UI. */
  contactsRedacted: boolean;
  /** Organizer may resend invitation email (event published/live and not past completion window). */
  canResendInvitation: boolean;
  /** Latest check-in meal selection when the program uses meal-at-check-in. */
  latestCheckInMeal: string | null;
  /** Set when organizer invitation email was sent (null if still draft / never emailed). */
  invitationEmailSentAt: Date | null;
};

export async function getGuestsByEvent(eventId: string) {
  return prisma.guest.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" }
  });
}

export async function listGuestsForEventManagement(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role,
  sessionId?: string | null
): Promise<GuestWithRep[]> {
  const access = await assertEventAccess(eventId, orgId, {
    userId,
    role,
    orgId,
    sessionId
  });
  if (!access) throw new Error("Event not found");

  const teamMember = await resolveActiveTeamMemberForPii(eventId, userId);
  const accessCtx: EventAccessContext = { ...access, teamMember };

  const eventRow = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true, status: true, endDate: true }
  });
  if (!eventRow) throw new Error("Event not found");

  const canResendInvitation = eventAllowsGuestInvitationResend({
    status: eventRow.status,
    endDate: eventRow.endDate
  });

  const viewer = { userId, role, orgId, sessionId };

  const guests = await prisma.guest.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: {
      checkIns: { select: { checkedInAt: true, dayIndex: true, mealChoice: true } },
      eventGuestGroup: { select: { id: true, name: true } },
      contact: { select: { category: true, crmKind: true, company: true } }
    }
  });

  const repIds = isStaffRole(role)
    ? []
    : ([...new Set(guests.map((g) => g.repId).filter(Boolean))] as string[]);
  const repMap = new Map<string, { name: string | null; email: string }>();
  if (repIds.length > 0) {
    const reps = await prisma.user.findMany({
      where: { id: { in: repIds }, orgId },
      select: { id: true, name: true, email: true }
    });
    for (const r of reps) repMap.set(r.id, r);
  }

  return guests.map((g) => {
    const { checkIns, eventGuestGroup, contact, ...rest } = g;
    const rep = g.repId ? repMap.get(g.repId) : undefined;
    const full = canViewGuestPii(viewer, g, accessCtx);
    const openZoomJoinUrl =
      full && g.mode !== AttendMode.IN_PERSON ? getOpenZoomJoinAbsoluteUrl(g.id) : null;
    const latestCheckIn =
      checkIns.length > 0
        ? checkIns.reduce((a, b) => (a.checkedInAt.getTime() >= b.checkedInAt.getTime() ? a : b))
        : null;

    const base = omitGuestFieldsForViewer(
      viewer,
      {
        ...rest,
        eventGuestGroupId: eventGuestGroup?.id ?? null,
        eventGuestGroupName: eventGuestGroup?.name ?? null,
        contactCategory: contact?.category?.trim() || null,
        contactCrmKind: contact?.crmKind ?? null,
        contactCompany: contact?.company?.trim() || null,
        email: formatEmailForViewer(viewer, g, accessCtx),
        phone: formatPhoneForViewer(viewer, g, accessCtx),
        repName: rep?.name ?? null,
        repEmail: rep?.email ?? null,
        checkedInAt: latestCheckIn?.checkedInAt ?? null,
        contactsRedacted: !full,
        openZoomJoinUrl,
        canResendInvitation: canResendInvitation && g.status !== GuestStatus.DECLINED,
        latestCheckInMeal: latestCheckIn?.mealChoice?.trim() || null
      },
      accessCtx
    );

    return base as GuestWithRep;
  });
}

async function assertEventInOrg(eventId: string, orgId: string) {
  const ev = await prisma.event.findFirst({ where: { id: eventId, orgId }, select: { id: true } });
  if (!ev) throw new Error("Event not found");
}

export async function getGuestById(guestId: string) {
  return prisma.guest.findUnique({
    where: { id: guestId },
    include: { checkIns: true, event: true }
  });
}

export async function getGuestByIdForOrg(guestId: string, orgId: string) {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: { checkIns: true, event: true }
  });
  if (!guest || guest.event.orgId !== orgId) return null;
  return guest;
}

export type GuestHubRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  tier: string;
  mode: string | null;
  status: string;
  eventId: string;
  eventName: string;
  eventDate: Date;
  repName: string | null;
  repEmail: string | null;
};

export const GUEST_HUB_MAX = 2500;

export async function listGuestsForOrgHub(
  orgId: string,
  userId: string,
  role: Role,
  sessionId?: string | null
): Promise<GuestHubRow[]> {
  if (isStaffRole(role)) return [];

  const guests = await prisma.guest.findMany({
    where: {
      event: visibleEventsWhere(orgId, userId, role),
      ...(isSalesRepRole(role) ? { repId: userId } : {})
    },
    take: GUEST_HUB_MAX,
    orderBy: [{ event: { date: "desc" } }, { name: "asc" }],
    include: {
      event: { select: { id: true, name: true, date: true } }
    }
  });

  const repIds = [...new Set(guests.map((g) => g.repId).filter(Boolean))] as string[];
  const repMap = new Map<string, { name: string | null; email: string }>();
  if (repIds.length > 0) {
    const reps = await prisma.user.findMany({
      where: { id: { in: repIds }, orgId },
      select: { id: true, name: true, email: true }
    });
    for (const r of reps) repMap.set(r.id, r);
  }

  return guests.map((g) => {
    const rep = g.repId ? repMap.get(g.repId) : undefined;
    const viewer = { userId, role, orgId, sessionId };
    const accessCtx: EventAccessContext = {
      eventId: g.eventId,
      eventEndDate: g.event.date,
      teamMember: null
    };
    return {
      id: g.id,
      name: g.name,
      email: formatEmailForViewer(viewer, g, accessCtx),
      phone: formatPhoneForViewer(viewer, g, accessCtx),
      company: g.company,
      tier: g.tier,
      mode: g.mode,
      status: g.status,
      eventId: g.eventId,
      eventName: g.event.name,
      eventDate: g.event.date,
      repName: rep?.name ?? null,
      repEmail: rep?.email ?? null
    };
  });
}

export type GuestCheckInCacheRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  repId: string | null;
  qrCode: string | null;
  status: GuestStatus;
  checkedInAt: Date | null;
};

/** Operational guest rows for offline check-in cache (PII masked per RBAC). */
export async function listGuestsForCheckInCache(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role,
  sessionId?: string | null
): Promise<GuestCheckInCacheRow[]> {
  await assertEventInOrg(eventId, orgId);

  const teamMember = await resolveActiveTeamMemberForPii(eventId, userId);
  const eventRow = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { endDate: true }
  });
  if (!eventRow) return [];

  const accessCtx: EventAccessContext = {
    eventId,
    eventEndDate: eventRow.endDate,
    teamMember
  };
  const viewer = { userId, role, orgId, sessionId };

  const guests = await prisma.guest.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      repId: true,
      qrCode: true,
      status: true,
      createdByUserId: true,
      staffVisibleSessionId: true,
      checkIns: { select: { checkedInAt: true, dayIndex: true } }
    }
  });

  return guests.map((g) => ({
    id: g.id,
    name: g.name,
    email: formatEmailForViewer(viewer, g, accessCtx),
    phone: formatPhoneForViewer(viewer, g, accessCtx),
    company: g.company,
    jobTitle: g.jobTitle,
    repId: isStaffRole(role) ? null : g.repId,
    qrCode: g.qrCode,
    status: g.status,
    checkedInAt:
      g.checkIns.length > 0
        ? g.checkIns.reduce((a, b) => (a.checkedInAt.getTime() >= b.checkedInAt.getTime() ? a : b)).checkedInAt
        : null
  }));
}

export type EventFilterOption = { id: string; name: string; date: Date };

export async function listEventsForGuestHubFilter(
  orgId: string,
  userId: string,
  role: Role
): Promise<EventFilterOption[]> {
  return prisma.event.findMany({
    where: visibleEventsWhere(orgId, userId, role),
    select: { id: true, name: true, date: true },
    orderBy: { date: "desc" }
  });
}
