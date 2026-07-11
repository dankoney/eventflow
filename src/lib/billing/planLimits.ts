import { EventStatus, EventType, OrgPlan, type Organization } from "@prisma/client";

import { PLAN_LIMITS, type PlanLimits } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/prisma";

/** Counts toward plan event caps — excludes completed and cancelled. */
export const ACTIVE_EVENT_STATUSES: EventStatus[] = [
  EventStatus.DRAFT,
  EventStatus.PUBLISHED,
  EventStatus.LIVE
];

export const VIRTUALISH_EVENT_TYPES: EventType[] = [EventType.VIRTUAL, EventType.HYBRID];

export function getPlanLimits(plan: OrgPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function planIncludesModule(plan: OrgPlan, moduleId: string): boolean {
  return PLAN_LIMITS[plan].modules.includes(moduleId);
}

export function monthWindowUtc(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

export async function countActiveEventsForOrg(
  orgId: string,
  options?: { excludeEventId?: string }
): Promise<number> {
  return prisma.event.count({
    where: {
      orgId,
      status: { in: ACTIVE_EVENT_STATUSES },
      ...(options?.excludeEventId ? { id: { not: options.excludeEventId } } : {})
    }
  });
}

export async function countActiveVirtualishEventsForOrg(
  orgId: string,
  options?: { excludeEventId?: string }
): Promise<number> {
  return prisma.event.count({
    where: {
      orgId,
      status: { in: ACTIVE_EVENT_STATUSES },
      type: { in: VIRTUALISH_EVENT_TYPES },
      ...(options?.excludeEventId ? { id: { not: options.excludeEventId } } : {})
    }
  });
}

export async function countGuestsForEvent(eventId: string): Promise<number> {
  return prisma.guest.count({ where: { eventId } });
}

export async function countTeamSeatsForOrg(orgId: string): Promise<number> {
  return prisma.user.count({ where: { orgId } });
}

export async function countBroadcastCampaignsThisMonth(
  orgId: string,
  now = new Date()
): Promise<number> {
  const { start, end } = monthWindowUtc(now);
  return prisma.emailCampaign.count({
    where: {
      orgId,
      createdAt: { gte: start, lt: end }
    }
  });
}

export async function countBroadcastRecipientsThisMonth(
  orgId: string,
  now = new Date()
): Promise<number> {
  const { start, end } = monthWindowUtc(now);
  return prisma.emailCampaignRecipient.count({
    where: {
      campaign: {
        orgId,
        sentAt: { gte: start, lt: end }
      }
    }
  });
}

export type PlanLimitCheck =
  | { ok: true }
  | { ok: false; error: string; code: string };

function upgradeHint(plan: OrgPlan): string {
  if (plan === OrgPlan.ENTERPRISE) return "Contact support if you need a higher limit.";
  return "Upgrade in Settings → Billing to raise this limit.";
}

export async function assertCanCreateActiveEvent(
  org: Pick<Organization, "id" | "plan">
): Promise<PlanLimitCheck> {
  const limits = getPlanLimits(org.plan);
  if (limits.maxActiveEvents == null) return { ok: true };

  const count = await countActiveEventsForOrg(org.id);
  if (count >= limits.maxActiveEvents) {
    return {
      ok: false,
      code: "max_active_events",
      error: `Your ${org.plan} plan allows ${limits.maxActiveEvents} active event${limits.maxActiveEvents === 1 ? "" : "s"} (draft, published, or live). Complete or cancel an event first. ${upgradeHint(org.plan)}`
    };
  }
  return { ok: true };
}

/**
 * Call before creating a virtual/hybrid event, or before changing an event
 * to virtual/hybrid. Pass `excludeEventId` when updating an existing event
 * so it is not counted against itself.
 */
export async function assertCanUseVirtualishEvent(
  org: Pick<Organization, "id" | "plan">,
  options?: { excludeEventId?: string }
): Promise<PlanLimitCheck> {
  const limits = getPlanLimits(org.plan);
  if (limits.maxConcurrentVirtualEvents == null) return { ok: true };

  const others = await countActiveVirtualishEventsForOrg(org.id, {
    excludeEventId: options?.excludeEventId
  });
  if (others >= limits.maxConcurrentVirtualEvents) {
    return {
      ok: false,
      code: "max_concurrent_virtual",
      error: `Your ${org.plan} plan allows ${limits.maxConcurrentVirtualEvents} virtual or hybrid event at a time. Complete or cancel an existing virtual/hybrid event first. ${upgradeHint(org.plan)}`
    };
  }
  return { ok: true };
}

export async function assertCanAddGuests(
  org: Pick<Organization, "plan">,
  eventId: string,
  addingCount: number
): Promise<PlanLimitCheck> {
  if (addingCount <= 0) return { ok: true };
  const limits = getPlanLimits(org.plan);
  if (limits.maxGuestsPerEvent == null) return { ok: true };

  const current = await countGuestsForEvent(eventId);
  if (current + addingCount > limits.maxGuestsPerEvent) {
    const remaining = Math.max(0, limits.maxGuestsPerEvent - current);
    return {
      ok: false,
      code: "max_guests_per_event",
      error: `Your ${org.plan} plan allows ${limits.maxGuestsPerEvent} guests per event (${current} on this event${remaining === 0 ? "" : `, ${remaining} slot${remaining === 1 ? "" : "s"} left`}). ${upgradeHint(org.plan)}`
    };
  }
  return { ok: true };
}

export async function assertCanAddTeamSeat(
  org: Pick<Organization, "id" | "plan">
): Promise<PlanLimitCheck> {
  const limits = getPlanLimits(org.plan);
  if (limits.maxTeamSeats == null) return { ok: true };

  const seats = await countTeamSeatsForOrg(org.id);
  if (seats >= limits.maxTeamSeats) {
    return {
      ok: false,
      code: "max_team_seats",
      error: `Your ${org.plan} plan allows ${limits.maxTeamSeats} team seat${limits.maxTeamSeats === 1 ? "" : "s"}. ${upgradeHint(org.plan)}`
    };
  }
  return { ok: true };
}

export async function assertCanCreateBroadcastCampaign(
  org: Pick<Organization, "id" | "plan">
): Promise<PlanLimitCheck> {
  const limits = getPlanLimits(org.plan);
  if (limits.maxBroadcastCampaignsPerMonth == null) return { ok: true };
  if (limits.maxBroadcastCampaignsPerMonth <= 0) {
    return {
      ok: false,
      code: "broadcast_not_on_plan",
      error: `Email broadcasts are not included on the ${org.plan} plan. ${upgradeHint(org.plan)}`
    };
  }

  const used = await countBroadcastCampaignsThisMonth(org.id);
  if (used >= limits.maxBroadcastCampaignsPerMonth) {
    return {
      ok: false,
      code: "max_broadcast_campaigns",
      error: `Your ${org.plan} plan allows ${limits.maxBroadcastCampaignsPerMonth} broadcast campaigns per month (${used} used). ${upgradeHint(org.plan)}`
    };
  }
  return { ok: true };
}

export async function assertCanSendBroadcastRecipients(
  org: Pick<Organization, "id" | "plan">,
  recipientCount: number
): Promise<PlanLimitCheck> {
  if (recipientCount <= 0) return { ok: true };
  const limits = getPlanLimits(org.plan);
  if (limits.maxBroadcastRecipientsPerMonth == null) return { ok: true };
  if (limits.maxBroadcastRecipientsPerMonth <= 0) {
    return {
      ok: false,
      code: "broadcast_not_on_plan",
      error: `Email broadcasts are not included on the ${org.plan} plan. ${upgradeHint(org.plan)}`
    };
  }

  const used = await countBroadcastRecipientsThisMonth(org.id);
  if (used + recipientCount > limits.maxBroadcastRecipientsPerMonth) {
    const remaining = Math.max(0, limits.maxBroadcastRecipientsPerMonth - used);
    return {
      ok: false,
      code: "max_broadcast_recipients",
      error: `Your ${org.plan} plan allows ${limits.maxBroadcastRecipientsPerMonth} broadcast recipients per month (${used} used, ${remaining} left; this send needs ${recipientCount}). ${upgradeHint(org.plan)}`
    };
  }
  return { ok: true };
}

export function assertRegistrationFieldCount(
  org: Pick<Organization, "plan">,
  fieldCount: number
): PlanLimitCheck {
  const limits = getPlanLimits(org.plan);
  if (limits.maxRegistrationFields == null) return { ok: true };
  if (fieldCount > limits.maxRegistrationFields) {
    return {
      ok: false,
      code: "max_registration_fields",
      error: `Your ${org.plan} plan allows ${limits.maxRegistrationFields} custom registration fields (this form has ${fieldCount}). ${upgradeHint(org.plan)}`
    };
  }
  return { ok: true };
}
