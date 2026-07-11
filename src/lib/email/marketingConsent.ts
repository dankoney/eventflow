import type { Guest } from "@prisma/client";

/** Mirrors `EmailMarketingConsentSource` in `prisma/schema.prisma`. */
export type EmailMarketingConsentSource =
  | "PUBLIC_REGISTER"
  | "RSVP"
  | "PREFERENCE_CENTER"
  | "ADMIN_IMPORT"
  | "FEEDBACK";

/**
 * Result of resolving whether a guest has recorded marketing-email consent.
 */
export type MarketingConsentResolution = {
  hasExplicitOptIn: boolean;
  /**
   * When consent was captured. Null when no explicit opt-in exists.
   */
  consentRecordedAt: Date | null;
};

export type EnsureEmailContactConsentInput = {
  /**
   * Pass `true` only when the registration/RSVP/checkout UI collected an
   * explicit marketing opt-in for this guest.
   */
  marketingOptIn?: boolean;
  /** Defaults to `new Date()` when `marketingOptIn` is true. */
  consentRecordedAt?: Date;
  /** Touchpoint that recorded opt-in (RSVP, public register, etc.). */
  consentSource?: EmailMarketingConsentSource;
};

/**
 * Derives marketing consent from guest data and optional caller overrides.
 * Caller overrides win (used when a form just submitted an opt-in checkbox).
 */
export function resolveMarketingConsentForGuest(
  guest: Pick<Guest, "id" | "rsvpConfirmedAt" | "createdAt">,
  override?: EnsureEmailContactConsentInput
): MarketingConsentResolution {
  if (override?.marketingOptIn === true) {
    return {
      hasExplicitOptIn: true,
      consentRecordedAt: override.consentRecordedAt ?? new Date()
    };
  }

  if (override?.marketingOptIn === false) {
    return { hasExplicitOptIn: false, consentRecordedAt: null };
  }

  void guest;
  return { hasExplicitOptIn: false, consentRecordedAt: null };
}

export function consentValuesForEmailContact(
  resolution: MarketingConsentResolution
): { isSubscribed: boolean; consentRecordedAt: Date | null } {
  if (!resolution.hasExplicitOptIn || !resolution.consentRecordedAt) {
    return { isSubscribed: false, consentRecordedAt: null };
  }
  return {
    isSubscribed: true,
    consentRecordedAt: resolution.consentRecordedAt
  };
}
