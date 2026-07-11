import { formatDate } from "@/lib/utils";
import {
  orgBrandingToMergeValues,
  resolveOrgEmailBranding,
  type OrgEmailBranding
} from "@/lib/email/orgBranding";
import {
  getEventRegistrationAbsoluteUrl,
  getJoinPageAbsoluteUrl,
  getOrgCommandCenterUrl,
  getRsvpAcceptAbsoluteUrl
} from "@/lib/url";

export type BroadcastMergeGuestContext = {
  id: string;
  name: string;
  email: string | null;
  tier: string;
  company: string | null;
  invitationToken: string | null;
  contactCompany?: string | null;
};

export type BroadcastMergeEventContext = {
  id: string;
  name: string;
  date: Date;
};

export type BroadcastMergeOrgContext = {
  name: string;
  slug: string;
  logoUrl: string | null;
  logo: string | null;
  defaultEventBrandLogoUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  defaultEventBrandPrimaryColor: string | null;
};

function firstName(fullName: string): string {
  const token = fullName.trim().split(/\s+/)[0];
  return token || "there";
}

/**
 * Guest-facing event link for broadcast CTAs.
 * Prefers personalized RSVP when available, then registration, join hub, org lobby.
 */
export function resolveBroadcastEventUrl(params: {
  eventId: string;
  guestId?: string | null;
  invitationToken?: string | null;
  orgSlug?: string | null;
}): string {
  if (params.guestId && params.invitationToken) {
    const rsvpUrl = getRsvpAcceptAbsoluteUrl(params.guestId, params.invitationToken);
    if (rsvpUrl) return rsvpUrl;
  }

  const registrationUrl = getEventRegistrationAbsoluteUrl(params.eventId);
  if (registrationUrl) return registrationUrl;

  if (params.guestId) {
    const joinUrl = getJoinPageAbsoluteUrl(params.guestId);
    if (joinUrl) return joinUrl;
  }

  if (params.orgSlug) {
    const orgUrl = getOrgCommandCenterUrl(params.orgSlug);
    if (orgUrl) return orgUrl;
  }

  return "#";
}

export function resolveBroadcastMergeValues(params: {
  guest: BroadcastMergeGuestContext;
  event: BroadcastMergeEventContext;
  org: BroadcastMergeOrgContext;
}): Record<string, string> {
  const branding: OrgEmailBranding = resolveOrgEmailBranding(params.org);

  return {
    first_name: firstName(params.guest.name),
    guest_name: params.guest.name,
    guest_email: params.guest.email?.trim() ?? "",
    event_name: params.event.name,
    event_date: formatDate(params.event.date),
    guest_category: params.guest.tier,
    company: params.guest.company?.trim() || params.guest.contactCompany?.trim() || "",
    event_url: resolveBroadcastEventUrl({
      eventId: params.event.id,
      guestId: params.guest.id,
      invitationToken: params.guest.invitationToken,
      orgSlug: params.org.slug
    }),
    ...orgBrandingToMergeValues(branding, params.org.name)
  };
}
