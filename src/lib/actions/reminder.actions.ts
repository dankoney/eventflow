"use server";

import { EventStatus, Role } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  deliverFinalReminderPayloads,
  deliverPrimaryReminderPayloads,
  eventReminderInclude
} from "@/lib/reminders/dispatch";
import type { ActionResult } from "@/types";

const manualSendSchema = z.object({
  eventId: z.string().min(1),
  which: z.enum(["primary", "final", "both"])
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

function canCreateEvents(role: Role) {
  return role === Role.ADMIN || role === Role.MARKETING;
}

/**
 * Sends primary and/or final reminder content immediately using **saved** event settings.
 * Does not create `EventReminderLog` rows — scheduled cron sends are unchanged.
 */
export async function sendManualEventReminders(
  input: z.input<typeof manualSendSchema>
): Promise<ActionResult<{ primary?: true; final?: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canCreateEvents(session.user.role)) {
    return { success: false, error: "You do not have permission to send reminders." };
  }

  const parsed = manualSendSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    include: eventReminderInclude
  });
  if (!event) return { success: false, error: "Event not found." };
  if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.LIVE) {
    return { success: false, error: "Reminders can only be sent for published or live events." };
  }

  const which = parsed.data.which;

  try {
    if (which === "both") {
      if (!event.reminderPrimaryEnabled || !event.reminderFinalEnabled) {
        return {
          success: false,
          error:
            "Enable and save both primary and final reminders on this event before sending both at once."
        };
      }
      await deliverPrimaryReminderPayloads(event, event.id);
      await deliverFinalReminderPayloads(event, event.id);
      return { success: true, data: { primary: true, final: true } };
    }

    if (which === "primary") {
      if (!event.reminderPrimaryEnabled) {
        return {
          success: false,
          error: "Primary reminder is disabled for this event (enable it and save before sending)."
        };
      }
      await deliverPrimaryReminderPayloads(event, event.id);
      return { success: true, data: { primary: true } };
    }

    if (!event.reminderFinalEnabled) {
      return {
        success: false,
        error: "Final reminder is disabled for this event (enable it and save before sending)."
      };
    }
    await deliverFinalReminderPayloads(event, event.id);
    return { success: true, data: { final: true } };
  } catch {
    return { success: false, error: "Could not send one or more reminders." };
  }
}
