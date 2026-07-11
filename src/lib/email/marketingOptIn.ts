import { EventBlueprintTemplate } from "@prisma/client";

/** Re-export for callers that only have blueprint on the event row. */
export type MarketingOptInEventContext = {
  blueprintTemplate: EventBlueprintTemplate;
};

export type MarketingOptInOrgContext = {
  name: string;
  marketingEmailEnabled: boolean;
  marketingConsentCopy: string | null;
  marketingPrivacyPolicyUrl: string | null;
};

const DEFAULT_CONSENT_TEMPLATE =
  "Email me about future events and updates from {orgName}.";

/**
 * Internal-staff / operational programs never collect marketing consent in the
 * attendee flow.
 */
export function shouldShowMarketingOptIn(
  event: MarketingOptInEventContext,
  org: MarketingOptInOrgContext
): boolean {
  if (!org.marketingEmailEnabled) return false;
  if (event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF) return false;
  return true;
}

export function formatMarketingConsentLabel(
  org: Pick<MarketingOptInOrgContext, "name" | "marketingConsentCopy">
): string {
  const custom = org.marketingConsentCopy?.trim();
  const template = custom && custom.length > 0 ? custom : DEFAULT_CONSENT_TEMPLATE;
  return template.replace(/\{orgName\}/g, org.name.trim() || "this organizer");
}
