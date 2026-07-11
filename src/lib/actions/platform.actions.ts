"use server";

import { OrgPlan, Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { sendOrgActivationEmail } from "@/lib/email";
import { startBillingTrialForOrg } from "@/lib/billing/startBillingTrial";
import { seedSampleEventForOrg } from "@/lib/platform/sampleEvent";
import { prisma } from "@/lib/prisma";
import { hitSlidingWindow } from "@/lib/rateLimit/memorySlidingWindow";
import { resolvePublicBaseForLinks } from "@/lib/url";
import { slugifyWorkspaceName } from "@/lib/utils";
import type { ActionResult } from "@/types";

/** 7 days. Long enough for vacation absences, short enough for security hygiene. */
const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVATION_TOKEN_TTL_DAYS = 7;

/** Defense-in-depth against credential compromise on a platform-owner account. */
const PROVISION_RL_MAX = 10;
const PROVISION_RL_WINDOW_MS = 60 * 60 * 1000;

const PLAN_LABELS: Record<OrgPlan, string> = {
  FREE: "Free",
  PRO: "Pro",
  ENTERPRISE: "Enterprise"
};

const provisionSchema = z.object({
  organizationName: z.string().trim().min(2, "Organization name is required.").max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug: lowercase letters, numbers, and single hyphens between words."
    )
    .optional(),
  adminName: z.string().trim().min(2, "Admin name is required.").max(120),
  adminEmail: z.string().trim().email().max(254),
  plan: z.nativeEnum(OrgPlan).optional()
});

export type ProvisionOrganizationResult = ActionResult<{
  orgId: string;
  adminUserId: string;
  /**
   * Absolute URL the platform owner can copy to the admin if the email gets
   * lost. Single-use; superseded as soon as the link is regenerated.
   */
  activationUrl: string;
  emailSent: boolean;
  /** When `emailSent === false` this carries the dispatch error. */
  emailError?: string;
}>;

function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
}

async function requirePlatformOwner(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPlatformOwner: true }
  });
  if (!me?.isPlatformOwner) {
    return { ok: false, error: "Only platform owners can manage other workspaces." };
  }
  return { ok: true, userId: session.user.id };
}

