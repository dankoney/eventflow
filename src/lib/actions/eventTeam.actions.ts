"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { canManageEventTeam, canToggleRepPiiOverride } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  resolvePiiOverrideExpiresAt,
  type PiiGrantDurationHours
} from "@/lib/rbac/types";
import { ActionResult } from "@/types";

const assignSchema = z.object({
  eventId: z.string().min(1),
  userId: z.string().min(1),
  role: z.nativeEnum(Role)
});

const grantDurationSchema = z.union([z.literal(24), z.literal(72), z.literal(168)]);

const toggleSchema = z.object({
  eventId: z.string().min(1),
  userId: z.string().min(1),
  enabled: z.boolean(),
  /** Optional explicit expiry. */
  expiresAt: z.coerce.date().optional(),
  /** Post-event rolling grant length (hours). Ignored when `expiresAt` is set. */
  grantDurationHours: grantDurationSchema.optional()
});

export async function assignEventTeamMember(
  input: z.input<typeof assignSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventTeam(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  if (parsed.data.role !== Role.SALES_REP && parsed.data.role !== Role.STAFF) {
    return { success: false, error: "Only Sales Rep or Staff can be assigned to event teams." };
  }

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  const user = await prisma.user.findFirst({
    where: { id: parsed.data.userId, orgId: session.user.orgId },
    select: { id: true, role: true }
  });
  if (!user) return { success: false, error: "User not found." };
  if (user.role !== parsed.data.role) {
    return {
      success: false,
      error: "Team member workspace role must match their organization role."
    };
  }

  const row = await prisma.eventTeamMember.upsert({
    where: {
      eventId_userId: { eventId: parsed.data.eventId, userId: parsed.data.userId }
    },
    create: {
      eventId: parsed.data.eventId,
      userId: parsed.data.userId,
      role: parsed.data.role
    },
    update: { role: parsed.data.role }
  });

  revalidatePath(`/events/${parsed.data.eventId}`);
  revalidatePath(`/events/${parsed.data.eventId}/settings/team`);
  return { success: true, data: { id: row.id } };
}

export async function removeEventTeamMember(
  eventId: string,
  userId: string
): Promise<ActionResult<{ removed: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventTeam(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  await prisma.eventTeamMember.deleteMany({
    where: { eventId, userId }
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/settings/team`);
  return { success: true, data: { removed: true } };
}

export async function setRepPiiOverride(
  input: z.input<typeof toggleSchema>
): Promise<ActionResult<{ enabled: boolean }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canToggleRepPiiOverride(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true, endDate: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  const member = await prisma.eventTeamMember.findUnique({
    where: {
      eventId_userId: { eventId: parsed.data.eventId, userId: parsed.data.userId }
    }
  });
  if (!member) return { success: false, error: "User is not on this event team." };
  if (member.role !== Role.SALES_REP) {
    return { success: false, error: "PII override applies to Sales Reps only." };
  }

  const now = new Date();
  if (parsed.data.enabled) {
    const expiresAt = resolvePiiOverrideExpiresAt(event.endDate, now, {
      explicit: parsed.data.expiresAt,
      grantDurationHours: parsed.data.grantDurationHours as PiiGrantDurationHours | undefined
    });
    await prisma.eventTeamMember.update({
      where: { id: member.id },
      data: {
        dataAccessOverride: true,
        toggleEnabledAt: now,
        toggleExpiresAt: expiresAt
      }
    });
  revalidatePath(`/events/${parsed.data.eventId}`);
  revalidatePath(`/events/${parsed.data.eventId}/settings/team`);
  revalidatePath(`/events/${parsed.data.eventId}/guests`);
  return { success: true, data: { enabled: true } };
  }

  await prisma.eventTeamMember.update({
    where: { id: member.id },
    data: {
      dataAccessOverride: false,
      toggleEnabledAt: null,
      toggleExpiresAt: null
    }
  });
  revalidatePath(`/events/${parsed.data.eventId}`);
  revalidatePath(`/events/${parsed.data.eventId}/settings/team`);
  revalidatePath(`/events/${parsed.data.eventId}/guests`);
  return { success: true, data: { enabled: false } };
}

export async function listEventTeamMembers(eventId: string) {
  const session = await auth();
  if (!session?.user?.orgId) return [];

  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return [];

  return prisma.eventTeamMember.findMany({
    where: { eventId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } }
    },
    orderBy: { createdAt: "asc" }
  });
}
