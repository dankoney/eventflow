import { EmailMarketingConsentSource } from "@prisma/client";

import {
  formatMarketingConsentLabel,
  shouldShowMarketingOptIn,
  type MarketingOptInEventContext,
  type MarketingOptInOrgContext
} from "@/lib/email/marketingOptIn";
import { guestHasDeliverableEmail } from "@/lib/guest/contactRequirements";
import { findAttendedGuestForFeedback } from "@/lib/event-feedback/portalGuestLookup";
import { prisma } from "@/lib/prisma";

export type FeedbackMarketingOptInContext = {
  show: boolean;
  label: string;
  privacyPolicyUrl: string | null;
};

export async function getFeedbackMarketingOptInForGuest(
  guestId: string
): Promise<FeedbackMarketingOptInContext | null> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      email: true,
      event: {
        select: {
          blueprintTemplate: true,
          org: {
            select: {
              name: true,
              marketingEmailEnabled: true,
              marketingConsentCopy: true,
              marketingPrivacyPolicyUrl: true
            }
          }
        }
      },
      emailContact: { select: { isSubscribed: true } }
    }
  });

  if (!guest || !guestHasDeliverableEmail(guest.email)) return null;

  const event: MarketingOptInEventContext = { blueprintTemplate: guest.event.blueprintTemplate };
  const org: MarketingOptInOrgContext = guest.event.org;

  if (!shouldShowMarketingOptIn(event, org)) return null;
  if (guest.emailContact?.isSubscribed) return null;

  return {
    show: true,
    label: formatMarketingConsentLabel(org),
    privacyPolicyUrl: org.marketingPrivacyPolicyUrl
  };
}

export async function getFeedbackMarketingOptInForEvent(
  eventId: string
): Promise<Pick<FeedbackMarketingOptInContext, "show" | "label" | "privacyPolicyUrl"> | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      blueprintTemplate: true,
      org: {
        select: {
          name: true,
          marketingEmailEnabled: true,
          marketingConsentCopy: true,
          marketingPrivacyPolicyUrl: true
        }
      }
    }
  });

  if (!event) return null;

  if (!shouldShowMarketingOptIn(event, event.org)) return null;

  return {
    show: true,
    label: formatMarketingConsentLabel(event.org),
    privacyPolicyUrl: event.org.marketingPrivacyPolicyUrl
  };
}

export async function recordFeedbackMarketingOptInIfEligible(input: {
  guestId: string;
  marketingOptIn: boolean;
}): Promise<void> {
  if (!input.marketingOptIn) return;

  const ctx = await getFeedbackMarketingOptInForGuest(input.guestId);
  if (!ctx?.show) return;

  const { recordGuestMarketingConsent } = await import("@/lib/db/emailContact");
  await recordGuestMarketingConsent({
    guestId: input.guestId,
    marketingOptIn: true,
    consentSource: EmailMarketingConsentSource.FEEDBACK
  });
}

export async function recordPortalFeedbackMarketingOptIn(input: {
  eventId: string;
  marketingEmail: string;
}): Promise<void> {
  const email = input.marketingEmail.trim().toLowerCase();
  if (!email) return;

  const guest = await findAttendedGuestForFeedback(input.eventId, {
    ok: true,
    kind: "email",
    value: email
  });
  if (!guest) return;

  await recordFeedbackMarketingOptInIfEligible({
    guestId: guest.id,
    marketingOptIn: true
  });
}
