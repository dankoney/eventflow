"use client";

import { Building2 } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";

type Props = {
  experience: PublicEventExperiencePayload;
};

/** `#partners` — CMS: experience.partners[] */
export function NightEditionPartnersSection({ experience }: Props) {
  return (
    <section
      id={PUBLIC_EVENT_SECTION_IDS.partners}
      className="scroll-mt-24 rounded-t-[2rem] bg-[var(--pe-surface-container-lowest)] px-5 py-24 md:px-16"
    >
      <div className="mx-auto max-w-[var(--pe-container-max,1280px)]">
        <div className="mb-16 text-center">
          <span className="mb-6 inline-block rounded-full border border-[color:var(--pe-primary)]/30 bg-[color:var(--pe-primary)]/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[color:var(--pe-primary)]">
            Strategic Alliance
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-[var(--pe-on-surface)] md:text-5xl">Global partners</h2>
        </div>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {experience.partners.map((partner) => {
            const card = (
              <div className="group flex aspect-square flex-col items-center justify-center rounded-[2rem] border border-white/10 p-12 pe-glass-panel transition-all duration-500 hover:scale-[1.02] hover:border-[color:var(--pe-primary)]/30 pe-partner-logo-glow">
                <div className="relative flex min-h-[120px] items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-white/5 blur-2xl transition-colors group-hover:bg-[color:var(--pe-primary)]/10" />
                  {partner.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={partner.logoUrl} alt={partner.name} className="relative z-10 max-h-24 object-contain opacity-80 group-hover:opacity-100" />
                  ) : (
                    <Building2 className="relative z-10 h-24 w-24 text-[var(--pe-on-surface)] opacity-80 transition-all group-hover:text-[color:var(--pe-primary)] group-hover:opacity-100" />
                  )}
                </div>
                <p className="mt-4 text-center text-sm font-semibold text-[var(--pe-on-surface-variant)]">{partner.name}</p>
              </div>
            );
            return partner.href ? (
              <a key={partner.id} href={partner.href} target="_blank" rel="noopener noreferrer">
                {card}
              </a>
            ) : (
              <div key={partner.id}>{card}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
