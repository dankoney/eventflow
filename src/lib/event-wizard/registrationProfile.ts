import { EventBlueprintTemplate } from "@prisma/client";
import { z } from "zod";

/** Persisted on Event.registrationProfile (JSON). */
export const registrationProfileSchema = z.object({
  requireCompany: z.boolean(),
  requireJobTitle: z.boolean(),
  requireStaffId: z.boolean(),
  requireDepartment: z.boolean(),
  enableSavedProfileLookup: z.boolean().default(false)
});

export type RegistrationProfile = z.infer<typeof registrationProfileSchema>;

export const DEFAULT_REGISTRATION_PROFILE: RegistrationProfile = {
  requireCompany: false,
  requireJobTitle: false,
  requireStaffId: false,
  requireDepartment: false,
  enableSavedProfileLookup: false
};

export function parseRegistrationProfile(raw: unknown): RegistrationProfile {
  const p = registrationProfileSchema.safeParse(raw);
  if (p.success) return p.data;
  const legacy = z
    .object({
      requireCompany: z.boolean().optional(),
      requireJobTitle: z.boolean().optional(),
      requireStaffId: z.boolean().optional(),
      requireDepartment: z.boolean().optional()
    })
    .safeParse(raw);
  if (legacy.success) {
    return { ...DEFAULT_REGISTRATION_PROFILE, ...legacy.data };
  }
  return DEFAULT_REGISTRATION_PROFILE;
}

export function registrationProfileForTemplate(template: EventBlueprintTemplate): RegistrationProfile {
  switch (template) {
    case "CONFERENCE":
      return {
        requireCompany: true,
        requireJobTitle: true,
        requireStaffId: false,
        requireDepartment: false,
        enableSavedProfileLookup: false
      };
    case "INTERNAL_STAFF":
      return {
        requireCompany: false,
        requireJobTitle: false,
        requireStaffId: true,
        requireDepartment: true,
        enableSavedProfileLookup: false
      };
    default:
      return { ...DEFAULT_REGISTRATION_PROFILE };
  }
}
