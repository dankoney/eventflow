"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const profileSchema = z.object({
  name: z.string().max(120)
});

const orgSchema = z.object({
  name: z.string().min(1, "Name is required").max(120)
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

export async function updateMyProfile(
  input: z.input<typeof profileSchema>
): Promise<ActionResult<{ name: string | null }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const trimmed = parsed.data.name.trim();
  const name = trimmed.length > 0 ? trimmed : null;

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name }
    });
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true, data: { name } };
  } catch {
    return { success: false, error: "Could not update profile" };
  }
}

export async function updateOrganizationName(
  input: z.input<typeof orgSchema>
): Promise<ActionResult<{ name: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN) {
    return { success: false, error: "Only organization admins can update the company name." };
  }

  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const name = parsed.data.name.trim();

  try {
    await prisma.organization.update({
      where: { id: session.user.orgId },
      data: { name }
    });
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true, data: { name } };
  } catch {
    return { success: false, error: "Could not update organization" };
  }
}
