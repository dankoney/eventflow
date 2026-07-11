import type { PublicEventLocale } from "./locales";

/** Primary language for attending countries (ISO 3166-1 alpha-2 → BCP-47). */
const COUNTRY_PRIMARY_LOCALE: Record<string, PublicEventLocale> = {
  US: "en",
  GB: "en",
  IE: "en",
  AU: "en",
  NZ: "en",
  CA: "en",
  IN: "hi",
  SG: "en",
  ZA: "en",
  NG: "en",
  GH: "en",
  KE: "en",
  FR: "fr",
  BE: "fr",
  CH: "de",
  DE: "de",
  AT: "de",
  ES: "es",
  MX: "es",
  AR: "es",
  CL: "es",
  CO: "es",
  PT: "pt",
  BR: "pt",
  IT: "it",
  NL: "nl",
  SE: "sv",
  NO: "no",
  DK: "da",
  FI: "fi",
  PL: "pl",
  CZ: "cs",
  RO: "ro",
  HU: "hu",
  GR: "el",
  IL: "he",
  AE: "ar",
  SA: "ar",
  EG: "ar",
  MA: "ar",
  JP: "ja",
  KR: "ko",
  CN: "zh",
  TW: "zh",
  HK: "zh",
  RU: "ru",
  UA: "uk",
  TR: "tr",
  ID: "id",
  MY: "ms",
  PH: "en",
  TH: "th",
  VN: "vi"
};

export function localesFromCountryCodes(codes: string[]): PublicEventLocale[] {
  const seen = new Set<PublicEventLocale>();
  for (const code of codes) {
    const locale = COUNTRY_PRIMARY_LOCALE[code.toUpperCase()];
    if (locale) seen.add(locale);
  }
  return [...seen];
}

export function localeFromCountryCode(code: string | null | undefined): PublicEventLocale | null {
  if (!code?.trim()) return null;
  return COUNTRY_PRIMARY_LOCALE[code.trim().toUpperCase()] ?? null;
}
