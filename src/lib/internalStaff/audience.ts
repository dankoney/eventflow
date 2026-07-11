import { CrmContactKind, EventBlueprintTemplate, StaffEmploymentStatus } from "@prisma/client";
import { z } from "zod";

/** Legacy JSON used `staffIds`; those IDs are OrgContact rows after the staff→contact migration. */
export function normalizeAudienceJson(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  if (o.mode === "MANUAL" && Array.isArray(o.staffIds) && !Array.isArray(o.contactIds)) {
    return { ...o, contactIds: o.staffIds };
  }
  return raw;
}

export const internalStaffAudienceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("ENTIRE_ORG"),
    excludeCategories: z.array(z.string().max(80)).max(50).optional(),
    /** Default false: only include staff contacts (employee/internal). */
    includeAllContactTypes: z.boolean().optional()
  }),
  z.object({
    mode: z.literal("DEPARTMENTS"),
    departments: z.array(z.string().min(1).max(120)).min(1).max(50),
    includeAllContactTypes: z.boolean().optional()
  }),
  z.object({
    mode: z.literal("RANKS"),
    ranks: z.array(z.string().min(1).max(120)).min(1).max(50),
    includeAllContactTypes: z.boolean().optional()
  }),
  z.object({
    mode: z.literal("EMPLOYMENT_STATUS"),
    employmentStatuses: z.array(z.nativeEnum(StaffEmploymentStatus)).min(1).max(5),
    includeAllContactTypes: z.boolean().optional()
  }),
  z.object({
    mode: z.literal("CRM_KINDS"),
    crmKinds: z.array(z.nativeEnum(CrmContactKind)).min(1).max(9),
    includeAllContactTypes: z.boolean().optional()
  }),
  z.object({
    mode: z.literal("GROUPS"),
    groupIds: z.array(z.string().min(1)).min(1).max(80),
    includeAllContactTypes: z.boolean().optional()
  }),
  z.object({
    mode: z.literal("MANUAL"),
    contactIds: z.array(z.string().min(1)).min(1).max(600),
    includeAllContactTypes: z.boolean().optional()
  })
]);

export type InternalStaffAudience = z.infer<typeof internalStaffAudienceSchema>;

export function defaultInternalStaffAudience(): InternalStaffAudience {
  return { mode: "ENTIRE_ORG", excludeCategories: [], includeAllContactTypes: false };
}

export function parseInternalStaffAudienceJson(
  template: EventBlueprintTemplate,
  raw: unknown
): InternalStaffAudience | null {
  if (template !== EventBlueprintTemplate.INTERNAL_STAFF) return null;
  const parsed = internalStaffAudienceSchema.safeParse(normalizeAudienceJson(raw));
  if (parsed.success) return parsed.data;
  return defaultInternalStaffAudience();
}

export function internalStaffAudienceForPrisma(
  template: EventBlueprintTemplate,
  raw: unknown
): InternalStaffAudience {
  return parseInternalStaffAudienceJson(template, raw) ?? defaultInternalStaffAudience();
}
