import { z } from "zod";

const fieldTypeSchema = z.enum([
  "TITLE",
  "SHORT_TEXT",
  "PARAGRAPH",
  "MULTIPLE_CHOICE",
  "CHECKBOX",
  "DROPDOWN",
  "FILE"
]);

const fieldSchema = z.object({
  id: z.string().min(1).max(64),
  type: fieldTypeSchema,
  label: z.string().min(1).max(200),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(200)).max(50).optional()
});

export const customRegistrationFormDefinitionSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(200),
  fields: z.array(fieldSchema).max(80)
});

export type CustomRegistrationFormField = z.infer<typeof fieldSchema>;
export type CustomRegistrationFormDefinition = z.infer<typeof customRegistrationFormDefinitionSchema>;

export function defaultCustomRegistrationForm(eventName: string): CustomRegistrationFormDefinition {
  return {
    version: 1,
    title: `${eventName} registration`,
    fields: [
      { id: cryptoRandomId(), type: "TITLE", label: "Tell us about you", required: false }
    ]
  };
}

/** Works in the browser (form builder) and on Node (server actions); avoid `node:` imports here. */
function cryptoRandomId() {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `f_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function newField(
  type: CustomRegistrationFormField["type"],
  label: string
): CustomRegistrationFormField {
  return {
    id: cryptoRandomId(),
    type,
    label,
    required: type !== "TITLE",
    options: type === "MULTIPLE_CHOICE" || type === "DROPDOWN" ? ["Option 1", "Option 2"] : undefined
  };
}
