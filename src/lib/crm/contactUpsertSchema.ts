import { CrmContactKind, StaffEmploymentStatus } from "@prisma/client";
import { z } from "zod";

import { isCrmEligibleEmail } from "@/lib/crm/contactEligibility";
import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";

const orgContactUpsertBaseSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(2).max(120),
  staffEmployeeId: z.string().max(80).optional().nullable(),
  email: z.string().email(),
  phone: z.string().min(1, "Mobile phone is required"),
  company: z.string().max(120).optional().nullable(),
  jobTitle: z.string().max(120).optional().nullable(),
  department: z.string().max(120).optional().nullable(),
  hasWhatsapp: z.boolean().optional(),
  category: z.string().max(80).optional().nullable(),
  branch: z.string().max(120).optional().nullable(),
  employmentStatus: z.nativeEnum(StaffEmploymentStatus),
  dateJoined: z.coerce.date(),
  rank: z.string().max(120).optional().nullable(),
  crmKind: z.nativeEnum(CrmContactKind).optional(),
  lifecycleStage: z.string().max(48).optional().nullable(),
  notes: z.string().max(50000).optional().nullable(),
  tags: z.array(z.string().max(80)).max(40).optional(),
  linkedinUrl: z.string().max(512).optional().nullable(),
  website: z.string().max(512).optional().nullable(),
  source: z.string().max(120).optional().nullable(),
  groupIds: z.array(z.string().min(1)).max(80).optional()
});

function contactUpsertRefine(
  data: {
    email: string;
    phone: string;
    linkedinUrl?: string | null;
    website?: string | null;
  },
  ctx: z.RefinementCtx
) {
  if (!isCrmEligibleEmail(data.email)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Use a real work email. Zoom placeholder or synthetic addresses cannot be saved to the CRM.",
      path: ["email"]
    });
  }
  if (!isValidE164(data.phone)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid international mobile number, for example +14155552671.",
      path: ["phone"]
    });
  }
  const checkUrl = (raw: string | null | undefined, path: "linkedinUrl" | "website") => {
    const t = (raw ?? "").trim();
    if (!t) return;
    try {
      const u = new URL(t);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "URL must start with http(s)://" });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "Invalid URL" });
    }
  };
  checkUrl(data.linkedinUrl, "linkedinUrl");
  checkUrl(data.website, "website");
}

/** Client CRM modal (includes `groupIds` for membership). */
export const orgContactUpsertFormSchema = orgContactUpsertBaseSchema.superRefine(contactUpsertRefine);

/** Server `upsertOrgContactRow` payload (no `groupIds`). */
export const orgContactUpsertServerSchema = orgContactUpsertBaseSchema.omit({ groupIds: true }).superRefine(contactUpsertRefine);

export type OrgContactUpsertFormValues = z.infer<typeof orgContactUpsertFormSchema>;
