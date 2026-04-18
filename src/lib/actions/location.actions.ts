"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const locationWriteSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(500),
  capacity: z.coerce.number().int().min(1)
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

function canManageLocations(role: Role) {
  return role === "ADMIN" || role === "MARKETING";
}

export async function createLocation(
  input: z.input<typeof locationWriteSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageLocations(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = locationWriteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  try {
    const loc = await prisma.location.create({
      data: {
        name: parsed.data.name.trim(),
        address: parsed.data.address.trim(),
        capacity: parsed.data.capacity,
        orgId: session.user.orgId
      }
    });
    revalidatePath("/dashboard/settings");
    revalidatePath("/events/new");
    return { success: true, data: { id: loc.id } };
  } catch {
    return { success: false, error: "Could not create location" };
  }
}

const updateLocationSchema = locationWriteSchema.extend({
  id: z.string().min(1)
});

export async function updateLocation(
  input: z.input<typeof updateLocationSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageLocations(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateLocationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.location.findFirst({
    where: { id: parsed.data.id, orgId: session.user.orgId }
  });
  if (!existing) return { success: false, error: "Location not found" };

  try {
    await prisma.location.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name.trim(),
        address: parsed.data.address.trim(),
        capacity: parsed.data.capacity
      }
    });
    revalidatePath("/dashboard/settings");
    revalidatePath("/events/new");
    return { success: true, data: { id: parsed.data.id } };
  } catch {
    return { success: false, error: "Could not update location" };
  }
}

const deleteLocationSchema = z.object({
  id: z.string().min(1)
});

export async function deleteLocation(input: z.input<typeof deleteLocationSchema>): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageLocations(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = deleteLocationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existing = await prisma.location.findFirst({
    where: { id: parsed.data.id, orgId: session.user.orgId }
  });
  if (!existing) return { success: false, error: "Location not found" };

  try {
    await prisma.location.delete({ where: { id: parsed.data.id } });
    revalidatePath("/dashboard/settings");
    revalidatePath("/events/new");
    return { success: true, data: { id: parsed.data.id } };
  } catch {
    return {
      success: false,
      error: "Could not delete this venue. It may still be linked to events."
    };
  }
}
