import {
  AttendMode,
  EventBlueprintTemplate,
  EventScheduleMode,
  EventStatus,
  EventType,
  Role,
  type Prisma
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { assertEventAccess, visibleEventsWhere } from "@/lib/permissions";
import { formatLocationLine } from "@/lib/utils";

export { visibleEventsWhere };

export type EventGuestSplit = {
  inPerson: number;
  virtual: number;
};

export type EventListItem = {
  id: string;
  name: string;
  description: string | null;
  date: Date;
  endDate: Date;
  scheduleMode: EventScheduleMode;
  multiDayConfig: Prisma.JsonValue | null;
  locationId: string;
  locationSummary: string;
  /** Event hero; falls back to venue image in UI when absent. */
  bannerImageUrl: string | null;
  facilityImageUrl: string | null;
  capacity: number;
  virtualCapacity: number;
  type: EventType;
  status: EventStatus;
  blueprintTemplate: EventBlueprintTemplate;
  orgId: string;
  guestSplit: EventGuestSplit;
  createdByName: string | null;
};

export type EventsListTabId = "ongoing" | "upcoming" | "past";

/**
 * Split dashboard events into tabs: in-session (started, not ended), before start, or ended / terminal.
 */
export function partitionEventsForTabs(events: EventListItem[], now = new Date()) {
  const t = now.getTime();
  const ongoing: EventListItem[] = [];
  const upcoming: EventListItem[] = [];
  const past: EventListItem[] = [];

  for (const e of events) {
    const start = new Date(e.date).getTime();
    const end = new Date(e.endDate).getTime();

    if (e.status === EventStatus.COMPLETED || e.status === EventStatus.CANCELLED) {
      past.push(e);
      continue;
    }
    if (t < start) {
      upcoming.push(e);
      continue;
    }
    if (t < end) {
      ongoing.push(e);
      continue;
    }
    past.push(e);
  }

  return { ongoing, upcoming, past };
}

export function resolveEventsListTab(
  requested: string | undefined,
  counts: { ongoing: number; upcoming: number; past: number }
): EventsListTabId {
  if (requested === "ongoing" || requested === "upcoming" || requested === "past") {
    return requested;
  }
  if (counts.ongoing > 0) return "ongoing";
  if (counts.upcoming > 0) return "upcoming";
  return "past";
}

/** Events visible: org-wide for ADMIN/MARKETING; event-linked for SALES_REP/STAFF. */
export async function listEventsWithGuestSplit(
  orgId: string,
  userId: string,
  role: Role
): Promise<EventListItem[]> {
  const where = visibleEventsWhere(orgId, userId, role);

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      location: { select: { id: true, name: true, address: true, facilityImageUrl: true } },
      createdBy: { select: { name: true, email: true } }
    }
  });

  if (events.length === 0) return [];

  const ids = events.map((e) => e.id);
  const grouped = await prisma.guest.groupBy({
    by: ["eventId", "mode"],
    where: { eventId: { in: ids } },
    _count: { _all: true }
  });

  const splitMap = new Map<string, EventGuestSplit>();
  for (const id of ids) {
    splitMap.set(id, { inPerson: 0, virtual: 0 });
  }
  for (const row of grouped) {
    const current = splitMap.get(row.eventId) ?? { inPerson: 0, virtual: 0 };
    if (row.mode === AttendMode.IN_PERSON) {
      current.inPerson = row._count._all;
    } else {
      current.virtual = row._count._all;
    }
    splitMap.set(row.eventId, current);
  }

  return events.map((event) => ({
    id: event.id,
    name: event.name,
    description: event.description,
    date: event.date,
    endDate: event.endDate,
    scheduleMode: event.scheduleMode,
    multiDayConfig: event.multiDayConfig,
    locationId: event.locationId,
    locationSummary: formatLocationLine(event.location),
    bannerImageUrl: event.bannerImageUrl ?? null,
    facilityImageUrl: event.location.facilityImageUrl ?? null,
    capacity: event.capacity,
    virtualCapacity: event.virtualCapacity,
    type: event.type,
    status: event.status,
    blueprintTemplate: event.blueprintTemplate,
    orgId: event.orgId,
    guestSplit: splitMap.get(event.id) ?? { inPerson: 0, virtual: 0 },
    createdByName: event.createdBy?.name?.trim() || event.createdBy?.email || null
  }));
}