async function ensureUniqueOrgSlug(desired: string): Promise<string> {
  const base = slugifyWorkspaceName(desired);
  if (!base) throw new Error("Unable to derive a slug from the organization name.");
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${randomBytes(3).toString("hex")}`;
    const exists = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true }
    });
    if (!exists) return slug;
  }
  throw new Error("Could not allocate a unique slug.");
}

/**
 * Mint a single-use activation token for `(orgId, userId)`. Stores only the
 * bcrypt hash of the raw token; returns the raw token for use in the link.
 * Invalidates any prior unconsumed tokens for the same pair so the most recent
 * email is always the only one that works.
 */
async function mintActivationToken(input: {
  orgId: string;
  userId: string;
}): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(raw, 12);
  await prisma.$transaction(async (tx) => {
    await tx.orgActivationToken.updateMany({
      where: { orgId: input.orgId, userId: input.userId, consumedAt: null },
      data: { consumedAt: new Date() }
    });
    await tx.orgActivationToken.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        tokenHash,
        expiresAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS)
      }
    });
  });
  return raw;
}

function buildActivationUrl(input: { userId: string; rawToken: string }): string | null {
  const base = resolvePublicBaseForLinks();
  if (!base) return null;
  const params = new URLSearchParams({ u: input.userId, t: input.rawToken });
  return `${base}/onboard/activate?${params.toString()}`;
}

/**
 * Provision a new workspace + its first admin. Single transaction so we never
 * end up with an org without an admin or vice versa. The activation email is
 * best-effort — if Resend is down the row is still created and the platform
 * owner can copy the returned `activationUrl` to the admin directly.
 */
export async function provisionOrganization(
  input: z.input<typeof provisionSchema>
): Promise<ProvisionOrganizationResult> {
  const parsed = provisionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const rl = hitSlidingWindow(
    `platform:provision:${guard.userId}`,
    PROVISION_RL_MAX,
    PROVISION_RL_WINDOW_MS
  );
  if (!rl.ok) {
    const minutes = Math.ceil(rl.retryAfterMs / 60_000);
    return {
      success: false,
      error: `You've hit the hourly provisioning limit. Try again in ~${minutes} minute${minutes === 1 ? "" : "s"}.`
    };
  }

  const emailNorm = parsed.data.adminEmail.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: emailNorm },
    select: { id: true }
  });
  if (existingUser) {
    return {
      success: false,
      error: "That email is already attached to an Eventflow account. Use a different email for this workspace's admin."
    };
  }

  const slug = await ensureUniqueOrgSlug(parsed.data.slug?.trim() || parsed.data.organizationName);
  const plan = parsed.data.plan ?? OrgPlan.FREE;

  let createdOrgId: string;
  let createdUserId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: parsed.data.organizationName.trim(),
          slug,
          plan,
          activatedAt: null,
          provisionedById: guard.userId
        }
      });

      const user = await tx.user.create({
        data: {
          email: emailNorm,
          name: parsed.data.adminName.trim(),
          role: Role.ADMIN,
          orgId: org.id,
          /** Stamped at activation time, see {@link activateOrgWithToken}. */
          emailVerified: null,
          isPlatformOwner: false
        }
      });

      await tx.location.create({
        data: {
          name: "Main venue",
          address: "Update this address under Settings → Locations.",
          capacity: 500,
          orgId: org.id
        }
      });

      return { orgId: org.id, userId: user.id };
    });
    createdOrgId = result.orgId;
    createdUserId = result.userId;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        success: false,
        error: "That email or workspace slug is already in use. Pick another."
      };
    }
    return {
      success: false,
      error: "Could not provision the workspace. Try again in a moment."
    };
  }

  if (plan !== OrgPlan.ENTERPRISE) {
    try {
      await startBillingTrialForOrg(createdOrgId);
    } catch (trialError) {
      console.error("[provision] failed to start billing trial", trialError);
    }
  }

  const rawToken = await mintActivationToken({ orgId: createdOrgId, userId: createdUserId });
  const activationUrl = buildActivationUrl({ userId: createdUserId, rawToken });
  if (!activationUrl) {
    return {
      success: false,
      error:
        "Public base URL is not configured (set NEXTAUTH_URL or PUBLIC_APP_URL) so the activation link can't be generated."
    };
  }

  let emailSent = true;
  let emailError: string | undefined;
  try {
    await sendOrgActivationEmail({
      to: emailNorm,
      adminName: parsed.data.adminName.trim(),
      orgName: parsed.data.organizationName.trim(),
      planLabel: PLAN_LABELS[plan],
      activationUrl,
      expiresInDays: ACTIVATION_TOKEN_TTL_DAYS
    });
  } catch (err) {
    emailSent = false;
    emailError = err instanceof Error ? err.message.slice(0, 240) : "Email dispatch failed.";
    console.error("[provisionOrganization] activation email failed", err);
  }

  revalidatePath("/superadmin");

  return {
    success: true,
    data: {
      orgId: createdOrgId,
      adminUserId: createdUserId,
      activationUrl,
      emailSent,
      ...(emailError ? { emailError } : {})
    }
  };
}

const regenerateSchema = z.object({ orgId: z.string().min(1) });

export type RegenerateActivationResult = ActionResult<{
  activationUrl: string;
  emailSent: boolean;
  emailError?: string;
}>;

/**
 * Mint a fresh activation token (and email) for a workspace that hasn't been
 * activated yet. Old tokens for the same admin are invalidated atomically.
 */
export async function regenerateActivationLink(
  input: z.input<typeof regenerateSchema>
): Promise<RegenerateActivationResult> {
  const parsed = regenerateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guard = await requirePlatformOwner();
  if (!guard.ok) return { success: false, error: guard.error };

  const org = await prisma.organization.findUnique({
    where: { id: parsed.data.orgId },
    select: {
      id: true,
      name: true,
      plan: true,
      activatedAt: true,
      users: {
        where: { role: Role.ADMIN },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, name: true, email: true }
      }
    }
  });
  if (!org) return { success: false, error: "Workspace not found." };
  if (org.activatedAt) {
    return {
      success: false,
      error: "This workspace is already activated. No need for a new link."
    };
  }
  const admin = org.users[0];
  if (!admin) return { success: false, error: "No admin user found for this workspace." };

  const rawToken = await mintActivationToken({ orgId: org.id, userId: admin.id });
  const activationUrl = buildActivationUrl({ userId: admin.id, rawToken });
  if (!activationUrl) {
    return {
      success: false,
      error:
        "Public base URL is not configured (set NEXTAUTH_URL or PUBLIC_APP_URL) so the activation link can't be generated."
    };
  }

  let emailSent = true;
  let emailError: string | undefined;
  try {
    await sendOrgActivationEmail({
      to: admin.email,
      adminName: admin.name ?? "there",
      orgName: org.name,
      planLabel: PLAN_LABELS[org.plan],
      activationUrl,
      expiresInDays: ACTIVATION_TOKEN_TTL_DAYS
    });
  } catch (err) {
    emailSent = false;
    emailError = err instanceof Error ? err.message.slice(0, 240) : "Email dispatch failed.";
    console.error("[regenerateActivationLink] failed", err);
  }

  revalidatePath("/superadmin");
  return {
    success: true,
    data: { activationUrl, emailSent, ...(emailError ? { emailError } : {}) }
  };
}

