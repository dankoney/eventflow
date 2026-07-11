"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { listEventWaitlistForDashboard } from "@/lib/db/eventWaitlist";
import { canManageEventGuests } from "@/lib/permissions";
import { promoteEventWaitlist } from "@/lib/waitlist/promote";
import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/types";

function formatZodError(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join(" | ");
}

const eventIdSchema = z.object({
  eventId: z.string().min(1)
});

export async function promoteNextWaitlistSlots(
  input: z.input<typeof eventIdSchema>
): Promise<ActionResult<{ promoted: number }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Only admins and marketing can promote the waitlist." };
  }
  const parsed = eventIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  const { promoted } = await promoteEventWaitlist(parsed.data.eventId);
  revalidatePath(`/events/${parsed.data.eventId}/guests`);
  return { success: true, data: { promoted } };
}

export async function listEventWaitlistForOrganizer(
  input: z.input<typeof eventIdSchema>
): Promise<ActionResult<Awaited<ReturnType<typeof listEventWaitlistForDashboard>>>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = eventIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  const rows = await listEventWaitlistForDashboard(parsed.data.eventId, session.user.orgId);
  return { success: true, data: rows };
}
