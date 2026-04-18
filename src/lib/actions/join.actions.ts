"use server";

import { z } from "zod";

import { recordVirtualJoinAndGetZoomUrl } from "@/lib/join/recordVirtualJoinCore";
import type { ActionResult } from "@/types";

const recordJoinSchema = z.object({
  guestId: z.string().min(1)
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

/**
 * Marks a virtual guest as JOINED (self-service from /join/[guestId]).
 * Idempotent for JOINED / CHECKED_IN. No auth — guest id is the capability token.
 */
export async function recordVirtualJoin(
  input: z.input<typeof recordJoinSchema>
): Promise<ActionResult<{ alreadyMarked: boolean }>> {
  const parsed = recordJoinSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const res = await recordVirtualJoinAndGetZoomUrl(parsed.data.guestId);
  if (!res.ok) return { success: false, error: res.error };
  return { success: true, data: { alreadyMarked: res.alreadyMarked } };
}
