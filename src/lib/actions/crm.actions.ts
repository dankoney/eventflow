"use server";

import { CrmContactKind, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { isCrmEligibleEmail, isCrmInviteableProfile } from "@/lib/crm/contactEligibility";
import { orgContactConflictsForOrg } from "@/lib/db/orgContact";
import { guardModuleActionForOrg } from "@/lib/features/moduleGuards";
import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";
import { prisma } from "@/lib/prisma";
import { parseZoomAnonRosterName } from "@/lib/zoom/anonRosterName";
import type { ActionResult } from "@/types";

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

function canManageCrm(role: Role) {
  return role === Role.ADMIN || role === Role.MARKETING;
}

const createGroupSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  color: z
    .string()
    .max(7)
    .optional()
    .nullable()
    .refine((v) => !v || /^#[0-9a-fA-F]{6}$/.test(v), "Color must be #RRGGBB")
});

const deleteGroupSchema = z.object({ id: z.string().min(1) });

const setContactGroupsSchema = z.object({
  contactId: z.string().min(1),
  groupIds: z.array(z.string().min(1)).max(80)
});

const syncFilteredToGroupSchema = z.object({
  groupId: z.string().min(1),
  q: z.string().max(120).optional().nullable(),
  crmKind: z.nativeEnum(CrmContactKind).optional(),
  sourceGroupId: z.string().min(1).optional().nullable(),
  /** Only contacts with at least one guest row on this event. */
  eventId: z.string().min(1).optional().nullable()
});

const syncEventGuestsToCrmSchema = z.object({
  eventId: z.string().min(1),
  groupId: z.string().min(1).optional().nullable(),
  crmKind: z.nativeEnum(CrmContactKind).optional()
});

const assignSelectedContactsToGroupSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1).max(500),
  groupId: z.string().min(1).nullable()
});

export async function createOrgContactGroup(
  input: z.input<typeof createGroupSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  const blocked = await guardModuleActionForOrg(session.user.orgId, "crm");
  if (blocked) return blocked;
  if (!canManageCrm(session.user.role)) {
    return { success: false, error: "You do not have permission to manage CRM groups." };
  }
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const row = await prisma.orgContactGroup.create({
    data: {
      orgId: session.user.orgId,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      color: parsed.data.color?.trim() || null
    },
    select: { id: true }
  });
  revalidatePath("/crm");
  revalidatePath("/dashboard/settings");
  return { success: true, data: { id: row.id } };
}

export async function deleteOrgContactGroup(input: z.input<typeof deleteGroupSchema>): Promise<ActionResult<{ deleted: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  const blocked = await guardModuleActionForOrg(session.user.orgId, "crm");
  if (blocked) return blocked;
  if (!canManageCrm(session.user.role)) {
    return { success: false, error: "You do not have permission to manage CRM groups." };
  }
  const parsed = deleteGroupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };
  const row = await prisma.orgContactGroup.findFirst({
    where: { id: parsed.data.id, orgId: session.user.orgId }
  });
  if (!row) return { success: false, error: "Group not found." };
  await prisma.orgContactGroup.delete({ where: { id: row.id } });
  revalidatePath("/crm");
  revalidatePath("/dashboard/settings");
  return { success: true, data: { deleted: true } };
}

