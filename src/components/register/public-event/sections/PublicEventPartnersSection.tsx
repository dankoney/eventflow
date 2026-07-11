"use client";

import { Building2 } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { SectionHeader } from "./shared/SectionHeader";
import { SectionShell } from "./shared/SectionShell";

type PublicEventPartnersSectionProps = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
  technexusSectionBandClass?: string;
};

/** Partner logos — `#partners` */
export function PublicEventPartnersSection({
  experience,
  theme,
  variant,
  technexusSectionBandClass
}: PublicEventPartnersSectionProps) {
  const isTechnexus = variant === "technexus-dark" || variant === "technexus-light";
  const isNight = variant === "night-edition" || isTechnexus;
  const section = resolvePublicEventSectionHeader("partners", experience, {
    variant:
      variant === "technexus-dark" || variant === "technexus-light"
        ? "technexus"
        : isNight
          ? "night-edition"
          : "summit"
  });
  const partners = experience.partners;

  return (
    <SectionShell
      id={PUBLIC_EVENT_SECTION_IDS.partners}
      theme={theme}
      variant="default"
      className={cn(isTechnexus && (technexusSectionBandClass ?? "tn-section-band-alt"))}
    >
      <SectionHeader
        theme={theme}
        variant={variant}
        badge={section.badge}
        title={section.title}
        description={section.description}
        gradientTitle={false}
      />

      <div className="flex flex-wrap items-center justify-center gap-10 md:gap-14">
        {partners.map((partner) => {
          const logo = partner.logoUrl?.trim();
          const inner = logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={partner.name}
              title={partner.name}
              className="max-h-16 max-w-[180px] object-contain opacity-80 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 md:max-h-20 md:max-w-[220px]"
            />
          ) : (
            <span
              className="flex h-16 w-16 items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-low md:h-20 md:w-20"
              title={partner.name}
            >
              <Building2 className="h-8 w-8 text-[var(--pe-on-surface-variant)]" aria-hidden />
            </span>
          );

          const wrapClass = cn(
            "flex items-center justify-center p-4 transition",
            isNight && "rounded-2xl border border-white/5 hover:border-[color:var(--pe-accent)]/20"
          );

          return partner.href?.trim() ? (
            <a key={partner.id} href={partner.href} className={wrapClass} target="_blank" rel="noopener noreferrer">
              {inner}
            </a>
          ) : (
            <div key={partner.id} className={wrapClass}>
              {inner}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
