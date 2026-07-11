"use server";

import { CrmContactKind, Prisma, Role, StaffEmploymentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { isCrmInviteableProfile } from "@/lib/crm/contactEligibility";
import { createOrgUser } from "@/lib/actions/user.actions";
import { orgContactUpsertServerSchema } from "@/lib/crm/contactUpsertSchema";
import { orgContactConflictsForOrg, type OrgContactUpsertInput } from "@/lib/db/orgContact";
import { normalizeImportedPhoneToE164 } from "@/lib/phone/importPhoneNormalization";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";
import type { CrmImportConflictField, CrmImportIssue, CrmImportResult } from "@/types/crmImport";

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

function canManageOrgContacts(role: Role) {
  return role === Role.ADMIN || role === Role.MARKETING;
}

const upsertSchema = orgContactUpsertServerSchema;

const deleteSchema = z.object({ id: z.string().min(1) });

const deleteManySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(300)
});

const promoteSchema = z.object({
  contactRowId: z.string().min(1),
  role: z.nativeEnum(Role).optional()
});

const metaSchema = z.object({
  categoryLabelsCsv: z.string().max(4000),
  internalStaffFooterContact: z.string().max(240).optional().nullable()
});

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizeHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function mapCsvHeaderToKey(h: string): string | null {
  const n = normalizeHeader(h);
  const map: Record<string, string> = {
    name: "name",
    fullname: "name",
    staffid: "staffEmployeeId",
    staff_id: "staffEmployeeId",
    employeeid: "staffEmployeeId",
    employee_id: "staffEmployeeId",
    id: "staffEmployeeId",
    email: "email",
    mail: "email",
    department: "department",
    dept: "department",
    phone: "phone",
    mobile: "phone",
    country: "country",
    countrycode: "countryCode",
    country_code: "countryCode",
    dialcode: "countryCode",
    dial_code: "countryCode",
    haswhatsapp: "hasWhatsapp",
    whatsapp: "hasWhatsapp",
    category: "category",
    branch: "branch",
    company: "company",
    jobtitle: "jobTitle",
    job_title: "jobTitle",
    status: "employmentStatus",
    employment: "employmentStatus",
    employmentstatus: "employmentStatus",
    datejoined: "dateJoined",
    joined: "dateJoined",
    rank: "rank",
    title: "rank",
    crmkind: "crmKind",
    crm_kind: "crmKind",
    kind: "crmKind",
    lifecycle: "lifecycleStage",
    lifecyclestage: "lifecycleStage",
    notes: "notes",
    tags: "tags",
    linkedin: "linkedinUrl",
    linkedinurl: "linkedinUrl",
    website: "website",
    source: "source"
  };
  return map[n] ?? null;
}

function parseBoolCell(v: string | undefined): boolean {
  const t = (v ?? "").trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes" || t === "y";
}

function parseEmploymentCell(v: string | undefined): StaffEmploymentStatus {
  const t = (v ?? "").trim().toUpperCase();
  if (t === "CONTRACT" || t === "C") return StaffEmploymentStatus.CONTRACT;
  return StaffEmploymentStatus.PERMANENT;
}