export async function setOrgContactGroupMembership(
  input: z.input<typeof setContactGroupsSchema>
): Promise<ActionResult<{ ok: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  const blocked = await guardModuleActionForOrg(session.user.orgId, "crm");
  if (blocked) return blocked;
  if (!canManageCrm(session.user.role)) {
    return { success: false, error: "You do not have permission to update CRM groups." };
  }
  const parsed = setContactGroupsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const contact = await prisma.orgContact.findFirst({
    where: { id: parsed.data.contactId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!contact) return { success: false, error: "Contact not found." };

  if (parsed.data.groupIds.length > 0) {
    const groups = await prisma.orgContactGroup.findMany({
      where: { orgId: session.user.orgId, id: { in: parsed.data.groupIds } },
      select: { id: true }
    });
    if (groups.length !== parsed.data.groupIds.length) {
      return { success: false, error: "One or more groups are invalid for this organization." };
    }
  }

  await prisma.$transaction([
    prisma.orgContactGroupMember.deleteMany({ where: { contactId: contact.id } }),
    ...(parsed.data.groupIds.length > 0
      ? [
          prisma.orgContactGroupMember.createMany({
            data: parsed.data.groupIds.map((groupId) => ({ groupId, contactId: contact.id }))
          })
        ]
      : [])
  ]);

  revalidatePath("/crm");
  revalidatePath("/dashboard/settings");
  return { success: true, data: { ok: true } };
}

export async function syncFilteredContactsToGroup(
  input: z.input<typeof syncFilteredToGroupSchema>
): Promise<ActionResult<{ synced: number; alreadyInGroup: number }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  const blocked = await guardModuleActionForOrg(session.user.orgId, "crm");
  if (blocked) return blocked;
  if (!canManageCrm(session.user.role)) {
    return { success: false, error: "You do not have permission to sync CRM groups." };
  }
  const parsed = syncFilteredToGroupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const orgId = session.user.orgId;
  const group = await prisma.orgContactGroup.findFirst({
    where: { id: parsed.data.groupId, orgId },
    select: { id: true }
  });
  if (!group) return { success: false, error: "Target group not found." };

  const q = parsed.data.q?.trim();
  const where: Prisma.OrgContactWhereInput = {
    orgId,
    ...(parsed.data.crmKind ? { crmKind: parsed.data.crmKind } : {}),
    ...(parsed.data.eventId
      ? { guests: { some: { eventId: parsed.data.eventId } } }
      : {}),
    ...(parsed.data.sourceGroupId
      ? { groupMembers: { some: { groupId: parsed.data.sourceGroupId } } }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { jobTitle: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const contacts = await prisma.orgContact.findMany({
    where,
    select: { id: true }
  });
  if (contacts.length === 0) return { success: true, data: { synced: 0, alreadyInGroup: 0 } };

  const existing = await prisma.orgContactGroupMember.findMany({
    where: { groupId: group.id, contactId: { in: contacts.map((c) => c.id) } },
    select: { contactId: true }
  });
  const existingSet = new Set(existing.map((e) => e.contactId));
  const toCreate = contacts.filter((c) => !existingSet.has(c.id));

  if (toCreate.length > 0) {
    await prisma.orgContactGroupMember.createMany({
      data: toCreate.map((c) => ({ groupId: group.id, contactId: c.id }))
    });
  }

  revalidatePath("/crm");
  return {
    success: true,
    data: { synced: toCreate.length, alreadyInGroup: existing.length }
  };
}

export async function syncGuestsIntoCrm(): Promise<
  ActionResult<{
    distinctEmails: number;
    upserted: number;
    guestsLinked: number;
    skippedNotInviteable: number;
    existingConflicts: number;
  }>
> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  const blocked = await guardModuleActionForOrg(session.user.orgId, "crm");
  if (blocked) return blocked;
  if (!canManageCrm(session.user.role)) {
    return { success: false, error: "You do not have permission to sync the CRM." };
  }

  const orgId = session.user.orgId;
  const guests = await prisma.guest.findMany({
    where: { event: { orgId } },
    select: {
      name: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      department: true,
      branch: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });

  let skippedNotInviteable = 0;
  for (const g of guests) {
    if (!isCrmInviteableProfile(g.email, g.phone)) skippedNotInviteable += 1;
  }

  const byEmail = new Map<string, (typeof guests)[number]>();
  for (const g of guests) {
    if (!g.email?.trim()) continue;
    const em = g.email.trim().toLowerCase();
    if (!isCrmInviteableProfile(g.email, g.phone)) continue;
    if (!byEmail.has(em)) byEmail.set(em, g);
  }

  let upserted = 0;
  let guestsLinked = 0;
  let existingConflicts = 0;

  const candidateEmails = [...byEmail.keys()];
  const existingContacts = await prisma.orgContact.findMany({
    where: { orgId, email: { in: candidateEmails } },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      company: true,
      jobTitle: true,
      department: true,
      branch: true,
      crmKind: true
    }
  });
  const existingByEmail = new Map(existingContacts.map((c) => [c.email.trim().toLowerCase(), c]));

  for (const [, rep] of byEmail) {
    if (!rep.email?.trim()) continue;
    const emailLower = rep.email.trim().toLowerCase();
    const guestPhone = rep.phone?.trim() && isValidE164(rep.phone.trim()) ? rep.phone.trim() : "";
    if (!guestPhone) continue;

    const dup = await orgContactConflictsForOrg(orgId, emailLower, guestPhone);
    if (dup && dup.email !== emailLower) {
      continue;
    }
    const phone = guestPhone;

    const displayName = parseZoomAnonRosterName(rep.name, rep.email).displayName.trim() || emailLower.split("@")[0] || "Guest";

    const existing = existingByEmail.get(emailLower);
    let contactId: string;
    if (existing) {
      contactId = existing.id;
      const incomingCompany = rep.company?.trim() || null;
      const incomingJobTitle = rep.jobTitle?.trim() || null;
      const incomingDepartment = rep.department?.trim() || null;
      const incomingBranch = rep.branch?.trim() || null;
      const hasConflict =
        existing.name !== displayName ||
        existing.phone !== phone ||
        existing.company !== incomingCompany ||
        existing.jobTitle !== incomingJobTitle ||
        existing.department !== incomingDepartment ||
        existing.branch !== incomingBranch ||
        existing.crmKind !== CrmContactKind.ATTENDEE;
      if (hasConflict) existingConflicts += 1;
    } else {
      const created = await prisma.orgContact.create({
        data: {
          orgId,
          name: displayName,
          email: emailLower,
          phone,
          company: rep.company?.trim() || null,
          jobTitle: rep.jobTitle?.trim() || null,
          department: rep.department?.trim() || null,
          branch: rep.branch?.trim() || null,
          hasWhatsapp: false,
          crmKind: CrmContactKind.ATTENDEE,
          source: "sync_guest"
        },
        select: { id: true }
      });
      contactId = created.id;
      upserted += 1;
    }

    const upd = await prisma.guest.updateMany({
      where: {
        event: { orgId },
        email: { equals: rep.email, mode: "insensitive" }
      },
      data: { contactId }
    });
    guestsLinked += upd.count;
  }

  revalidatePath("/crm");
  revalidatePath("/guests");
  revalidatePath("/events");
  revalidatePath("/dashboard/settings");

  return {
    success: true,
    data: {
      distinctEmails: byEmail.size,
      upserted,
      guestsLinked,
      skippedNotInviteable,
      existingConflicts
    }
  };
}

/**
 * Upsert CRM contacts from guests on a single event, link those guest rows, optionally set CRM kind, and add contacts to a group.
 */
export async function syncEventGuestsToCrm(
  input: z.input<typeof syncEventGuestsToCrmSchema>
): Promise<
  ActionResult<{
    processed: number;
    skippedNoEmail: number;
    skippedNoPhone: number;
    groupAdded: number;
    groupAlready: number;
    existingConflicts: number;
  }>
> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  const blocked = await guardModuleActionForOrg(session.user.orgId, "crm");
  if (blocked) return blocked;
  if (!canManageCrm(session.user.role)) {
    return { success: false, error: "You do not have permission to sync the CRM." };
  }

  const parsed = syncEventGuestsToCrmSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const orgId = session.user.orgId;
  const { eventId, groupId, crmKind: kindArg } = parsed.data;
  const crmKind = kindArg ?? CrmContactKind.ATTENDEE;

  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true, name: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  if (groupId) {
    const g = await prisma.orgContactGroup.findFirst({
      where: { id: groupId, orgId },
      select: { id: true }
    });
    if (!g) return { success: false, error: "Group not found." };
  }

  const guests = await prisma.guest.findMany({
    where: { eventId: event.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      department: true,
      branch: true
    }
  });

  let processed = 0;
  let skippedNoEmail = 0;
  let skippedNoPhone = 0;
  let existingConflicts = 0;
  const contactIds: string[] = [];

  const existingContacts = await prisma.orgContact.findMany({
    where: {
      orgId,
      email: { in: guests.map((g) => g.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e)) }
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      company: true,
      jobTitle: true,
      department: true,
      branch: true,
      crmKind: true
    }
  });
  const existingByEmail = new Map(existingContacts.map((c) => [c.email.trim().toLowerCase(), c]));

  for (const g of guests) {
    if (!g.email?.trim()) {
      skippedNoEmail += 1;
      continue;
    }
    const emailLower = g.email.trim().toLowerCase();

    const guestPhone = g.phone?.trim() && isValidE164(g.phone.trim()) ? g.phone.trim() : "";
    let phone = guestPhone;
    if (phone) {
      const dup = await orgContactConflictsForOrg(orgId, emailLower, phone);
      if (dup && dup.email !== emailLower) {
        phone = "";
      }
    }
    if (!phone) {
      skippedNoPhone += 1;
      continue;
    }

    const displayName = parseZoomAnonRosterName(g.name, g.email).displayName.trim() || emailLower.split("@")[0] || "Guest";

    const existing = existingByEmail.get(emailLower);
    let contactId: string;
    if (existing) {
      contactId = existing.id;
      const incomingCompany = g.company?.trim() || null;
      const incomingJobTitle = g.jobTitle?.trim() || null;
      const incomingDepartment = g.department?.trim() || null;
      const incomingBranch = g.branch?.trim() || null;
      const hasConflict =
        existing.name !== displayName ||
        existing.phone !== phone ||
        existing.company !== incomingCompany ||
        existing.jobTitle !== incomingJobTitle ||
        existing.department !== incomingDepartment ||
        existing.branch !== incomingBranch ||
        existing.crmKind !== crmKind;
      if (hasConflict) existingConflicts += 1;
    } else {
      const created = await prisma.orgContact.create({
        data: {
          orgId,
          name: displayName,
          email: emailLower,
          phone,
          company: g.company?.trim() || null,
          jobTitle: g.jobTitle?.trim() || null,
          department: g.department?.trim() || null,
          branch: g.branch?.trim() || null,
          hasWhatsapp: false,
          crmKind,
          source: "sync_event_guest"
        },
        select: { id: true }
      });
      contactId = created.id;
    }

    await prisma.guest.update({
      where: { id: g.id },
      data: { contactId }
    });

    contactIds.push(contactId);
    processed += 1;
  }

  let groupAdded = 0;
  let groupAlready = 0;
  if (groupId && contactIds.length > 0) {
    const unique = [...new Set(contactIds)];
    const existing = await prisma.orgContactGroupMember.findMany({
      where: { groupId, contactId: { in: unique } },
      select: { contactId: true }
    });
    const have = new Set(existing.map((e) => e.contactId));
    const toCreate = unique.filter((id) => !have.has(id));
    groupAlready = existing.length;
    if (toCreate.length > 0) {
      await prisma.orgContactGroupMember.createMany({
        data: toCreate.map((contactId) => ({ groupId, contactId })),
        skipDuplicates: true
      });
      groupAdded = toCreate.length;
    }
  }

  revalidatePath("/crm");
  revalidatePath("/guests");
  revalidatePath("/events");
  revalidatePath(`/events/${event.id}/guests`);
  revalidatePath("/dashboard/settings");

  return {
    success: true,
    data: {
      processed,
      skippedNoEmail,
      skippedNoPhone,
      groupAdded,
      groupAlready,
      existingConflicts
    }
  };
}

export async function assignSelectedContactsToGroup(
  input: z.input<typeof assignSelectedContactsToGroupSchema>
): Promise<ActionResult<{ updated: number }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  const blocked = await guardModuleActionForOrg(session.user.orgId, "crm");
  if (blocked) return blocked;
  if (!canManageCrm(session.user.role)) {
    return { success: false, error: "You do not have permission to update CRM groups." };
  }
  const parsed = assignSelectedContactsToGroupSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  if (parsed.data.groupId) {
    const g = await prisma.orgContactGroup.findFirst({
      where: { id: parsed.data.groupId, orgId: session.user.orgId },
      select: { id: true }
    });
    if (!g) return { success: false, error: "Target group not found." };
  }

  const unique = [...new Set(parsed.data.contactIds)];
  const contacts = await prisma.orgContact.findMany({
    where: { orgId: session.user.orgId, id: { in: unique } },
    select: { id: true }
  });
  if (contacts.length === 0) return { success: true, data: { updated: 0 } };
  const ids = contacts.map((c) => c.id);

  if (!parsed.data.groupId) {
    const res = await prisma.orgContactGroupMember.deleteMany({
      where: { contactId: { in: ids } }
    });
    revalidatePath("/crm");
    return { success: true, data: { updated: res.count } };
  }

  const groupId = parsed.data.groupId;
  const existing = await prisma.orgContactGroupMember.findMany({
    where: { groupId, contactId: { in: ids } },
    select: { contactId: true }
  });
  const have = new Set(existing.map((e) => e.contactId));
  const toCreate = ids.filter((id) => !have.has(id));
  if (toCreate.length > 0) {
    await prisma.orgContactGroupMember.createMany({
      data: toCreate.map((contactId) => ({ groupId, contactId })),
      skipDuplicates: true
    });
  }
  revalidatePath("/crm");
  return { success: true, data: { updated: toCreate.length } };
}
