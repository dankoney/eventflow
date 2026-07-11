import { InternalStaffMealMenuScope } from "@prisma/client";
import { z } from "zod";

const mealItemsSchema = z.array(z.string().trim().min(1).max(80)).max(24);

export function parseInternalStaffMealMenuItems(raw: unknown): string[] {
  if (raw == null) return [];
  const p = mealItemsSchema.safeParse(raw);
  return p.success ? p.data : [];
}

const branchMenuRowSchema = z.object({
  branch: z.string().trim().min(1).max(120),
  items: mealItemsSchema.min(1)
});

const branchMenusSchema = z.array(branchMenuRowSchema).min(1).max(24);

export type InternalStaffBranchMealMenuRow = z.infer<typeof branchMenuRowSchema>;

export function parseInternalStaffMealMenusByBranch(raw: unknown): InternalStaffBranchMealMenuRow[] {
  if (raw == null) return [];
  const p = branchMenusSchema.safeParse(raw);
  return p.success ? p.data : [];
}

export const internalStaffMealMenusByBranchPayloadSchema = branchMenusSchema;

/** Returns the canonical label from `allowed` when `choice` matches case-insensitively, else null. */
export function resolveMealChoiceLabel(choice: string, allowed: string[]): string | null {
  const t = choice.trim();
  if (!t) return null;
  const low = t.toLowerCase();
  for (const a of allowed) {
    if (a.toLowerCase() === low) return a;
  }
  return null;
}

function normBranch(s: string) {
  return s.trim().toLowerCase();
}

/**
 * Meal labels this guest may choose from, or empty when no meal step applies.
 * When `enabled` and internal staff, empty can mean misconfiguration (caller should treat as error if selection was expected).
 */
export function mealLabelsForInternalGuest(params: {
  mealMenuEnabled: boolean;
  mealMenuScope: InternalStaffMealMenuScope;
  mealMenuItemsJson: unknown;
  mealMenusByBranchJson: unknown;
  guestBranch: string | null;
}): string[] {
  if (!params.mealMenuEnabled) return [];

  if (params.mealMenuScope === InternalStaffMealMenuScope.ALL_STAFF) {
    return parseInternalStaffMealMenuItems(params.mealMenuItemsJson);
  }

  const rows = parseInternalStaffMealMenusByBranch(params.mealMenusByBranchJson);
  const g = params.guestBranch?.trim();
  if (!g) return [];
  const key = normBranch(g);
  const row = rows.find((r) => normBranch(r.branch) === key);
  return row?.items ?? [];
}

/** True when self check-in should collect a meal (menus configured for the current scope). */
export function internalStaffMealStepConfigured(params: {
  mealMenuEnabled: boolean;
  mealMenuScope: InternalStaffMealMenuScope;
  mealMenuItemsJson: unknown;
  mealMenusByBranchJson: unknown;
}): boolean {
  if (!params.mealMenuEnabled) return false;
  if (params.mealMenuScope === InternalStaffMealMenuScope.ALL_STAFF) {
    return parseInternalStaffMealMenuItems(params.mealMenuItemsJson).length > 0;
  }
  return parseInternalStaffMealMenusByBranch(params.mealMenusByBranchJson).length > 0;
}
