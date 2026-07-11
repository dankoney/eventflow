import { OrgPlan } from "@prisma/client";

/** True when the workspace is on the free tier (watermarks / plan gates). */
export function isFreeOrgPlan(plan: OrgPlan): boolean {
  return plan === OrgPlan.FREE;
}
