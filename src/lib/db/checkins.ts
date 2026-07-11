import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  formatEmailForViewer,
  isOrgWideRole,
  isStaffRole,
  resolveActiveTeamMemberForPii
} from "@/lib/permissions";
import type { EventAccessContext } from "@/lib/rbac/types";

export type RecentCheckInRow = {
  id: string;
  guestId: string;
  checkedInAt: Date | string;
  method: string;
  dayIndex: number;
  guestName: string;
  guestEmail: string | null;
};

export type CheckInsPageResult = {
  rows: RecentCheckInRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

async function loadCheckInAccessContext(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role
): Promise<EventAccessContext | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true, endDate: true }
  });
  if (!event) return null;
  const teamMember = await resolveActiveTeamMemberForPii(eventId, userId);
  return { eventId, eventEndDate: event.endDate, teamMember };
}

export async function listCheckInsForEventPaginated(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role,
  options: {
    query?: string;
    page?: number;
    pageSize?: number;
    dayIndex?: number;
    sessionId?: string | null;
  } = {}
): Promise<CheckInsPageResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, options.pageSize ?? 20));
  const query = options.query?.trim() ?? "";

  const accessCtx = await loadCheckInAccessContext(eventId, orgId, userId, role);
  if (!accessCtx) {
    return { rows: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const viewer = { userId, role, orgId, sessionId: options.sessionId };
  const guestFilter = { eventId };

  const guestSearch =
    query.length >= 1
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            ...(isStaffRole(role)
              ? []
              : [
                  { email: { contains: query, mode: "insensitive" as const } },
                  { phone: { contains: query, mode: "insensitive" as const } }
                ]),
            { company: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {};

  const where = {
    guest: { ...guestFilter, ...guestSearch },
    ...(options.dayIndex != null ? { dayIndex: options.dayIndex } : {})
  };

  const [total, rows] = await Promise.all([
    prisma.checkIn.count({ where }),
    prisma.checkIn.findMany({
      where,
      orderBy: { checkedInAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            repId: true,
            createdByUserId: true,
            staffVisibleSessionId: true
          }
        }
      }
    })
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      guestId: r.guest.id,
      checkedInAt: r.checkedInAt,
      method: r.method,
      dayIndex: r.dayIndex,
      guestName: r.guest.name,
      guestEmail: isOrgWideRole(role)
        ? r.guest.email
        : formatEmailForViewer(viewer, r.guest, accessCtx)
    })),
    total,
    page,
    pageSize,
    totalPages
  };
}

export async function listRecentCheckInsForEvent(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role,
  limit = 25,
  sessionId?: string | null
): Promise<RecentCheckInRow[]> {
  const accessCtx = await loadCheckInAccessContext(eventId, orgId, userId, role);
  if (!accessCtx) return [];

  const viewer = { userId, role, orgId, sessionId };
  const guestFilter = { eventId };

  const rows = await prisma.checkIn.findMany({
    where: { guest: guestFilter },
    orderBy: { checkedInAt: "desc" },
    take: limit,
    include: {
      guest: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          repId: true,
          createdByUserId: true,
          staffVisibleSessionId: true
        }
      }
    }
  });

  return rows.map((r) => ({
    id: r.id,
    guestId: r.guest.id,
    checkedInAt: r.checkedInAt,
    method: r.method,
    dayIndex: r.dayIndex,
    guestName: r.guest.name,
    guestEmail: isOrgWideRole(role)
      ? r.guest.email
      : formatEmailForViewer(viewer, r.guest, accessCtx)
  }));
}

export type CheckInSearchHit = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  jobTitle: string | null;
};

export async function searchGuestsForCheckInLookup(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role,
  query: string,
  sessionId?: string | null
): Promise<CheckInSearchHit[]> {
  const accessCtx = await loadCheckInAccessContext(eventId, orgId, userId, role);
  if (!accessCtx) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const viewer = { userId, role, orgId, sessionId };

  const emailPhoneSearch = isStaffRole(role)
    ? []
    : ([
        { email: { contains: q, mode: "insensitive" as const } },
        { phone: { contains: q, mode: "insensitive" as const } }
      ] as const);

  const rows = await prisma.guest.findMany({
    where: {
      eventId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        ...emailPhoneSearch,
        { company: { contains: q, mode: "insensitive" } },
        { jobTitle: { contains: q, mode: "insensitive" } }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      repId: true,
      createdByUserId: true,
      staffVisibleSessionId: true
    },
    take: 20,
    orderBy: { name: "asc" }
  });

  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    email: formatEmailForViewer(viewer, g, accessCtx),
    company: g.company,
    jobTitle: g.jobTitle
  }));
}