function parseCrmKindCell(v: string | undefined): CrmContactKind | undefined {
  const raw = (v ?? "").trim();
  if (!raw) return undefined;

  const t = raw.toUpperCase().replace(/\s+/g, "_");
  const allowed = new Set(Object.values(CrmContactKind));
  if (allowed.has(t as CrmContactKind)) return t as CrmContactKind;

  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[&/|]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aliases: Record<string, CrmContactKind> = {
    attendee: CrmContactKind.ATTENDEE,
    guest: CrmContactKind.ATTENDEE,
    "attendee guest": CrmContactKind.ATTENDEE,
    employee: CrmContactKind.EMPLOYEE,
    internal: CrmContactKind.EMPLOYEE,
    "employee internal": CrmContactKind.EMPLOYEE,
    media: CrmContactKind.MEDIA_PRESS,
    press: CrmContactKind.MEDIA_PRESS,
    "media press": CrmContactKind.MEDIA_PRESS,
    stakeholder: CrmContactKind.STAKEHOLDER,
    sponsor: CrmContactKind.SPONSOR,
    vip: CrmContactKind.VIP,
    vendor: CrmContactKind.VENDOR,
    speaker: CrmContactKind.SPEAKER,
    faculty: CrmContactKind.SPEAKER,
    "speaker faculty": CrmContactKind.SPEAKER,
    other: CrmContactKind.OTHER
  };

  const mapped = aliases[normalized];
  if (mapped) return mapped;

  const tokens = new Set(normalized.split(" ").filter(Boolean));
  if (tokens.has("media") || tokens.has("press")) return CrmContactKind.MEDIA_PRESS;
  if (tokens.has("speaker") || tokens.has("faculty") || tokens.has("faulty")) return CrmContactKind.SPEAKER;
  if (tokens.has("employee") || tokens.has("internal")) return CrmContactKind.EMPLOYEE;
  if (tokens.has("attendee") || tokens.has("guest")) return CrmContactKind.ATTENDEE;

  return undefined;
}

function parseTagsCell(v: string | undefined): string[] | undefined {
  const raw = (v ?? "").trim();
  if (!raw) return undefined;
  const parts = raw
    .split(/[;,]/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
  return parts.length ? parts : undefined;
}

export async function upsertOrgContactRow(
  input: z.input<typeof upsertSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canManageOrgContacts(session.user.role)) {
    return { success: false, error: "You do not have permission to manage contacts." };
  }

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const emailLower = parsed.data.email.trim().toLowerCase();
  const phoneTrim = parsed.data.phone.trim();

  const dup = await orgContactConflictsForOrg(session.user.orgId, emailLower, phoneTrim, parsed.data.id);
  if (dup) {
    if (dup.email === emailLower) {
      return { success: false, error: "Another contact already uses this email." };
    }
    return { success: false, error: "Another contact already uses this phone number." };
  }

  const tagsJson =
    parsed.data.tags && parsed.data.tags.length > 0 ? parsed.data.tags : Prisma.JsonNull;

  const payload: OrgContactUpsertInput = {
    name: parsed.data.name.trim(),
    staffEmployeeId: parsed.data.staffEmployeeId?.trim() || null,
    email: emailLower,
    phone: phoneTrim,
    company: parsed.data.company?.trim() || null,
    jobTitle: parsed.data.jobTitle?.trim() || null,
    department: parsed.data.department?.trim() || null,
    hasWhatsapp: parsed.data.hasWhatsapp ?? false,
    category: parsed.data.category?.trim() || null,
    branch: parsed.data.branch?.trim() || null,
    employmentStatus: parsed.data.employmentStatus,
    dateJoined: parsed.data.dateJoined,
    rank: parsed.data.rank?.trim() || null,
    crmKind: parsed.data.crmKind ?? CrmContactKind.OTHER,
    lifecycleStage: parsed.data.lifecycleStage?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
    tags: tagsJson,
    linkedinUrl: parsed.data.linkedinUrl?.trim() || null,
    website: parsed.data.website?.trim() || null,
    source: parsed.data.source?.trim() || (!parsed.data.id ? "manual" : null)
  };

  try {
    if (parsed.data.id) {
      const existing = await prisma.orgContact.findFirst({
        where: { id: parsed.data.id, orgId: session.user.orgId }
      });
      if (!existing) return { success: false, error: "Contact not found." };
      await prisma.orgContact.update({
        where: { id: existing.id },
        data: payload
      });
    } else {
      const created = await prisma.orgContact.create({
        data: { ...payload, orgId: session.user.orgId },
        select: { id: true }
      });
      revalidatePath("/dashboard/settings");
      revalidatePath("/events/new");
      revalidatePath("/crm");
      return { success: true, data: { id: created.id } };
    }
    revalidatePath("/dashboard/settings");
    revalidatePath("/events/new");
    revalidatePath("/crm");
    return { success: true, data: { id: parsed.data.id } };
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      return { success: false, error: "Duplicate email or phone in this organization." };
    }
    return { success: false, error: "Could not save contact." };
  }
}

