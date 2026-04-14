"use server";

import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { slugifyWorkspaceName } from "@/lib/utils";
import type { ActionResult } from "@/types";

const setupSchema = z
  .object({
    organizationName: z.string().min(2, "Organization name is required").max(120),
    slug: z
      .string()
      .min(2)
      .max(60)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug: lowercase letters, numbers, and single hyphens between words"
      ),
    adminName: z.string().min(2, "Name is required").max(120),
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string()
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"]
      });
    }
  });

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

async function ensureUniqueOrgSlug(desired: string): Promise<string> {
  let base = slugifyWorkspaceName(desired);
  for (let attempt = 0; attempt < 12; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomBytes(3).toString("hex")}`;
    const exists = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true }
    });
    if (!exists) return slug;
  }
  throw new Error("Could not allocate a unique slug");
}

export async function completeInitialSetup(
  input: z.input<typeof setupSchema>
): Promise<ActionResult<{ created: true }>> {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return { success: false, error: "Setup has already been completed. Sign in instead." };
  }

  const emailNorm = parsed.data.email.trim().toLowerCase();
  const slug = await ensureUniqueOrgSlug(parsed.data.slug.trim());

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: parsed.data.organizationName.trim(),
          slug
        }
      });

      const user = await tx.user.create({
        data: {
          email: emailNorm,
          name: parsed.data.adminName.trim(),
          role: Role.ADMIN,
          orgId: org.id
        }
      });

      await tx.account.create({
        data: {
          userId: user.id,
          type: "credentials",
          provider: "credentials",
          providerAccountId: emailNorm,
          access_token: passwordHash
        }
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        success: false,
        error: "That email or workspace slug is already in use. Choose another."
      };
    }
    return { success: false, error: "Could not complete setup. Try again." };
  }

  return { success: true, data: { created: true } };
}