const activateSchema = z.object({
  userId: z.string().min(1),
  token: z.string().min(8)
});

export type ActivateOrgResult = ActionResult<{ orgSlug: string }>;

/**
 * Consume an activation token: stamp `Organization.activatedAt`, stamp
 * `User.emailVerified`, mark the token consumed, and seed a sample event so
 * the new admin's dashboard isn't empty.
 *
 * Designed to be called from a public route — it does NOT require a signed-in
 * session because the bearer of the token is by definition the admin we're
 * trying to activate. Returns the org slug so the caller can build a redirect
 * to `/login?activated=<slug>`.
 */
export async function activateOrgWithToken(
  input: z.input<typeof activateSchema>
): Promise<ActivateOrgResult> {
  const parsed = activateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const rows = await prisma.orgActivationToken.findMany({
    where: {
      userId: parsed.data.userId,
      consumedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      orgId: true,
      tokenHash: true
    }
  });
  if (rows.length === 0) {
    return {
      success: false,
      error: "This activation link is invalid or has expired. Ask your platform owner to send a new one."
    };
  }

  let matchedTokenId: string | null = null;
  let matchedOrgId: string | null = null;
  for (const row of rows) {
    const ok = await bcrypt.compare(parsed.data.token, row.tokenHash);
    if (ok) {
      matchedTokenId = row.id;
      matchedOrgId = row.orgId;
      break;
    }
  }
  if (!matchedTokenId || !matchedOrgId) {
    return {
      success: false,
      error: "This activation link is invalid or has expired. Ask your platform owner to send a new one."
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tokenRow = await tx.orgActivationToken.findUnique({
        where: { id: matchedTokenId! },
        select: { id: true, orgId: true, userId: true, consumedAt: true, expiresAt: true }
      });
      if (!tokenRow || tokenRow.consumedAt || tokenRow.expiresAt.getTime() <= Date.now()) {
        throw new ActivationError(
          "This activation link is invalid or has expired. Ask your platform owner to send a new one."
        );
      }

      const org = await tx.organization.findUnique({
        where: { id: tokenRow.orgId },
        select: {
          id: true,
          slug: true,
          activatedAt: true,
          locations: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true } },
          _count: { select: { events: true } }
        }
      });
      if (!org) throw new ActivationError("Workspace not found.");

      await tx.user.update({
        where: { id: tokenRow.userId },
        data: { emailVerified: new Date() }
      });

      if (org.activatedAt === null) {
        await tx.organization.update({
          where: { id: org.id },
          data: { activatedAt: new Date() }
        });
        const locationId = org.locations[0]?.id;
        if (locationId && org._count.events === 0) {
          await seedSampleEventForOrg(tx, { orgId: org.id, locationId });
        }
      }

      await tx.orgActivationToken.update({
        where: { id: tokenRow.id },
        data: { consumedAt: new Date() }
      });
      /** Burn any sibling tokens so a leaked older link can't replay. */
      await tx.orgActivationToken.updateMany({
        where: { orgId: org.id, userId: tokenRow.userId, consumedAt: null },
        data: { consumedAt: new Date() }
      });

      return { orgSlug: org.slug };
    });

    return { success: true, data: { orgSlug: result.orgSlug } };
  } catch (e) {
    if (e instanceof ActivationError) {
      return { success: false, error: e.message };
    }
    console.error("[activateOrgWithToken] failed", e);
    return {
      success: false,
      error: "Could not activate the workspace. Try again in a moment."
    };
  }
}

class ActivationError extends Error {}

export const planLabel = (plan: OrgPlan): string => PLAN_LABELS[plan];
