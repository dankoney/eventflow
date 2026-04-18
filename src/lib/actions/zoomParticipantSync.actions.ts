"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { syncEventGuestsFromZoomParticipantReport } from "@/lib/zoom/syncEventZoomParticipants";
import { ActionResult } from "@/types";
import { Role } from "@prisma/client";

const schema = z.object({
  eventId: z.string().min(1)
});

function canSyncZoom(role: Role) {
  return role === Role.ADMIN || role === Role.MARKETING;
}

export async function syncZoomParticipantsForEvent(
  input: z.input<typeof schema>
): Promise<
  ActionResult<{
    fetched: number;
    reportRows: number;
    liveDashboardRows: number;
    pastDashboardRows: number;
    matchedUpdated: number;
    externalCreated: number;
    skippedNoIdentifier: number;
  }>
> {
  const session = await auth();
  if (!session?.user?.orgId || !canSyncZoom(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  try {
    const data = await syncEventGuestsFromZoomParticipantReport({
      eventId: parsed.data.eventId,
      orgId: session.user.orgId
    });
    revalidatePath(`/events/${parsed.data.eventId}/guests`);
    revalidatePath(`/events/${parsed.data.eventId}/analytics`);
    revalidatePath(`/events/${parsed.data.eventId}`);
    return { success: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Zoom sync failed.";
    return { success: false, error: msg.slice(0, 500) };
  }
}
