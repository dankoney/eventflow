/**
 * Sample resolveSegment output against the live database.
 *
 *   npx tsx scripts/sample-resolve-segment.ts
 *   EVENT_ID=... ORG_ID=... npx tsx scripts/sample-resolve-segment.ts
 */
import { PrismaClient } from "@prisma/client";

import { resolveSegment } from "../src/lib/db/resolveSegment";

const prisma = new PrismaClient();

async function main() {
  const event =
    process.env.EVENT_ID != null
      ? await prisma.event.findUnique({
          where: { id: process.env.EVENT_ID },
          select: { id: true, name: true, orgId: true, _count: { select: { guests: true } } }
        })
      : await prisma.event.findFirst({
          where: { guests: { some: {} } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true, orgId: true, _count: { select: { guests: true } } }
        });

  if (!event) {
    throw new Error("No event with guests found. Set EVENT_ID explicitly.");
  }

  const orgId = process.env.ORG_ID ?? event.orgId;

  console.log("=== resolveSegment sample ===\n");
  console.log("Event:", event.name, `(${event.id})`);
  console.log("Org:", orgId);
  console.log("Total guests on event:", event._count.guests);
  console.log();

  const scenarios = [
    {
      label: "All org events (default scope, exclude declined/no-show)",
      definition: { orgId }
    },
    {
      label: "Single event only",
      definition: { orgId, eventId: event.id }
    },
    {
      label: "Registered in last 30 days (org-wide)",
      definition: { orgId, registeredWithinDays: 30 }
    },
    {
      label: "First-time attendees only (single event)",
      definition: { orgId, eventId: event.id, attendeeExperience: "first_time" as const }
    },
    {
      label: "Include declined & no-show (toggle off)",
      definition: { orgId, eventId: event.id, excludeDeclinedNoShow: false }
    },
    {
      label: "Guest category A only (not ticket type)",
      definition: {
        orgId,
        eventId: event.id,
        filter: { mode: "include" as const, tiers: ["A"] as const }
      }
    }
  ];

  for (const scenario of scenarios) {
    const result = await resolveSegment(scenario.definition, { previewLimit: 5 });

    console.log("---", scenario.label, "---");
    console.log("Definition:", JSON.stringify(scenario.definition, null, 2));
    console.log();
    console.log("Counts:", {
      matchedGuestCount: result.matchedGuestCount,
      recipientCount: result.recipientCount,
      excluded: result.excluded
    });
    console.log();
    console.log(
      "Sample recipients (up to 5):",
      JSON.stringify(
        result.recipients.map((r) => ({
          guestId: r.guestId,
          event: r.eventName,
          name: r.guestName,
          email: r.emailContactEmail,
          status: r.guestStatus,
          tier: r.tier,
          isSubscribed: true
        })),
        null,
        2
      )
    );
    console.log();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
