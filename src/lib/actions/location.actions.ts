"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const locationWriteSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(500),
  capacity: z.coerce.number().int().min(1),
  city: z.string().max(160).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  googlePlaceId: z.string().max(256).optional().nullable(),
  facilityImageUrl: z.string().max(500).optional().nullable()
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

function canManageLocations(role: Role) {
  return role === "ADMIN" || role === "MARKETING";
}

function revalidateLocationConsumers() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/events/new");
  revalidatePath("/events/new/classic");
  revalidatePath("/events");
}

export async function searchLocationsForPicker(
  query: string
): Promise<ActionResult<{ id: string; name: string; address: string; capacity: number; city: string | null }[]>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageLocations(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const q = query.trim();
  const baseWhere: Prisma.LocationWhereInput = { orgId: session.user.orgId };

  try {
    const rows = await prisma.location.findMany({
      where:
        q.length === 0
          ? baseWhere
          : {
              ...baseWhere,
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { address: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } }
              ]
            },
      orderBy: { name: "asc" },
      take: 30,
      select: {
        id: true,
        name: true,
        address: true,
        capacity: true,
        city: true
      }
    });
    return { success: true, data: rows };
  } catch {
    return { success: false, error: "Could not search venues" };
  }
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
        orgId: session.user.orgId,
        city: parsed.data.city?.trim() || null,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        googlePlaceId: parsed.data.googlePlaceId?.trim() || null,
        facilityImageUrl: parsed.data.facilityImageUrl?.trim() || null
      }
    });
    revalidateLocationConsumers();
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
        capacity: parsed.data.capacity,
        city: parsed.data.city?.trim() || null,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        googlePlaceId: parsed.data.googlePlaceId?.trim() || null,
        facilityImageUrl: parsed.data.facilityImageUrl?.trim() || null
      }
    });
    revalidateLocationConsumers();
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
    revalidateLocationConsumers();
    return { success: true, data: { id: parsed.data.id } };
  } catch {
    return {
      success: false,
      error: "Could not delete this venue. It may still be linked to events."
    };
  }
}
