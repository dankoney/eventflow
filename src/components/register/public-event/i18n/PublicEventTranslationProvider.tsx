"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import type { PublicEventSiteSummary } from "@/components/register/public-event/siteSummary";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import {
  applyPublicEventTranslations,
  extractPublicEventTranslatableStrings
} from "@/lib/public-event/i18n/contentTranslation";
import { localesFromCountryCodes } from "@/lib/public-event/i18n/countryToLocale";
import {
  isRtlLocale,
  normalizePublicEventLocale,
  PUBLIC_EVENT_DEFAULT_LOCALE,
  PUBLIC_EVENT_LOCALES,
  type PublicEventLocale
} from "@/lib/public-event/i18n/locales";
import { getUiString, type UiStringKey } from "@/lib/public-event/i18n/uiStrings";

type PublicEventTranslationContextValue = {
  locale: PublicEventLocale;
  setLocale: (locale: PublicEventLocale) => void;
  t: (key: UiStringKey) => string;
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  isTranslating: boolean;
  suggestedLocales: PublicEventLocale[];
  isRtl: boolean;
};

const PublicEventTranslationContext = createContext<PublicEventTranslationContextValue | null>(null);

function localeStorageKey(eventId: string) {
  return `eventflow-public-locale:${eventId}`;
}

function readInitialLocale(eventId: string): PublicEventLocale {
  if (typeof window === "undefined") return PUBLIC_EVENT_DEFAULT_LOCALE;

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("lang");
  if (fromUrl) return normalizePublicEventLocale(fromUrl);

  const stored = window.localStorage.getItem(localeStorageKey(eventId));
  if (stored) return normalizePublicEventLocale(stored);

  return PUBLIC_EVENT_DEFAULT_LOCALE;
}

type Props = {
  eventId: string;
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  children: ReactNode;
};

export function PublicEventTranslationProvider({ eventId, summary, experience, children }: Props) {
  const countryCodes = experience.overviewHighlights?.selectedCountryCodes ?? [];
  const suggestedLocales = useMemo(() => {
    const fromCountries = localesFromCountryCodes(countryCodes);
    const set = new Set<PublicEventLocale>([PUBLIC_EVENT_DEFAULT_LOCALE, ...fromCountries]);
    return PUBLIC_EVENT_LOCALES.map((l) => l.code).filter((code) => set.has(code));
  }, [countryCodes]);

  const [locale, setLocaleState] = useState<PublicEventLocale>(PUBLIC_EVENT_DEFAULT_LOCALE);
  const [initialized, setInitialized] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedSummary, setTranslatedSummary] = useState(summary);
  const [translatedExperience, setTranslatedExperience] = useState(experience);

  useEffect(() => {
    setTranslatedSummary(summary);
    setTranslatedExperience(experience);
  }, [summary, experience]);

  useEffect(() => {
    setLocaleState(readInitialLocale(eventId));
    setInitialized(true);
  }, [eventId]);

  const setLocale = useCallback(
    (next: PublicEventLocale) => {
      setLocaleState(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(localeStorageKey(eventId), next);
        document.documentElement.lang = next;
        document.documentElement.dir = isRtlLocale(next) ? "rtl" : "ltr";
      }
    },
    [eventId]
  );

  useEffect(() => {
    if (!initialized) return;

    document.documentElement.lang = locale;
    document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";

    if (locale === PUBLIC_EVENT_DEFAULT_LOCALE) {
      setTranslatedSummary(summary);
      setTranslatedExperience(experience);
      setIsTranslating(false);
      return;
    }

    const entries = extractPublicEventTranslatableStrings(summary, experience);
    if (entries.length === 0) {
      setTranslatedSummary(summary);
      setTranslatedExperience(experience);
      return;
    }

    let cancelled = false;
    setIsTranslating(true);

    fetch("/api/public-event/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries,
        targetLocale: locale,
        sourceLocale: PUBLIC_EVENT_DEFAULT_LOCALE
      })
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("translate failed");
        return res.json() as Promise<{ translations?: Record<string, string> }>;
      })
      .then((data) => {
        if (cancelled) return;
        const applied = applyPublicEventTranslations(summary, experience, data.translations ?? {});
        setTranslatedSummary(applied.summary);
        setTranslatedExperience(applied.experience);
      })
      .catch(() => {
        if (!cancelled) {
          setTranslatedSummary(summary);
          setTranslatedExperience(experience);
        }
      })
      .finally(() => {
        if (!cancelled) setIsTranslating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialized, locale, summary, experience]);

  const t = useCallback((key: UiStringKey) => getUiString(locale, key), [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      summary: translatedSummary,
      experience: translatedExperience,
      isTranslating,
      suggestedLocales,
      isRtl: isRtlLocale(locale)
    }),
    [locale, setLocale, t, translatedSummary, translatedExperience, isTranslating, suggestedLocales]
  );

  return (
    <PublicEventTranslationContext.Provider value={value}>{children}</PublicEventTranslationContext.Provider>
  );
}

export function usePublicEventTranslation(): PublicEventTranslationContextValue {
  const ctx = useContext(PublicEventTranslationContext);
  if (!ctx) {
    return {
      locale: PUBLIC_EVENT_DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key) => getUiString(PUBLIC_EVENT_DEFAULT_LOCALE, key),
      summary: {} as PublicEventSiteSummary,
      experience: {} as PublicEventExperiencePayload,
      isTranslating: false,
      suggestedLocales: [PUBLIC_EVENT_DEFAULT_LOCALE],
      isRtl: false
    };
  }
  return ctx;
}

export function usePublicEventTranslationOptional() {
  return useContext(PublicEventTranslationContext);
}