export async function getEventByIdForOrg(eventId: string, orgId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, orgId },
    include: { location: true }
  });
}

export async function getEventForUser(
  eventId: string,
  orgId: string,
  userId: string,
  role: Role,
  sessionId?: string | null
) {
  const access = await assertEventAccess(eventId, orgId, {
    userId,
    role,
    orgId,
    sessionId
  });
  if (!access) return null;

  return prisma.event.findFirst({
    where: { id: eventId, orgId },
    include: {
      guests: true,
      location: true,
      org: { select: { slug: true } }
    }
  });
}

export async function getEventById(id: string, orgId: string) {
  return prisma.event.findFirst({
    where: { id, orgId },
    include: { guests: true, location: true }
  });
}

const openRegistrationStatuses: EventStatus[] = [EventStatus.PUBLISHED, EventStatus.LIVE];

export async function getEventForPublicRegistration(eventId: string) {
  return prisma.event.findFirst({
    where: {
      id: eventId,
      status: { in: openRegistrationStatuses },
      allowPublicRegistration: true
    },
    select: {
      id: true,
      status: true,
      name: true,
      date: true,
      endDate: true,
      scheduleMode: true,
      multiDayConfig: true,
      type: true,
      capacity: true,
      virtualCapacity: true,
      zoomMeetingId: true,
      zoomJoinUrl: true,
      zoomPasscode: true,
      zoomSessionKind: true,
      orgId: true,
      registrationProfile: true,
      emailMandatoryForRegistration: true,
      blueprintTemplate: true,
      location: {
        select: {
          name: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
          facilityImageUrl: true
        }
      },
      org: {
        select: {
          name: true,
          resendApiKey: true,
          logo: true,
          defaultEventBrandLogoUrl: true,
          marketingEmailEnabled: true,
          marketingConsentCopy: true,
          marketingPrivacyPolicyUrl: true
        }
      },
      bannerImageUrl: true,
      brandLogoUrl: true,
      attendeeTheme: true,
      publicPageTemplate: true,
      brandPrimaryColor: true,
      /**
       * Surfaced so the public-registration server action can include polling
       * info in the confirmation email/SMS and the "you qualify to vote" panel
       * shown after registration succeeds. We never include `Vote` or
       * `BallotChoice` here — voter-facing read only.
       */
      poll: {
        select: {
          id: true,
          title: true,
          instructions: true,
          isActive: true,
          isAnonymous: true,
          startTime: true,
          endTime: true
        }
      }
    }
  });
}

export async function getEventForPublicPage(eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      description: true,
      date: true,
      endDate: true,
      scheduleMode: true,
      multiDayConfig: true,
      status: true,
      type: true,
      capacity: true,
      virtualCapacity: true,
      zoomMeetingId: true,
      zoomJoinUrl: true,
      zoomPasscode: true,
      zoomSessionKind: true,
      orgId: true,
      allowPublicRegistration: true,
      emailMandatoryForRegistration: true,
      blueprintTemplate: true,
      registrationProfile: true,
      internalStaffAudience: true,
      internalStaffNoticeKind: true,
      internalStaffNoticeFrom: true,
      internalStaffNoticeCc: true,
      internalStaffNoticeContext: true,
      internalStaffCheckInMode: true,
      internalStaffMealMenuEnabled: true,
      internalStaffMealMenuScope: true,
      internalStaffMealMenuItems: true,
      internalStaffMealMenusByBranch: true,
      publicExperience: true,
      location: {
        select: {
          name: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
          facilityImageUrl: true
        }
      },
      org: {
        select: {
          name: true,
          resendApiKey: true,
          logo: true,
          logoUrl: true,
          defaultEventBrandLogoUrl: true,
          defaultEventBrandPrimaryColor: true,
          defaultEventBrandSecondaryColor: true,
          defaultEventBrandTertiaryColor: true,
          slug: true,
          internalStaffFooterContact: true,
          marketingEmailEnabled: true,
          marketingConsentCopy: true,
          marketingPrivacyPolicyUrl: true
        }
      },
      bannerImageUrl: true,
      brandLogoUrl: true,
      attendeeTheme: true,
      publicPageTemplate: true,
      brandPrimaryColor: true
    }
  });
}

/** Public registration UI reads the event via `getEventForPublicPage` (all statuses); keep fields aligned with registration actions. */
export type PublicRegistrationEvent = NonNullable<Awaited<ReturnType<typeof getEventForPublicPage>>>;
