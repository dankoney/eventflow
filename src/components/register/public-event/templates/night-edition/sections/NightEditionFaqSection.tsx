"use client";

import { ChevronDown, HelpCircle } from "lucide-react";
import { useState } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { SectionHeader } from "../../../sections/shared/SectionHeader";

type Props = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
};

function faqImageUrl(experience: PublicEventExperiencePayload): string | null {
  const url = experience.faqImageUrl?.trim();
  return url || null;
}

/** `#faq` — CMS: `experience.faqItems[]`, optional `faqImageUrl` */
export function NightEditionFaqSection({ experience, theme }: Props) {
  const [openId, setOpenId] = useState<string | null>(experience.faqItems[0]?.id ?? null);
  const section = resolvePublicEventSectionHeader("faq", experience, { variant: "night-edition" });
  const imageSrc = faqImageUrl(experience);

  return (
    <section
      id={PUBLIC_EVENT_SECTION_IDS.faq}
      className="pe-section-faq relative scroll-mt-24 overflow-hidden px-5 py-24 md:px-16"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-[color:var(--pe-primary)]/6 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-[var(--pe-container-max,1280px)]">
        <SectionHeader
          theme={theme}
          variant="night-edition"
          badge={section.badge}
          title={section.title}
          description={section.description}
          gradientTitle
        />

        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-14">
          {imageSrc ? (
            <div className="lg:col-span-5">
              <div className="pe-faq-visual relative aspect-[5/4] overflow-hidden rounded-2xl border border-white/10 lg:sticky lg:top-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageSrc} alt="" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[var(--pe-background)]/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 p-5">
                  <HelpCircle className="h-5 w-5 text-[color:var(--pe-primary)]" aria-hidden />
                  <span className="text-sm font-semibold text-white/90">Common questions</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className={cn("space-y-3", imageSrc ? "lg:col-span-7" : "lg:col-span-12")}>
            {experience.faqItems.map((item, index) => {
              const open = openId === item.id;
              return (
                <div
                  key={item.id}
                  className="pe-faq-item overflow-hidden rounded-2xl border border-white/10 transition-colors hover:border-white/15"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-white/[0.03]"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : item.id)}
                  >
                    <span className="text-base font-semibold text-[var(--pe-on-surface)]">{item.question}</span>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-[color:var(--pe-primary)] transition-transform duration-300",
                        open && "rotate-180"
                      )}
                      aria-hidden
                    />
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300 ease-out",
                      open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="border-t border-white/5 px-6 pb-6 pt-3 text-sm leading-relaxed text-[var(--pe-on-surface-variant)]">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
