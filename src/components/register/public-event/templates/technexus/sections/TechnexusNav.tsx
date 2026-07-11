"use client";

import { Building2, Menu, X } from "lucide-react";

import { PUBLIC_EVENT_SECTION_IDS, type PublicEventSectionId } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import type { PublicEventPageModel } from "../../../templates/usePublicEventPageModel";
import type { PublicEventSiteSummary } from "../../../siteSummary";
import { PublicEventLanguageSwitcher } from "../../../i18n/PublicEventLanguageSwitcher";
import { usePublicEventTranslation } from "../../../i18n/PublicEventTranslationProvider";
import type { UiStringKey } from "@/lib/public-event/i18n/uiStrings";

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

const TN_NAV: Array<{ id: PublicEventSectionId; labelKey: UiStringKey; visible: (m: PublicEventPageModel) => boolean }> = [
  { id: PUBLIC_EVENT_SECTION_IDS.overview, labelKey: "nav.about", visible: (m) => m.showOverview },
  { id: PUBLIC_EVENT_SECTION_IDS.speakers, labelKey: "nav.speakers", visible: (m) => m.hasSpeakers },
  { id: PUBLIC_EVENT_SECTION_IDS.program, labelKey: "nav.program", visible: (m) => m.hasProgram },
  { id: PUBLIC_EVENT_SECTION_IDS.gallery, labelKey: "nav.gallery", visible: (m) => m.showGallery },
  { id: PUBLIC_EVENT_SECTION_IDS.venueOps, labelKey: "nav.venue", visible: (m) => m.showVenueOps },
  { id: PUBLIC_EVENT_SECTION_IDS.faq, labelKey: "nav.faq", visible: (m) => m.showFaq },
  { id: PUBLIC_EVENT_SECTION_IDS.contact, labelKey: "nav.contact", visible: (m) => m.showContactSection }
];

export function TechnexusNav({
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
  const links = TN_NAV.filter((l) => l.visible(model));

  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[var(--pe-nav-bg)] backdrop-blur-xl shadow-md">
        <div className="tn-section-inner flex items-center justify-between py-4">
          <a href="#top" className="flex items-center gap-2" onClick={onCloseMobileMenu}>
            {summary.headerLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={summary.headerLogo}
                alt={summary.orgName}
                className="h-14 w-auto max-w-[200px] object-contain md:h-16"
              />
            ) : (
              <Building2 className="h-8 w-8 text-[var(--pe-primary)]" aria-hidden />
            )}
          </a>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className="rounded-md px-3 py-2 text-base text-[var(--pe-on-surface)] transition-colors hover:bg-[var(--pe-primary)]/10 hover:text-[var(--pe-primary)]"
              >
                {t(link.labelKey)}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <PublicEventLanguageSwitcher compact className="hidden sm:block" />
            <button
              type="button"
              className="tn-nav-menu-btn rounded-md p-2 md:hidden"
              aria-expanded={mobileMenuOpen}
              onClick={onToggleMobileMenu}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            {registrationOpen ? (
              <button type="button" onClick={onOpenRegister} className={cn("tn-btn-cta hidden sm:inline-flex")}>
                {t("action.registerNow")}
              </button>
            ) : (
              <span className="hidden rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-zinc-500 sm:inline">
                {eventOver ? t("action.ended") : t("action.closed")}
              </span>
            )}
          </div>
        </div>
      </nav>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 top-[72px] z-40 bg-black/70 md:hidden" onClick={onCloseMobileMenu} aria-hidden />
      ) : null}
      {mobileMenuOpen ? (
        <div className="fixed left-0 right-0 top-[72px] z-50 border-b border-white/10 bg-[var(--pe-surface-container)] p-4 md:hidden">
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  onClick={onCloseMobileMenu}
                  className="block rounded-lg px-3 py-3 font-medium text-[var(--pe-on-surface)] hover:bg-white/5"
                >
                  {t(link.labelKey)}
                </a>
              </li>
            ))}
          </ul>
          {registrationOpen ? (
            <button type="button" onClick={onOpenRegister} className="tn-btn-cta mt-4 w-full">
              {t("action.registerNow")}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
