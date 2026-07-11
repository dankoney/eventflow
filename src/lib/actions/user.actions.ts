"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { assertCanAddTeamSeat } from "@/lib/billing/planLimits";
import { formatResendErrorForClient, sendWorkspaceInviteEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  role: z.nativeEnum(Role)
});

const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2).max(120),
  role: z.nativeEnum(Role)
});

const deleteUserSchema = z.object({
  userId: z.string().min(1)
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

export async function createOrgUser(
  input: z.input<typeof createUserSchema>
): Promise<ActionResult<{ id: string; inviteEmailSent: boolean; inviteEmailError?: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN) {
    return { success: false, error: "Only admins can create users." };
  }

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const email = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name.trim();

  if (parsed.data.role === Role.ADMIN) {
    return { success: false, error: "Creating additional ADMIN users is not allowed from this screen." };
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: { name: true, resendApiKey: true, plan: true, id: true }
    });
    if (!org) return { success: false, error: "Organization not found." };

    const seatLimit = await assertCanAddTeamSeat(org);
    if (!seatLimit.ok) return { success: false, error: seatLimit.error };

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: parsed.data.role,
        orgId: session.user.orgId
      }
    });

    const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
    const loginUrl = baseUrl ? `${baseUrl}/login` : "/login";

    let inviteEmailSent = false;
    let inviteEmailError: string | undefined;
    try {
      await sendWorkspaceInviteEmail({
        to: email,
        inviteeName: name,
        orgName: org.name,
        loginUrl,
        resendApiKeyOverride: org.resendApiKey?.trim() || undefined
      });
      inviteEmailSent = true;
    } catch (e) {
      console.error("[user] invite email failed", e);
      inviteEmailError = formatResendErrorForClient(e);
    }

    revalidatePath("/dashboard/settings");
    return { success: true, data: { id: user.id, inviteEmailSent, inviteEmailError } };
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      return { success: false, error: "A user with that email already exists." };
    }
    return { success: false, error: "Could not create user." };
  }
}

export async function updateOrgUser(
  input: z.input<typeof updateUserSchema>
): Promise<ActionResult<{ updated: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN) {
    return { success: false, error: "Only admins can edit users." };
  }

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  if (parsed.data.userId === session.user.id) {
    return { success: false, error: "Edit your own profile from Profile settings." };
  }
  if (parsed.data.role === Role.ADMIN) {
    return { success: false, error: "Promoting users to ADMIN is not allowed from this screen." };
  }

  const user = await prisma.user.findFirst({
    where: { id: parsed.data.userId, orgId: session.user.orgId },
    select: { id: true, role: true }
  });
  if (!user) return { success: false, error: "User not found." };
  if (user.role === Role.ADMIN) {
    return { success: false, error: "Editing ADMIN users is not allowed from this screen." };
  }

  try {
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: {
        name: parsed.data.name.trim(),
        role: parsed.data.role
      }
    });
    revalidatePath("/dashboard/settings");
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Could not update user." };
  }
}

export async function deleteOrgUser(
  input: z.input<typeof deleteUserSchema>
): Promise<ActionResult<{ deleted: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN) {
    return { success: false, error: "Only admins can delete users." };
  }

  const parsed = deleteUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  if (parsed.data.userId === session.user.id) {
    return { success: false, error: "You cannot delete your own account." };
  }

  const user = await prisma.user.findFirst({
    where: { id: parsed.data.userId, orgId: session.user.orgId },
    select: { id: true, role: true }
  });
  if (!user) return { success: false, error: "User not found." };
  if (user.role === Role.ADMIN) {
    return { success: false, error: "Deleting ADMIN users is not allowed from this screen." };
  }

  try {
    await prisma.user.delete({ where: { id: parsed.data.userId } });
    revalidatePath("/dashboard/settings");
    return { success: true, data: { deleted: true } };
  } catch {
    return { success: false, error: "Could not delete user." };
  }
}

export async function getOrgUserDetails(userId: string): Promise<
  ActionResult<{
    id: string;
    name: string | null;
    email: string;
    role: Role;
    createdAt: Date;
  }>
> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN) {
    return { success: false, error: "Only admins can view user details." };
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, orgId: session.user.orgId },
    select: { id: true, name: true, email: true, role: true, createdAt: true }
  });
  if (!user) return { success: false, error: "User not found." };

  return { success: true, data: user };
}
