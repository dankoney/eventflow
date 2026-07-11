"use client";

import { Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  PUBLIC_EVENT_DEFAULT_LOCALE,
  PUBLIC_EVENT_LOCALES,
  publicEventLocaleLabel,
  type PublicEventLocale
} from "@/lib/public-event/i18n/locales";
import { cn } from "@/lib/utils";

import { usePublicEventTranslation } from "./PublicEventTranslationProvider";

type Props = {
  className?: string;
  compact?: boolean;
};

export function PublicEventLanguageSwitcher({ className, compact = false }: Props) {
  const { locale, setLocale, t, isTranslating, suggestedLocales } = usePublicEventTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const orderedLocales = [
    ...suggestedLocales.filter((l) => l !== PUBLIC_EVENT_DEFAULT_LOCALE),
    PUBLIC_EVENT_DEFAULT_LOCALE,
    ...PUBLIC_EVENT_LOCALES.map((l) => l.code).filter(
      (code) => !suggestedLocales.includes(code) && code !== PUBLIC_EVENT_DEFAULT_LOCALE
    )
  ];

  const uniqueLocales = [...new Set(orderedLocales)];

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("language.select")}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--pe-primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--pe-surface)_80%,transparent)] text-[var(--pe-on-surface)] transition hover:border-[color-mix(in_srgb,var(--pe-primary)_55%,transparent)]",
          compact ? "px-2.5 py-1.5 text-[10px] font-semibold" : "px-3 py-2 text-xs font-bold"
        )}
      >
        <Globe className={cn("shrink-0 text-[color:var(--pe-primary)]", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <span className="max-w-[5rem] truncate">{publicEventLocaleLabel(locale)}</span>
        {isTranslating ? <span className="opacity-60">…</span> : null}
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t("language.label")}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] max-h-72 w-52 overflow-y-auto rounded-2xl border border-[color-mix(in_srgb,var(--pe-outline)_40%,transparent)] bg-[var(--pe-surface)] p-1 shadow-2xl"
        >
          {uniqueLocales.map((code) => {
            const active = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setLocale(code as PublicEventLocale);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                  active
                    ? "bg-[color-mix(in_srgb,var(--pe-primary)_18%,transparent)] font-semibold text-[color:var(--pe-primary)]"
                    : "text-[var(--pe-on-surface)] hover:bg-[color-mix(in_srgb,var(--pe-on-surface)_6%,transparent)]"
                )}
              >
                <span>{publicEventLocaleLabel(code as PublicEventLocale)}</span>
                {suggestedLocales.includes(code as PublicEventLocale) && code !== PUBLIC_EVENT_DEFAULT_LOCALE ? (
                  <span className="text-[10px] uppercase tracking-wide text-[var(--pe-on-surface-variant)]">★</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
