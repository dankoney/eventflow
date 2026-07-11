/** BCP-47 language codes supported on public event pages. */
export const PUBLIC_EVENT_DEFAULT_LOCALE = "en" as const;

export type PublicEventLocale =
  | "en"
  | "fr"
  | "de"
  | "es"
  | "pt"
  | "it"
  | "nl"
  | "ar"
  | "zh"
  | "ja"
  | "ko"
  | "ru"
  | "pl"
  | "tr"
  | "hi"
  | "id"
  | "sv"
  | "da"
  | "no"
  | "fi"
  | "cs"
  | "ro"
  | "hu"
  | "el"
  | "he"
  | "uk"
  | "vi"
  | "th"
  | "ms";

export const PUBLIC_EVENT_LOCALES: Array<{
  code: PublicEventLocale;
  label: string;
  nativeLabel: string;
}> = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
  { code: "it", label: "Italian", nativeLabel: "Italiano" },
  { code: "nl", label: "Dutch", nativeLabel: "Nederlands" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "zh", label: "Chinese", nativeLabel: "中文" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" },
  { code: "ko", label: "Korean", nativeLabel: "한국어" },
  { code: "ru", label: "Russian", nativeLabel: "Русский" },
  { code: "pl", label: "Polish", nativeLabel: "Polski" },
  { code: "tr", label: "Turkish", nativeLabel: "Türkçe" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { code: "sv", label: "Swedish", nativeLabel: "Svenska" },
  { code: "da", label: "Danish", nativeLabel: "Dansk" },
  { code: "no", label: "Norwegian", nativeLabel: "Norsk" },
  { code: "fi", label: "Finnish", nativeLabel: "Suomi" },
  { code: "cs", label: "Czech", nativeLabel: "Čeština" },
  { code: "ro", label: "Romanian", nativeLabel: "Română" },
  { code: "hu", label: "Hungarian", nativeLabel: "Magyar" },
  { code: "el", label: "Greek", nativeLabel: "Ελληνικά" },
  { code: "he", label: "Hebrew", nativeLabel: "עברית" },
  { code: "uk", label: "Ukrainian", nativeLabel: "Українська" },
  { code: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt" },
  { code: "th", label: "Thai", nativeLabel: "ไทย" },
  { code: "ms", label: "Malay", nativeLabel: "Bahasa Melayu" }
];

const LOCALE_SET = new Set<string>(PUBLIC_EVENT_LOCALES.map((l) => l.code));

export function normalizePublicEventLocale(raw: string | null | undefined): PublicEventLocale {
  if (!raw?.trim()) return PUBLIC_EVENT_DEFAULT_LOCALE;
  const base = raw.trim().toLowerCase().split("-")[0];
  if (LOCALE_SET.has(base)) return base as PublicEventLocale;
  return PUBLIC_EVENT_DEFAULT_LOCALE;
}

export function publicEventLocaleLabel(code: PublicEventLocale): string {
  return PUBLIC_EVENT_LOCALES.find((l) => l.code === code)?.nativeLabel ?? code;
}

export function isRtlLocale(locale: PublicEventLocale): boolean {
  return locale === "ar" || locale === "he";
}