export async function deleteOrgContactRow(input: z.input<typeof deleteSchema>): Promise<ActionResult<{ deleted: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canManageOrgContacts(session.user.role)) {
    return { success: false, error: "You do not have permission to manage contacts." };
  }

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const row = await prisma.orgContact.findFirst({
    where: { id: parsed.data.id, orgId: session.user.orgId }
  });
  if (!row) return { success: false, error: "Not found." };

  await prisma.orgContact.delete({ where: { id: row.id } });
  revalidatePath("/dashboard/settings");
  revalidatePath("/events/new");
  revalidatePath("/crm");
  return { success: true, data: { deleted: true } };
}

export async function deleteOrgContactRows(
  input: z.input<typeof deleteManySchema>
): Promise<ActionResult<{ deleted: number }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canManageOrgContacts(session.user.role)) {
    return { success: false, error: "You do not have permission to delete contacts." };
  }

  const parsed = deleteManySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const orgId = session.user.orgId;
  const uniqueIds = [...new Set(parsed.data.ids)];
  const found = await prisma.orgContact.findMany({
    where: { orgId, id: { in: uniqueIds } },
    select: { id: true }
  });
  if (found.length === 0) {
    return { success: true, data: { deleted: 0 } };
  }

  await prisma.orgContact.deleteMany({
    where: { orgId, id: { in: found.map((r) => r.id) } }
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/events/new");
  revalidatePath("/crm");
  return { success: true, data: { deleted: found.length } };
}

const importCsvSchema = z.object({
  csvText: z.string().max(2_000_000),
  /** When true (default), rows matching an existing CRM contact by email or phone overwrite that record. */
  updateExisting: z.boolean().optional().default(true)
});

type PreparedImportRow = {
  rowNum: number;
  name: string;
  emailLower: string;
  phoneTrim: string;
  data: z.infer<typeof upsertSchema>;
};

function importIssue(
  row: PreparedImportRow,
  conflictField: CrmImportConflictField,
  duplicateValue: string,
  conflictWith: string,
  reason: string
): CrmImportIssue {
  return {
    row: row.rowNum,
    name: row.name,
    email: row.emailLower,
    phone: row.phoneTrim,
    conflictField,
    duplicateValue,
    conflictWith,
    reason
  };
}

function describeExistingContact(contact: { name: string; email: string; phone: string }): string {
  return `Existing CRM: ${contact.name} (${contact.email}, ${contact.phone})`;
}

function buildImportContactFields(row: PreparedImportRow) {
  const tagsJson =
    row.data.tags && row.data.tags.length > 0 ? row.data.tags : Prisma.JsonNull;
  const crmKind = row.data.crmKind ?? CrmContactKind.OTHER;
  return {
    name: row.data.name.trim(),
    phone: row.phoneTrim,
    staffEmployeeId: row.data.staffEmployeeId?.trim() || null,
    company: row.data.company?.trim() || null,
    jobTitle: row.data.jobTitle?.trim() || null,
    department: row.data.department?.trim() || null,
    hasWhatsapp: row.data.hasWhatsapp ?? false,
    category: row.data.category?.trim() || null,
    branch: row.data.branch?.trim() || null,
    employmentStatus: row.data.employmentStatus,
    dateJoined: row.data.dateJoined,
    rank: row.data.rank?.trim() || null,
    crmKind,
    lifecycleStage: row.data.lifecycleStage?.trim() || null,
    notes: row.data.notes?.trim() || null,
    tags: tagsJson,
    linkedinUrl: row.data.linkedinUrl?.trim() || null,
    website: row.data.website?.trim() || null,
    source: row.data.source?.trim() || "import_csv"
  };
}

export async function importOrgContactsFromCsv(
  input: z.input<typeof importCsvSchema>
): Promise<ActionResult<CrmImportResult>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canManageOrgContacts(session.user.role)) {
    return { success: false, error: "You do not have permission to manage contacts." };
  }

  const parsed = importCsvSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const updateExisting = parsed.data.updateExisting;

  const lines = parsed.data.csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { success: false, error: "CSV needs a header row and at least one data row." };
  }

  const headers = splitCsvLine(lines[0]).map((h) => mapCsvHeaderToKey(h));
  if (!headers.includes("name")) {
    return { success: false, error: 'CSV must include a "name" column.' };
  }
  const idx = (key: string) => headers.findIndex((h) => h === key);

  const iName = idx("name");
  const iEmail = idx("email");
  const iPhone = idx("phone");
  const iCountry = idx("country");
  const iCountryCode = idx("countryCode");
  if (iEmail < 0 || iPhone < 0) {
    return { success: false, error: 'CSV must include "email" and "phone" columns.' };
  }

  let imported = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  const issues: CrmImportIssue[] = [];
  const prepared: PreparedImportRow[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]);
    const pick = (i: number) => cells[i]?.trim() ?? "";
    const name = pick(iName);
    const email = pick(iEmail);
    const phone = pick(iPhone);
    const country = pick(iCountry);
    const countryCode = pick(iCountryCode);
    if (!name && !email && !phone) continue;
    if (!name || !email || !phone) {
      skipped += 1;
      errors.push(`Row ${r + 1}: missing name, email, or phone.`);
      continue;
    }
    const normalizedPhone = normalizeImportedPhoneToE164(phone, {
      country: country || null,
      countryCode: countryCode || null
    });
    if (!normalizedPhone.ok) {
      skipped += 1;
      errors.push(`Row ${r + 1}: ${normalizedPhone.message}`);
      continue;
    }

    const rowParsed = upsertSchema.safeParse({
      name,
      email,
      phone: normalizedPhone.phone,
      staffEmployeeId: pick(idx("staffEmployeeId")) || null,
      company: pick(idx("company")) || null,
      jobTitle: pick(idx("jobTitle")) || null,
      department: pick(idx("department")) || null,
      hasWhatsapp: parseBoolCell(pick(idx("hasWhatsapp"))),
      category: pick(idx("category")) || null,
      branch: pick(idx("branch")) || null,
      employmentStatus: parseEmploymentCell(pick(idx("employmentStatus"))),
      dateJoined: pick(idx("dateJoined")) ? new Date(pick(idx("dateJoined"))) : new Date(),
      rank: pick(idx("rank")) || null,
      crmKind: parseCrmKindCell(pick(idx("crmKind"))),
      lifecycleStage: pick(idx("lifecycleStage")) || null,
      notes: pick(idx("notes")) || null,
      tags: parseTagsCell(pick(idx("tags"))),
      linkedinUrl: pick(idx("linkedinUrl")) || null,
      website: pick(idx("website")) || null,
      source: pick(idx("source")) || "import_csv"
    });
    if (!rowParsed.success) {
      skipped += 1;
      errors.push(`Row ${r + 1}: ${rowParsed.error.issues[0]?.message ?? "invalid"}`);
      continue;
    }

    if (!isCrmInviteableProfile(rowParsed.data.email, rowParsed.data.phone)) {
      skipped += 1;
      errors.push(
        `Row ${r + 1}: needs a valid work email and international mobile format (for example +14155552671). Placeholder or Zoom-generated addresses are not imported.`
      );
      continue;
    }

    prepared.push({
      rowNum: r + 1,
      name: rowParsed.data.name.trim(),
      emailLower: rowParsed.data.email.trim().toLowerCase(),
      phoneTrim: rowParsed.data.phone.trim(),
      data: rowParsed.data
    });
  }

  const emailFirstRow = new Map<string, PreparedImportRow>();
  const phoneFirstRow = new Map<string, PreparedImportRow>();
  const blockedRows = new Set<number>();

  for (const row of prepared) {
    const emailOwner = emailFirstRow.get(row.emailLower);
    if (emailOwner) {
      blockedRows.add(row.rowNum);
      skipped += 1;
      issues.push(
        importIssue(
          row,
          "email",
          row.emailLower,
          `Row ${emailOwner.rowNum} (${emailOwner.name})`,
          `Duplicate email in file — same as row ${emailOwner.rowNum}.`
        )
      );
      continue;
    }

    const phoneOwner = phoneFirstRow.get(row.phoneTrim);
    if (phoneOwner) {
      blockedRows.add(row.rowNum);
      skipped += 1;
      issues.push(
        importIssue(
          row,
          "phone",
          row.phoneTrim,
          `Row ${phoneOwner.rowNum} (${phoneOwner.name}, ${phoneOwner.emailLower})`,
          `Duplicate phone in file — same number as row ${phoneOwner.rowNum} after normalization.`
        )
      );
      continue;
    }

    emailFirstRow.set(row.emailLower, row);
    phoneFirstRow.set(row.phoneTrim, row);
  }

  const existingContacts = await prisma.orgContact.findMany({
    where: { orgId: session.user.orgId },
    select: { id: true, name: true, email: true, phone: true }
  });
  const existingByEmail = new Map(existingContacts.map((c) => [c.email.toLowerCase(), c]));
  const existingByPhone = new Map(existingContacts.map((c) => [c.phone, c]));

  for (const row of prepared) {
    if (blockedRows.has(row.rowNum)) continue;

    const byEmail = existingByEmail.get(row.emailLower);
    const byPhone = existingByPhone.get(row.phoneTrim);

    if (!updateExisting && (byEmail || byPhone)) {
      skipped += 1;
      const match = byEmail ?? byPhone!;
      errors.push(
        `Row ${row.rowNum}: already in CRM as ${match.name} (${match.email}). Enable "Update existing contacts" to overwrite.`
      );
      continue;
    }

    if (byEmail) {
      const phoneTaken = existingByPhone.get(row.phoneTrim);
      if (phoneTaken && phoneTaken.id !== byEmail.id) {
        blockedRows.add(row.rowNum);
        skipped += 1;
        issues.push(
          importIssue(
            row,
            "phone",
            row.phoneTrim,
            describeExistingContact(phoneTaken),
            `Email matches an existing contact, but this phone belongs to another CRM record.`
          )
        );
        continue;
      }
    } else if (byPhone) {
      const emailTaken = existingByEmail.get(row.emailLower);
      if (emailTaken && emailTaken.id !== byPhone.id) {
        blockedRows.add(row.rowNum);
        skipped += 1;
        issues.push(
          importIssue(
            row,
            "email",
            row.emailLower,
            describeExistingContact(emailTaken),
            `Phone matches an existing contact, but this email belongs to another CRM record.`
          )
        );
        continue;
      }
    }

    const fields = buildImportContactFields(row);

    try {
      let savedId: string;
      const wasExisting = Boolean(byEmail || byPhone);

      if (!byEmail && byPhone) {
        await prisma.orgContact.update({
          where: { id: byPhone.id },
          data: { email: row.emailLower, ...fields }
        });
        savedId = byPhone.id;
      } else {
        const saved = await prisma.orgContact.upsert({
          where: { orgId_email: { orgId: session.user.orgId, email: row.emailLower } },
          create: {
            orgId: session.user.orgId,
            email: row.emailLower,
            ...fields
          },
          update: fields,
          select: { id: true }
        });
        savedId = saved.id;
      }

      imported += 1;
      if (wasExisting) updated += 1;
      else created += 1;

      const savedContact = {
        id: savedId,
        name: row.name,
        email: row.emailLower,
        phone: row.phoneTrim
      };
      existingByEmail.set(row.emailLower, savedContact);
      existingByPhone.set(row.phoneTrim, savedContact);

      if (byPhone && byPhone.id !== savedId) {
        existingByPhone.delete(byPhone.phone);
      }
      if (byEmail && byEmail.phone !== row.phoneTrim) {
        const oldPhoneOwner = existingByPhone.get(byEmail.phone);
        if (oldPhoneOwner?.id === byEmail.id) {
          existingByPhone.delete(byEmail.phone);
        }
      }
    } catch (e: unknown) {
      skipped += 1;
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      errors.push(
        `Row ${row.rowNum}: ${code === "P2002" ? "database uniqueness conflict (email or phone)" : "could not import row"}`
      );
    }
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/events/new");
  revalidatePath("/crm");
  return {
    success: true,
    data: {
      imported,
      created,
      updated,
      skipped,
      errors: errors.slice(0, 40),
      issues: issues.slice(0, 500)
    }
  };
}

