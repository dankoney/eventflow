import { z } from "zod";

export const resourceLinkRowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  url: z.string().url("Enter a valid URL (https://…)")
});

export type ResourceLinkRow = z.infer<typeof resourceLinkRowSchema>;

export const resourceLinksPayloadSchema = z.array(resourceLinkRowSchema).max(40);

export function parseResourceLinks(raw: unknown): ResourceLinkRow[] {
  const p = resourceLinksPayloadSchema.safeParse(raw);
  return p.success ? p.data : [];
}
