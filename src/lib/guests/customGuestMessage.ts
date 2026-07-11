import { z } from "zod";

/** Same cap used for registration / invitation confirmation SMS in guest.actions. */
export const GUEST_DIRECT_SMS_MAX = 300;

export const GUEST_MESSAGE_MERGE_TAGS = [
  { tag: "[name]", label: "Full name" },
  { tag: "[first_name]", label: "First name" },
  { tag: "[email]", label: "Email" },
  { tag: "[event]", label: "Event name" },
  { tag: "[company]", label: "Company" }
] as const;

export type GuestMessageMergeVars = {
  name: string;
  email: string;
  eventName: string;
  company?: string | null;
};

export function firstNameFromGuestName(name: string): string {
  const f = name.trim().split(/\s+/)[0];
  return f && f.length > 0 ? f : "there";
}

/** Replace merge tags in organizer-authored copy (case-insensitive tag names). */
export function personalizeGuestMessageTemplate(template: string, vars: GuestMessageMergeVars): string {
  const firstName = firstNameFromGuestName(vars.name);
  const company = vars.company?.trim() || "";
  return template
    .replace(/\[name\]/gi, vars.name)
    .replace(/\[first_name\]/gi, firstName)
    .replace(/\[email\]/gi, vars.email)
    .replace(/\[event\]/gi, vars.eventName)
    .replace(/\[company\]/gi, company);
}

const guestMessageBase = z.object({
  eventId: z.string().min(1),
  guestId: z.string().min(1)
});

const blastBase = z.object({
  eventId: z.string().min(1)
});

const smsBodyField = z
  .string()
  .trim()
  .min(1, "SMS message is required.")
  .max(GUEST_DIRECT_SMS_MAX, `SMS must be ${GUEST_DIRECT_SMS_MAX} characters or fewer.`);

const emailFields = {
  subject: z.string().trim().min(3, "Subject must be at least 3 characters.").max(120),
  headline: z.string().trim().min(3, "Headline must be at least 3 characters.").max(120),
  message: z
    .string()
    .trim()
    .min(10, "Message body must be at least 10 characters.")
    .max(4000, "Message body must be 4000 characters or fewer.")
};

export const sendCustomGuestSmsSchema = guestMessageBase.extend({
  channel: z.literal("sms"),
  message: smsBodyField
});

export const sendCustomGuestEmailSchema = guestMessageBase.extend({
  channel: z.literal("email"),
  ...emailFields
});

export const sendCustomGuestMessageSchema = z.discriminatedUnion("channel", [
  sendCustomGuestSmsSchema,
  sendCustomGuestEmailSchema
]);

export const sendCustomGuestBlastSmsSchema = blastBase.extend({
  channel: z.literal("sms"),
  message: smsBodyField
});

export const sendCustomGuestBlastEmailSchema = blastBase.extend({
  channel: z.literal("email"),
  ...emailFields
});

export const sendCustomGuestBlastSchema = z.discriminatedUnion("channel", [
  sendCustomGuestBlastSmsSchema,
  sendCustomGuestBlastEmailSchema
]);

/** Union (not discriminatedUnion) — single vs blast share the same channel literals. */
export const previewCustomGuestMessageSchema = z.union([
  guestMessageBase.extend({ channel: z.literal("sms"), message: smsBodyField }),
  guestMessageBase.extend({ channel: z.literal("email"), ...emailFields }),
  blastBase.extend({ channel: z.literal("sms"), message: smsBodyField }),
  blastBase.extend({ channel: z.literal("email"), ...emailFields })
]);

export type SendCustomGuestMessageInput = z.infer<typeof sendCustomGuestMessageSchema>;
export type SendCustomGuestBlastInput = z.infer<typeof sendCustomGuestBlastSchema>;

/** Statuses eligible for custom organizer messages (registered / active attendees). */
export const CUSTOM_MESSAGE_GUEST_STATUSES = [
  "INVITED",
  "REGISTERED",
  "ACCEPTED",
  "CHECKED_IN",
  "JOINED"
] as const;
