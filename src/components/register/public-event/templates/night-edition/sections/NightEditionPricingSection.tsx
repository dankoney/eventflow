"use client";

import { Check, Sparkles } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { SectionHeader } from "../../../sections/shared/SectionHeader";
import { SectionShell } from "../../../sections/shared/SectionShell";

type Props = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  onOpenRegister: () => void;
};

/** `#pricing` — CMS: `experience.pricingTiers[]` */
export function NightEditionPricingSection({ experience, theme, onOpenRegister }: Props) {
  const section = resolvePublicEventSectionHeader("pricing", experience, { variant: "night-edition" });
  const highlightedIndex = experience.pricingTiers.findIndex((t) => t.highlighted);
  const featuredIndex = highlightedIndex >= 0 ? highlightedIndex : Math.floor(experience.pricingTiers.length / 2);

  return (
    <SectionShell id={PUBLIC_EVENT_SECTION_IDS.pricing} theme={theme} className="pe-section-pricing">
      <SectionHeader
        theme={theme}
        variant="night-edition"
        badge={section.badge}
        title={section.title}
        description={section.description}
        gradientTitle
      />

      <div className="pe-pricing-grid">
        {experience.pricingTiers.map((tier, index) => {
          const featured = index === featuredIndex;
          return (
            <article
              key={tier.id}
              className={cn(
                "pe-pricing-card flex flex-col",
                featured && "pe-pricing-card--featured"
              )}
            >
              {featured ? (
                <span className="pe-pricing-card-badge">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Most popular
                </span>
              ) : null}
              <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--pe-primary)]">{tier.name}</p>
              <p className="mt-3 text-4xl font-extrabold tracking-tight text-[var(--pe-on-surface)]">{tier.priceLabel}</p>
              {tier.description ? (
                <p className="mt-2 text-sm leading-relaxed text-[var(--pe-on-surface-variant)]">{tier.description}</p>
              ) : null}
              <ul className="mt-8 flex-grow space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-[var(--pe-on-surface-variant)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--pe-primary)]" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              {tier.ctaHref ? (
                <a
                  href={tier.ctaHref}
                  className={cn("pe-pricing-cta mt-10", featured && "pe-pricing-cta--primary")}
                >
                  {tier.ctaLabel}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className={cn("pe-pricing-cta mt-10", featured && "pe-pricing-cta--primary")}
                >
                  {tier.ctaLabel}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}
