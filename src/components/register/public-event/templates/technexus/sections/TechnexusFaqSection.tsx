"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import { TechnexusSectionTitle } from "./TechnexusSectionTitle";

type Props = {
  experience: PublicEventExperiencePayload;
  sectionBandClass: string;
};

export function TechnexusFaqSection({ experience, sectionBandClass }: Props) {
  const section = resolvePublicEventSectionHeader("faq", experience, { variant: "technexus" });
  const items = experience.faqItems.filter((f) => f.question?.trim() && f.answer?.trim());
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  if (items.length === 0) return null;

  return (
    <section id={PUBLIC_EVENT_SECTION_IDS.faq} className={cn("tn-section scroll-mt-24", sectionBandClass)}>
      <div className="tn-section-inner">
        <div className={section.title || section.description ? "mb-16 text-center" : "mb-0"}>
          <TechnexusSectionTitle title={section.title} centered />
          {section.description ? (
            <p className="mx-auto max-w-2xl text-lg text-[var(--pe-on-surface-variant)]">{section.description}</p>
          ) : null}
        </div>

        <div className="mx-auto max-w-3xl space-y-4">
          {items.map((item) => {
            const open = openId === item.id;
            return (
              <div
                key={item.id}
                className="tn-faq-item tn-glass-card overflow-hidden rounded-xl"
                data-open={open ? "true" : "false"}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                  onClick={() => setOpenId(open ? null : item.id)}
                  aria-expanded={open}
                >
                  <span className="pr-4 text-lg font-semibold text-[var(--pe-on-surface)]">{item.question}</span>
                  <ChevronDown className="tn-faq-icon h-5 w-5 shrink-0 text-[var(--pe-primary)] transition-transform" />
                </button>
                <div className="tn-faq-answer bg-[var(--pe-surface)]/50">
                  <div>
                    <p className="px-6 pb-4 text-sm leading-relaxed text-[var(--pe-on-surface-variant)]">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
