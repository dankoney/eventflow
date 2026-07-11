"use client";

import { ArrowRight, Building2, Menu, X } from "lucide-react";

import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import type { PublicEventPageModel } from "../templates/usePublicEventPageModel";
import type { PublicEventSiteSummary } from "../siteSummary";
import { PublicEventLanguageSwitcher } from "../i18n/PublicEventLanguageSwitcher";
import { usePublicEventTranslation } from "../i18n/PublicEventTranslationProvider";

type PublicEventNavProps = {
  summary: PublicEventSiteSummary;
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
  model: PublicEventPageModel;
  registrationOpen: boolean;
  eventOver: boolean;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
};

export function PublicEventNav({
  summary,
  theme,
  variant,
  model,
  registrationOpen,
  eventOver,
  mobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu
}: PublicEventNavProps) {
  const { t } = usePublicEventTranslation();
  const isNight = variant === "night-edition";
  const navId = isNight ? "public-mobile-nav-night" : "public-mobile-nav-light";

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 z-50 w-full",
          isNight && "md:top-6 md:left-1/2 md:w-auto md:max-w-[92%] md:-translate-x-1/2",
          isNight && "pe-glass-panel md:rounded-full md:px-6 md:py-2.5 md:shadow-2xl",
          theme.nav
        )}
      >
        <div className={cn("mx-auto flex h-16 items-center justify-between gap-4 px-6 sm:px-8", !isNight && "max-w-7xl")}>
          <a
            href={`#${PUBLIC_EVENT_SECTION_IDS.registerHero}`}
            className="flex min-w-0 max-w-[min(11rem,38vw)] shrink-0 items-center gap-2 text-lg font-bold tracking-tight sm:max-w-[min(14rem,42vw)] sm:text-xl md:max-w-none"
            onClick={onCloseMobileMenu}
          >
            {summary.headerLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={summary.headerLogo} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />
            ) : (
              <Building2 className="h-6 w-6 shrink-0 text-[color:var(--pe-accent)]" aria-hidden />
            )}
            <span className={cn("truncate", isNight ? "text-[var(--pe-on-surface)]" : "text-zinc-900")}>
              {summary.orgName}
            </span>
          </a>

          <div role="navigation" aria-label="Page sections" className="hidden min-w-0 flex-1 items-center justify-center gap-6 md:flex md:gap-8">
            {model.navLinks.map((link, i) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={cn(theme.navLink, "shrink-0 whitespace-nowrap", i === 0 && isNight && theme.navLinkActive)}
              >
                {link.id === PUBLIC_EVENT_SECTION_IDS.election && model.electionLive ? (
                  <span className="relative mr-2 inline-flex h-2 w-2 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--pe-accent)] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--pe-accent)]" />
                  </span>
                ) : null}
                {link.label}
                {link.id === PUBLIC_EVENT_SECTION_IDS.election && model.electionLive ? (
                  <span className="ml-1 rounded-full bg-[color:var(--pe-accent)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[color:var(--pe-accent)]">
                    Live
                  </span>
                ) : null}
              </a>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <PublicEventLanguageSwitcher compact className="hidden md:block" />
            <button
              type="button"
              aria-controls={navId}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={onToggleMobileMenu}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-lg md:hidden",
                isNight
                  ? "border border-white/15 bg-white/5 text-zinc-100"
                  : "border border-zinc-200 bg-white text-zinc-900"
              )}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {registrationOpen ? (
              <a href={`#${PUBLIC_EVENT_SECTION_IDS.registerHero}`} onClick={onCloseMobileMenu} className={theme.navCta}>
                {t("action.register")}
              </a>
            ) : (
              <span
                aria-disabled
                title={eventOver ? t("action.ended") : t("action.closed")}
                className="pointer-events-none shrink-0 cursor-not-allowed select-none rounded-lg bg-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-500"
              >
                {eventOver ? t("action.ended") : t("action.closed")}
              </span>
            )}
          </div>
        </div>

        {mobileMenuOpen ? (
          <div id={navId} className={cn("border-t md:hidden", isNight ? "border-white/10 bg-zinc-950/95" : "border-outline-variant/30 bg-surface/95")}>
            <div className="mx-auto flex max-w-7xl justify-end px-6 pt-3 sm:px-8">
              <PublicEventLanguageSwitcher compact />
            </div>
            <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-3 sm:px-8">
              {model.navLinks.map((link) => (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    onClick={onCloseMobileMenu}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-semibold text-zinc-800 hover:bg-surface-container-low dark:text-zinc-200 dark:hover:bg-white/5"
                  >
                    {link.label}
                    <ArrowRight className="h-4 w-4 text-zinc-400" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </nav>
      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onCloseMobileMenu}
          className="fixed inset-x-0 bottom-0 top-16 z-40 cursor-default bg-black/30 md:hidden"
        />
      ) : null}
    </>
  );
}
