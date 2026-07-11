/** ISO 3166-1 alpha-2 codes for registration (Bizzabo-style attendee profile). */
export const REGISTRATION_COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Country / region" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "IE", label: "Ireland" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "NL", label: "Netherlands" },
  { value: "BE", label: "Belgium" },
  { value: "ES", label: "Spain" },
  { value: "IT", label: "Italy" },
  { value: "CH", label: "Switzerland" },
  { value: "AT", label: "Austria" },
  { value: "SE", label: "Sweden" },
  { value: "NO", label: "Norway" },
  { value: "DK", label: "Denmark" },
  { value: "FI", label: "Finland" },
  { value: "PL", label: "Poland" },
  { value: "CZ", label: "Czechia" },
  { value: "PT", label: "Portugal" },
  { value: "GR", label: "Greece" },
  { value: "IL", label: "Israel" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "ZA", label: "South Africa" },
  { value: "NG", label: "Nigeria" },
  { value: "GH", label: "Ghana" },
  { value: "KE", label: "Kenya" },
  { value: "IN", label: "India" },
  { value: "SG", label: "Singapore" },
  { value: "MY", label: "Malaysia" },
  { value: "ID", label: "Indonesia" },
  { value: "PH", label: "Philippines" },
  { value: "JP", label: "Japan" },
  { value: "KR", label: "South Korea" },
  { value: "CN", label: "China" },
  { value: "HK", label: "Hong Kong SAR" },
  { value: "TW", label: "Taiwan" },
  { value: "AU", label: "Australia" },
  { value: "NZ", label: "New Zealand" },
  { value: "BR", label: "Brazil" },
  { value: "MX", label: "Mexico" },
  { value: "AR", label: "Argentina" },
  { value: "CL", label: "Chile" },
  { value: "CO", label: "Colombia" },
  { value: "OTHER", label: "Other / not listed" }
];

export function registrationCountryLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return REGISTRATION_COUNTRY_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

export const REFERRAL_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "How did you hear about this event? (optional)" },
  { value: "email_invite", label: "Email invitation" },
  { value: "colleague", label: "Colleague or manager" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "company_website", label: "Company website" },
  { value: "search", label: "Search engine" },
  { value: "event_calendar", label: "Events calendar or listing" },
  { value: "partner", label: "Partner or sponsor" },
  { value: "other", label: "Other" }
];

export function referralSourceLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return REFERRAL_SOURCE_OPTIONS.find((o) => o.value === code)?.label ?? code;
}
