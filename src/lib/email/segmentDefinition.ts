import { AttendMode, GuestStatus } from "@prisma/client";
import { z } from "zod";

import { guestSegmentFilterSchema } from "@/lib/guests/segmentFilterSchema";

/** RSVP statuses excluded when {@link emailSegmentDefinitionSchema}'s toggle is on (default). */
export const SEGMENT_DEFAULT_EXCLUDED_STATUSES = [
  GuestStatus.DECLINED,
  GuestStatus.NO_SHOW
] as const;

/**
 * Broadcast segment definition stored on {@link EmailCampaign.segmentDefinition}.
 *
 * Event scope (first match wins):
 * - `eventIds` — explicit list of events
 * - `eventId` — single-event shorthand
 * - neither — all events in the org
 *
 * Guest / CRM dimensions:
 * - `statuses` — explicit RSVP lifecycle filter (overrides the decline/no-show toggle)
 * - `excludeDeclinedNoShow` — when true (default) and `statuses` is omitted, hides
 *   DECLINED and NO_SHOW guests
 * - `modes` — attendance mode (IN_PERSON, VIRTUAL)
 * - `registeredWithinDays` — registered or RSVP-confirmed within the last N days
 * - `attendeeExperience` — first-time vs returning (prior org attendance by email/contact)
 * - `filter` — CRM segmentation (guest category A/B/C, groups, categories, companies, …)
 */
export const emailSegmentDefinitionSchema = z
  .object({
    orgId: z.string().min(1),
    eventId: z.string().min(1).optional(),
    eventIds: z.array(z.string().min(1)).min(1).optional(),
    statuses: z.array(z.nativeEnum(GuestStatus)).optional(),
    modes: z.array(z.nativeEnum(AttendMode)).optional(),
    excludeDeclinedNoShow: z.boolean().default(true),
    registeredWithinDays: z.number().int().positive().max(366).optional(),
    attendeeExperience: z.enum(["first_time", "returning"]).optional(),
    filter: guestSegmentFilterSchema.optional()
  })
  .refine((data) => !(data.eventId && data.eventIds?.length), {
    message: "Provide eventId or eventIds, not both"
  });

export type EmailSegmentDefinition = z.infer<typeof emailSegmentDefinitionSchema>;

export function parseEmailSegmentDefinition(input: unknown): EmailSegmentDefinition {
  return emailSegmentDefinitionSchema.parse(input);
}

/** Resolved event scope: `null` means all events in the org. */
export function resolveSegmentEventIds(definition: EmailSegmentDefinition): string[] | null {
  if (definition.eventIds?.length) return definition.eventIds;
  if (definition.eventId) return [definition.eventId];
  return null;
}
