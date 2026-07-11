import { z } from "zod";

import { isCrmEligibleEmail } from "@/lib/crm/contactEligibility";
import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";

export type EmailMandatoryEvent = {
  emailMandatoryForRegistration?: boolean | null;
};

/** Whether the event requires a valid email at registration time. Defaults to true. */
export function isEmailMandatoryForEvent(event: EmailMandatoryEvent): boolean {
  return event.emailMandatoryForRegistration !== false;
}

/** Guest has a deliverable email address for transactional email. */
export function guestHasDeliverableEmail(email: string | null | undefined): boolean {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed) return false;
  if (!z.string().email().safeParse(trimmed).success) return false;
  return isCrmEligibleEmail(trimmed);
}

export function normalizeGuestEmailInput(
  raw: string | null | undefined,
  emailRequired: boolean
): string | null {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (!trimmed) return emailRequired ? "" : null;
  return trimmed;
}

type ContactRefinementCtx = {
  emailRequired: boolean;
};

function refineGuestContactFields(
  data: { email?: string | null; phone: string },
  ctx: z.RefinementCtx,
  opts: ContactRefinementCtx
) {
  const email = (data.email ?? "").trim();
  if (opts.emailRequired) {
    if (!email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email is required.", path: ["email"] });
    } else if (!z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid email address.",
        path: ["email"]
      });
    }
  } else if (email && !z.string().email().safeParse(email).success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid email address or leave blank.",
      path: ["email"]
    });
  }

  if (!data.phone?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Mobile phone is required.",
      path: ["phone"]
    });
  } else if (!isValidE164(data.phone.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter phone in international format, e.g. +233501234567.",
      path: ["phone"]
    });
  }
}

/** Zod email field — required or optional based on event setting. */
export function guestEmailFieldSchema(emailRequired: boolean) {
  return emailRequired
    ? z.string().min(1, "Email is required.").email("Enter a valid email address.")
    : z
        .string()
        .optional()
        .nullable()
        .transform((v) => {
          const t = (v ?? "").trim().toLowerCase();
          return t || null;
        });
}

/** Base guest contact fields with phone always required. */
export function buildGuestContactFieldsSchema(emailRequired: boolean) {
  return z
    .object({
      email: guestEmailFieldSchema(emailRequired),
      phone: z.string().min(1, "Mobile phone is required")
    })
    .superRefine((data, ctx) => refineGuestContactFields(data, ctx, { emailRequired }));
}
