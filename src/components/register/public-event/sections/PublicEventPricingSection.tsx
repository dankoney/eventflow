"use client";

import { Check } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { SectionHeader } from "./shared/SectionHeader";
import { SectionShell } from "./shared/SectionShell";

type PublicEventPricingSectionProps = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
  registerHref?: string;
  technexusSectionBandClass?: string;
};

/**
 * Registration / pricing tiers — `#pricing`
 * CMS: `experience.pricingTiers[]` — name, priceLabel, description, features[], highlighted, ctaLabel, ctaHref
 */
export function PublicEventPricingSection({
  experience,
  theme,
  variant,
  registerHref = `#${PUBLIC_EVENT_SECTION_IDS.registerHero}`,
  technexusSectionBandClass
}: PublicEventPricingSectionProps) {
  const isTechnexus = variant === "technexus-dark" || variant === "technexus-light";
  const isNight = variant === "night-edition" || isTechnexus;
  const section = resolvePublicEventSectionHeader("pricing", experience, {
    variant:
      variant === "technexus-dark" || variant === "technexus-light"
        ? "technexus"
        : isNight
          ? "night-edition"
          : "summit"
  });
  const tiers = experience.pricingTiers;

  return (
    <SectionShell
      id={PUBLIC_EVENT_SECTION_IDS.pricing}
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
        gradientTitle={isNight}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => (
          <article
            key={tier.id}
            className={cn(
              "flex flex-col rounded-2xl border p-8 transition-all",
              tier.highlighted
                ? isNight
                  ? "pe-premium-glow pe-glass-panel border-[color:var(--pe-accent)]/50"
                  : "border-accent shadow-lg ring-2 ring-accent/20"
                : isNight
                  ? "border-white/10 bg-zinc-900/60"
                  : "border-outline-variant/30 bg-white"
            )}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--pe-accent)]">{tier.name}</p>
            <p className="mt-2 text-3xl font-extrabold text-[var(--pe-on-surface)]">{tier.priceLabel}</p>
            {tier.description ? <p className={cn("mt-3", theme.muted)}>{tier.description}</p> : null}
            <ul className="mt-6 flex-grow space-y-3">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-[var(--pe-on-surface-variant)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--pe-accent)]" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            <a
              href={tier.ctaHref ?? registerHref}
              className={cn("mt-8 block text-center", tier.highlighted ? theme.btnPrimary : theme.btnSecondary)}
            >
              {tier.ctaLabel}
            </a>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}