export async function promoteOrgContactToWorkspaceUser(
  input: z.input<typeof promoteSchema>
): Promise<ActionResult<{ userId: string; linked: boolean; inviteEmailSent?: boolean }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (session.user.role !== Role.ADMIN) {
    return { success: false, error: "Only admins can link contacts to workspace users." };
  }

  const parsed = promoteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const contact = await prisma.orgContact.findFirst({
    where: { id: parsed.data.contactRowId, orgId: session.user.orgId }
  });
  if (!contact) return { success: false, error: "Contact not found." };
  if (contact.userId) {
    revalidatePath("/crm");
    return { success: true, data: { userId: contact.userId, linked: true } };
  }

  const role = parsed.data.role ?? Role.STAFF;
  if (role === Role.ADMIN) {
    return { success: false, error: "Choose a non-admin role when inviting from the contact directory." };
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: contact.email.toLowerCase(), orgId: session.user.orgId }
  });

  if (existingUser) {
    const otherLink = await prisma.orgContact.findFirst({
      where: { userId: existingUser.id, NOT: { id: contact.id } }
    });
    if (otherLink) {
      return { success: false, error: "That workspace user is already linked to another contact." };
    }
    await prisma.orgContact.update({
      where: { id: contact.id },
      data: { userId: existingUser.id }
    });
    revalidatePath("/dashboard/settings");
    revalidatePath("/events/new");
    revalidatePath("/crm");
    return { success: true, data: { userId: existingUser.id, linked: true } };
  }

  const created = await createOrgUser({
    email: contact.email,
    name: contact.name,
    role
  });
  if (!created.success || !created.data) {
    return { success: false, error: created.error ?? "Could not create user." };
  }

  await prisma.orgContact.update({
    where: { id: contact.id },
    data: { userId: created.data.id }
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/events/new");
  revalidatePath("/crm");
  return {
    success: true,
    data: {
      userId: created.data.id,
      linked: true,
      inviteEmailSent: created.data.inviteEmailSent
    }
  };
}

export async function updateOrgContactDirectoryMeta(
  input: z.input<typeof metaSchema>
): Promise<ActionResult<{ saved: true }>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canManageOrgContacts(session.user.role)) {
    return { success: false, error: "You do not have permission to update organization contact settings." };
  }

  const parsed = metaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const labels = parsed.data.categoryLabelsCsv
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 80);

  await prisma.organization.update({
    where: { id: session.user.orgId },
    data: {
      contactCategoryLabels: labels,
      internalStaffFooterContact: parsed.data.internalStaffFooterContact?.trim() || null
    }
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/events/new");
  revalidatePath("/crm");
  return { success: true, data: { saved: true } };
}
