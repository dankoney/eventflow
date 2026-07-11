"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { assertRegistrationFieldCount } from "@/lib/billing/planLimits";
import { getOrgPlanForLimits } from "@/lib/db/billing";
import { prisma } from "@/lib/prisma";
import {
  customRegistrationFormDefinitionSchema,
  type CustomRegistrationFormDefinition
} from "@/lib/registration/customRegistrationForm";
import { canManageEventGuests } from "@/lib/permissions";

import type { ActionResult } from "@/types";

type GetResult = ActionResult<{
  name: string;
  form: CustomRegistrationFormDefinition | null;
}>;

export async function getEventCustomRegistrationForm(eventId: string): Promise<GetResult> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId: session.user.orgId },
    select: { name: true, customRegistrationForm: true }
  });
  if (!event) return { success: false, error: "Event not found" };
  const raw = event.customRegistrationForm;
  if (raw == null) {
    return { success: true, data: { name: event.name, form: null } };
  }
  const parsed = customRegistrationFormDefinitionSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: true, data: { name: event.name, form: null } };
  }
  return { success: true, data: { name: event.name, form: parsed.data } };
}

export async function saveEventCustomRegistrationForm(
  eventId: string,
  def: CustomRegistrationFormDefinition
): Promise<ActionResult<{ saved: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return { success: false, error: "Event not found" };

  const parsed = customRegistrationFormDefinitionSchema.safeParse(def);
  if (!parsed.success) {
    return { success: false, error: "Invalid form definition" };
  }

  const orgPlan = await getOrgPlanForLimits(session.user.orgId);
  if (!orgPlan) return { success: false, error: "Organization not found." };
  const fieldLimit = assertRegistrationFieldCount(orgPlan, parsed.data.fields.length);
  if (!fieldLimit.ok) return { success: false, error: fieldLimit.error };

  await prisma.event.update({
    where: { id: eventId },
    data: { customRegistrationForm: parsed.data as object }
  });
  revalidatePath(`/events/${eventId}/guests`);
  revalidatePath(`/events/${eventId}/guests/form`);
  return { success: true, data: { saved: true } };
}
