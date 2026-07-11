import { GuestStatus, Prisma } from "@prisma/client";

import {
  resolveSegmentEventIds,
  SEGMENT_DEFAULT_EXCLUDED_STATUSES,
  type EmailSegmentDefinition
} from "@/lib/email/segmentDefinition";
import { mergeGuestWhereWithSegment } from "@/lib/guests/segmentFilters";
import { prisma } from "@/lib/prisma";

const REGISTERED_ACTIVITY_STATUSES: GuestStatus[] = [
  GuestStatus.REGISTERED,
  GuestStatus.ACCEPTED,
  GuestStatus.CHECKED_IN,
  GuestStatus.JOINED
];

function buildEventScopeWhere(definition: EmailSegmentDefinition): Prisma.GuestWhereInput {
  const eventIds = resolveSegmentEventIds(definition);
  if (eventIds?.length === 1) {
    return { eventId: eventIds[0]! };
  }
  if (eventIds?.length) {
    return { eventId: { in: eventIds } };
  }
  return {};
}

function buildStatusWhere(definition: EmailSegmentDefinition): Prisma.GuestWhereInput | undefined {
  if (definition.statuses?.length) {
    return { status: { in: definition.statuses } };
  }
  if (definition.excludeDeclinedNoShow !== false) {
    return { status: { notIn: [...SEGMENT_DEFAULT_EXCLUDED_STATUSES] } };
  }
  return undefined;
}

function buildRegisteredWithinDaysWhere(days: number): Prisma.GuestWhereInput {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  cutoff.setUTCHours(0, 0, 0, 0);

  return {
    OR: [
      { rsvpConfirmedAt: { gte: cutoff } },
      {
        AND: [
          { rsvpConfirmedAt: null },
          { createdAt: { gte: cutoff } },
          { status: { in: REGISTERED_ACTIVITY_STATUSES } }
        ]
      }
    ]
  };
}

/**
 * First-time = no prior attended guest row in the org (other event, same email or contact).
 * Returning = at least one prior attended guest row in the org.
 */
async function buildAttendeeExperienceWhere(
  experience: NonNullable<EmailSegmentDefinition["attendeeExperience"]>,
  definition: EmailSegmentDefinition
): Promise<Prisma.GuestWhereInput> {
  const orgId = definition.orgId;
  const scopedEventIds = resolveSegmentEventIds(definition);
  const scopeSql =
    scopedEventIds?.length === 1
      ? Prisma.sql`AND g."eventId" = ${scopedEventIds[0]!}`
      : scopedEventIds?.length
        ? Prisma.sql`AND g."eventId" IN (${Prisma.join(scopedEventIds)})`
        : Prisma.empty;

  const priorAttendanceSql = Prisma.sql`(
    prior.status IN ('CHECKED_IN', 'JOINED')
    OR EXISTS (SELECT 1 FROM "CheckIn" c WHERE c."guestId" = prior.id)
  )`;

  const priorMatchSql = Prisma.sql`
    EXISTS (
      SELECT 1 FROM "Guest" prior
      INNER JOIN "Event" pe ON pe.id = prior."eventId"
      WHERE pe."orgId" = ${orgId}
        AND prior.id != g.id
        AND prior."eventId" != g."eventId"
        AND (
          (
            g.email IS NOT NULL
            AND trim(g.email) != ''
            AND prior.email IS NOT NULL
            AND lower(trim(prior.email)) = lower(trim(g.email))
          )
          OR (g."contactId" IS NOT NULL AND prior."contactId" = g."contactId")
        )
        AND ${priorAttendanceSql}
    )
  `;

  const experienceSql =
    experience === "returning"
      ? priorMatchSql
      : Prisma.sql`NOT ${priorMatchSql}`;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT g.id
    FROM "Guest" g
    INNER JOIN "Event" e ON e.id = g."eventId"
    WHERE e."orgId" = ${orgId}
    ${scopeSql}
    AND (
      (g.email IS NOT NULL AND trim(g.email) != '')
      OR g."contactId" IS NOT NULL
    )
    AND ${experienceSql}
  `;

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    return { id: { in: [] } };
  }
  return { id: { in: ids } };
}

export async function buildBroadcastSegmentGuestWhere(
  definition: EmailSegmentDefinition
): Promise<Prisma.GuestWhereInput> {
  const parts: Prisma.GuestWhereInput[] = [{ event: { orgId: definition.orgId } }, buildEventScopeWhere(definition)];

  const statusWhere = buildStatusWhere(definition);
  if (statusWhere) parts.push(statusWhere);

  if (definition.modes?.length) {
    parts.push({ mode: { in: definition.modes } });
  }

  if (definition.registeredWithinDays != null) {
    parts.push(buildRegisteredWithinDaysWhere(definition.registeredWithinDays));
  }

  let base: Prisma.GuestWhereInput = { AND: parts.filter((part) => Object.keys(part).length > 0) };

  if (definition.filter) {
    base = mergeGuestWhereWithSegment(base, definition.filter);
  }

  if (definition.attendeeExperience) {
    const experienceWhere = await buildAttendeeExperienceWhere(definition.attendeeExperience, definition);
    base = { AND: [base, experienceWhere] };
  }

  return base;
}
