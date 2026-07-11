import { CrmContactKind, Tier } from "@prisma/client";
import { z } from "zod";

import { SEGMENT_GROUP_UNGROUPED } from "@/lib/guests/segmentFilters";

export const guestSegmentFilterSchema = z.object({
  mode: z.enum(["include", "exclude"]).default("include"),
  tiers: z.array(z.nativeEnum(Tier)).optional(),
  groupIds: z.array(z.union([z.string().min(1), z.literal(SEGMENT_GROUP_UNGROUPED)])).optional(),
  contactCategories: z.array(z.string().min(1)).optional(),
  crmKinds: z.array(z.nativeEnum(CrmContactKind)).optional(),
  companies: z.array(z.string().min(1)).optional(),
  emailDomains: z.array(z.string().min(1)).optional()
});

export type GuestSegmentFilterPayload = z.infer<typeof guestSegmentFilterSchema>;
