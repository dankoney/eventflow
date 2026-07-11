import { redirect } from "next/navigation";

import { planIncludesModule } from "@/lib/billing/planLimits";
import { getOrgPlanForLimits } from "@/lib/db/billing";
import {
  isModuleEnabled,
  moduleDisabledMessage,
  type EventflowModuleId
} from "./modules";

/** Redirect dashboard users away from a disabled module route. */
export function requireModuleEnabled(
  module: EventflowModuleId,
  redirectTo = "/dashboard"
): void {
  if (!isModuleEnabled(module)) {
    redirect(redirectTo);
  }
}

/**
 * Env module flag + org plan catalog. Use in server actions.
 * Env off → server disabled message; plan missing module → upgrade message.
 */
export async function guardModuleActionForOrg(
  orgId: string,
  module: EventflowModuleId
): Promise<{ success: false; error: string } | null> {
  if (!isModuleEnabled(module)) {
    return { success: false, error: moduleDisabledMessage(module) };
  }
  const org = await getOrgPlanForLimits(orgId);
  if (!org) return { success: false, error: "Workspace not found." };
  if (!planIncludesModule(org.plan, module)) {
    return {
      success: false,
      error: `This feature is not included on the ${org.plan} plan. Upgrade in Settings → Billing to unlock it.`
    };
  }
  return null;
}

/** Server action guard — returns a failure result when the module is off (env only). */
export function guardModuleAction(
  module: EventflowModuleId
): { success: false; error: string } | null {
  if (!isModuleEnabled(module)) {
    return { success: false, error: moduleDisabledMessage(module) };
  }
  return null;
}
