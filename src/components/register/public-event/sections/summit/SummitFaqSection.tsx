"use client";

import { ChevronDown, HelpCircle } from "lucide-react";
import { useState } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { SectionHeader } from "../shared/SectionHeader";
import { SectionShell } from "../shared/SectionShell";
import type { SummitSectionVariant } from "./summitSectionUtils";

type Props = {
  variant: SummitSectionVariant;
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
};

/** `#faq` — accordion Q&A for Template 1. */
export function SummitFaqSection({ variant, experience, theme }: Props) {
  const dark = variant === "summit-dark";
  const [openId, setOpenId] = useState<string | null>(experience.faqItems[0]?.id ?? null);
  const section = resolvePublicEventSectionHeader("faq", experience, { variant: "summit" });
  const imageSrc = experience.faqImageUrl?.trim() || null;

  return (
    <SectionShell id={PUBLIC_EVENT_SECTION_IDS.faq} theme={theme} variant="default">
      <SectionHeader
        theme={theme}
        variant={dark ? "night-edition" : "professional-light"}
        badge={section.badge}
        title={section.title}
        description={section.description}
      />

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
        {imageSrc ? (
          <div className="lg:col-span-5">
            <div
              className={cn(
                "relative aspect-[5/4] overflow-hidden rounded-2xl border",
                dark ? "border-white/10" : "border-outline-variant/30 shadow-sm"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc} alt="" className="h-full w-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-5">
                <HelpCircle className="h-5 w-5 text-white" aria-hidden />
                <span className="text-sm font-semibold text-white">Common questions</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className={cn("space-y-3", imageSrc ? "lg:col-span-7" : "lg:col-span-12")}>
          {experience.faqItems.map((item) => {
            const open = openId === item.id;
            return (
              <div
                key={item.id}
                className={cn(
                  "overflow-hidden rounded-xl border transition",
                  dark ? "border-white/10 bg-zinc-900/60" : "border-outline-variant/30 bg-white shadow-sm hover:shadow-md"
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <span className={cn("text-base font-semibold", dark ? "text-zinc-50" : "text-zinc-950")}>
                    {item.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform",
                      dark ? "text-[color:var(--accent)]" : "text-accent",
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
                    <p
                      className={cn(
                        "border-t px-5 pb-5 pt-3 text-sm leading-relaxed",
                        dark ? "border-white/10 text-zinc-400" : "border-outline-variant/30 text-on-surface-variant"
                      )}
                    >
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}
