"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageEventGuests, mayEditOrDeleteGuestRow } from "@/lib/permissions";
function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

async function assertEventOrg(eventId: string, orgId: string) {
  const ev = await prisma.event.findFirst({ where: { id: eventId, orgId }, select: { id: true } });
  return Boolean(ev);
}

const createEventGuestGroupSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().min(1).max(80).trim()
});

export async function createEventGuestGroup(
  input: z.input<typeof createEventGuestGroupSchema>
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = createEventGuestGroupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const ok = await assertEventOrg(parsed.data.eventId, session.user.orgId);
  if (!ok) return { success: false, error: "Event not found." };

  const last = await prisma.eventGuestGroup.findFirst({
    where: { eventId: parsed.data.eventId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  const sortOrder = (last?.sortOrder ?? 0) + 1;

  try {
    const row = await prisma.eventGuestGroup.create({
      data: {
        eventId: parsed.data.eventId,
        name: parsed.data.name,
        sortOrder
      },
      select: { id: true }
    });
    revalidatePath(`/events/${parsed.data.eventId}/guests`);
    return { success: true, id: row.id };
  } catch {
    return { success: false, error: "Could not create group (duplicate name?)." };
  }
}

const renameEventGuestGroupSchema = z.object({
  eventId: z.string().min(1),
  groupId: z.string().min(1),
  name: z.string().min(1).max(80).trim()
});

export async function renameEventGuestGroup(
  input: z.input<typeof renameEventGuestGroupSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = renameEventGuestGroupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const group = await prisma.eventGuestGroup.findFirst({
    where: { id: parsed.data.groupId, eventId: parsed.data.eventId, event: { orgId: session.user.orgId } },
    select: { id: true }
  });
  if (!group) return { success: false, error: "Group not found." };

  try {
    await prisma.eventGuestGroup.update({
      where: { id: group.id },
      data: { name: parsed.data.name }
    });
    revalidatePath(`/events/${parsed.data.eventId}/guests`);
    return { success: true };
  } catch {
    return { success: false, error: "Could not rename (duplicate name?)." };
  }
}

const deleteEventGuestGroupSchema = z.object({
  eventId: z.string().min(1),
  groupId: z.string().min(1)
});

export async function deleteEventGuestGroup(
  input: z.input<typeof deleteEventGuestGroupSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = deleteEventGuestGroupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const group = await prisma.eventGuestGroup.findFirst({
    where: { id: parsed.data.groupId, eventId: parsed.data.eventId, event: { orgId: session.user.orgId } },
    select: { id: true }
  });
  if (!group) return { success: false, error: "Group not found." };

  await prisma.eventGuestGroup.delete({ where: { id: group.id } });
  revalidatePath(`/events/${parsed.data.eventId}/guests`);
  return { success: true };
}

const assignGuestsToEventGuestGroupSchema = z.object({
  eventId: z.string().min(1),
  guestIds: z.array(z.string().min(1)).min(1).max(300),
  groupId: z.string().min(1).nullable()
});

export async function assignGuestsToEventGuestGroup(
  input: z.input<typeof assignGuestsToEventGuestGroupSchema>
): Promise<{ success: true; updated: number } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const parsed = assignGuestsToEventGuestGroupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const ok = await assertEventOrg(parsed.data.eventId, session.user.orgId);
  if (!ok) return { success: false, error: "Event not found." };

  if (parsed.data.groupId) {
    const group = await prisma.eventGuestGroup.findFirst({
      where: { id: parsed.data.groupId, eventId: parsed.data.eventId },
      select: { id: true }
    });
    if (!group) return { success: false, error: "Group not found for this event." };
  }

  const uniqueGuestIds = [...new Set(parsed.data.guestIds)];
  const found = await prisma.guest.findMany({
    where: {
      id: { in: uniqueGuestIds },
      eventId: parsed.data.eventId,
      event: { orgId: session.user.orgId }
    },
    select: { id: true, repId: true }
  });
  const allowedIds = found
    .filter((g) => mayEditOrDeleteGuestRow(session.user.role, session.user.id, g.repId))
    .map((g) => g.id);

  if (allowedIds.length === 0) return { success: true, updated: 0 };

  const res = await prisma.guest.updateMany({
    where: { id: { in: allowedIds } },
    data: { eventGuestGroupId: parsed.data.groupId }
  });
  revalidatePath(`/events/${parsed.data.eventId}/guests`);
  return { success: true, updated: res.count };
}
