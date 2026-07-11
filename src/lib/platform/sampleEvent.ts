import { EventStatus, EventType, ZoomSessionKind } from "@prisma/client";

import type { Prisma } from "@prisma/client";

/**
 * Seed a single DRAFT event on a newly activated workspace so the dashboard
 * isn't empty when the admin first signs in. The event is intentionally:
 *   - DRAFT  -> never sends invitations, never shows on public lists,
 *   - 7 days out -> still in the "upcoming" filter,
 *   - public registration ON, walk-ins OFF -> can be published end-to-end
 *     as a "try the flow" demo without needing to flip extra switches.
 *
 * Runs inside the activation transaction; failures bubble up.
 */
export async function seedSampleEventForOrg(
  tx: Prisma.TransactionClient,
  input: { orgId: string; locationId: string }
): Promise<{ eventId: string }> {
  const now = new Date();
  const startsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  const event = await tx.event.create({
    data: {
      name: "Sample event · Try the Eventflow flow",
      description:
        "We created this DRAFT event so your dashboard isn't empty on day one. Edit anything, change the date, or delete it once you're ready to publish your first real event.",
      date: startsAt,
      endDate: endsAt,
      locationId: input.locationId,
      capacity: 50,
      virtualCapacity: 100,
      type: EventType.HYBRID,
      status: EventStatus.DRAFT,
      zoomSessionKind: ZoomSessionKind.MEETING,
      allowPublicRegistration: true,
      allowFlashEntry: false,
      orgId: input.orgId
    },
    select: { id: true }
  });

  return { eventId: event.id };
}
