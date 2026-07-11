"use client";

import { Building2, Menu, X } from "lucide-react";

import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import { PublicEventLanguageSwitcher } from "../../../i18n/PublicEventLanguageSwitcher";
import { usePublicEventTranslation } from "../../../i18n/PublicEventTranslationProvider";
import type { PublicEventPageModel } from "../../../templates/usePublicEventPageModel";
import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  model: PublicEventPageModel;
  registrationOpen: boolean;
  eventOver: boolean;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
  onOpenRegister: () => void;
};

export function NightEditionNav({
  summary,
  model,
  registrationOpen,
  eventOver,
  mobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
  onOpenRegister
}: Props) {
  const { t } = usePublicEventTranslation();

  return (
    <>
      <nav className="fixed left-1/2 top-6 z-50 flex w-[92%] max-w-4xl -translate-x-1/2 items-center justify-between rounded-full px-6 py-2.5 pe-glass-panel shadow-2xl transition-all duration-300 md:w-auto md:min-w-[700px]">
        <a
          href={`#${PUBLIC_EVENT_SECTION_IDS.spotlight}`}
          className="flex min-w-0 items-center gap-3"
          onClick={onCloseMobileMenu}
        >
          {summary.headerLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={summary.headerLogo} alt="" className="h-8 w-8 rounded object-contain" />
          ) : (
            <Building2 className="h-6 w-6 text-[color:var(--pe-primary)]" aria-hidden />
          )}
          <span className="whitespace-nowrap text-sm font-bold tracking-tight text-[var(--pe-on-surface)]">
            {summary.orgName}
          </span>
        </a>

        <div className="mx-10 hidden items-center gap-8 md:flex">
          {model.navLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="text-xs font-medium text-[var(--pe-on-surface-variant)] transition-colors duration-300 hover:text-[color:var(--pe-primary)]"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <PublicEventLanguageSwitcher compact className="hidden sm:block" />
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            onClick={onToggleMobileMenu}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--pe-on-surface)] md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          {registrationOpen ? (
            <button
              type="button"
              onClick={onOpenRegister}
              className="whitespace-nowrap rounded-full bg-[linear-gradient(135deg,var(--pe-gradient-from),var(--pe-gradient-to))] px-5 py-2 text-xs font-bold text-[var(--pe-background)] transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,170,249,0.3)] active:scale-95"
            >
              {t("action.register")}
            </button>
          ) : (
            <span className="rounded-full bg-white/10 px-5 py-2 text-xs font-bold text-zinc-500">
              {eventOver ? t("action.ended") : t("action.closed")}
            </span>
          )}
        </div>
      </nav>

      {mobileMenuOpen ? (
        <>
          <div className="fixed inset-0 top-20 z-40 bg-black/60 md:hidden" onClick={onCloseMobileMenu} aria-hidden />
          <div className="fixed left-1/2 top-24 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-2xl pe-glass-panel p-4 md:hidden">
            <div className="mb-3 flex justify-end">
              <PublicEventLanguageSwitcher compact />
            </div>
            <ul className="flex flex-col gap-1">
              {model.navLinks.map((link) => (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    onClick={onCloseMobileMenu}
                    className="block rounded-lg px-4 py-3 text-sm font-medium text-[var(--pe-on-surface)] hover:bg-white/5"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
}
