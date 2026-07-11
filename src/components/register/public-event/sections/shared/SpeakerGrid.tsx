"use client";

import { Globe, Linkedin } from "lucide-react";
import { useState } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import {
  speakerGridClass,
  speakerImageHoverClass,
  type SpeakerGridColumns,
  type SpeakerHoverStyle
} from "@/lib/public-event/speakersDisplay";
import { speakerTextColors } from "@/lib/public-event/speakerTextColors";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

import { bioExcerpt, speakerInitials, type SpeakerRow } from "./utils";

type Props = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
  columns?: SpeakerGridColumns;
  hoverStyle?: SpeakerHoverStyle;
  cardClassName?: string;
};

export function SpeakerGrid({
  experience,
  theme,
  variant,
  columns = experience.speakersDisplay?.columns ?? 3,
  hoverStyle = experience.speakersDisplay?.hoverStyle ?? "zoom",
  cardClassName
}: Props) {
  const [modal, setModal] = useState<SpeakerRow | null>(null);
  const speakers = experience.speakers.filter((s) => s.name?.trim());
  const colors = speakerTextColors(experience.speakersDisplay);
  const isNight = variant === "night-edition" || variant === "technexus-dark" || variant === "technexus-light";
  const isTechnexus = variant === "technexus-dark" || variant === "technexus-light";
  const imageHover = speakerImageHoverClass(hoverStyle);

  if (speakers.length === 0) return null;

  return (
    <>
      <div className={speakerGridClass(columns, speakers.length)}>
        {speakers.map((s) => {
          const excerpt = bioExcerpt(s.bio, 140);
          const showReadMore = s.bio.trim().length > 140;
          return (
            <article
              key={s.id}
              className={cn(
                "group flex flex-col overflow-hidden",
                isTechnexus ? cn("tn-glass-card tn-glow-hover", cardClassName) : cardClassName,
                !isTechnexus &&
                  (isNight
                    ? "rounded-xl border border-[var(--pe-outline-variant)]/30 bg-[var(--pe-surface-container)]/80 transition hover:border-[color:var(--pe-primary)]/40"
                    : cn(theme.card, "p-4", theme.cardHover))
              )}
            >
              <div
                className={cn(
                  "relative overflow-hidden",
                  isTechnexus || isNight ? "aspect-square" : "mb-6 aspect-square rounded-lg bg-[var(--pe-surface-container-high)]"
                )}
              >
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt="" className={cn("h-full w-full object-cover", imageHover)} />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[var(--pe-surface-container-high)] text-2xl font-bold text-[color:var(--pe-primary)]">
                    {speakerInitials(s.name)}
                  </span>
                )}
                {isNight && !isTechnexus ? (
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--pe-background)]/80 to-transparent opacity-70" />
                ) : null}
              </div>
              <div className={cn("flex flex-1 flex-col", (isNight || isTechnexus) && "p-5 md:p-6")}>
                <h4 className={cn("text-lg font-semibold", colors.name.className)} style={colors.name.style}>
                  {s.name}
                </h4>
                <p
                  className={cn("mt-1 text-[10px] font-bold uppercase tracking-widest", colors.title.className)}
                  style={colors.title.style}
                >
                  {s.title}
                  {s.company?.trim() ? ` · ${s.company}` : ""}
                </p>
                <p className={cn("mt-3 flex-1 text-sm leading-relaxed", colors.bio.className)} style={colors.bio.style}>
                  {excerpt}
                </p>
                {(s.social?.linkedin || s.social?.twitter || s.social?.website) && (
                  <div className="mt-4 flex gap-3">
                    {s.social.linkedin ? (
                      <a
                        href={s.social.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn("hover:opacity-80", colors.social.className)}
                        style={colors.social.style}
                        aria-label={`${s.name} on LinkedIn`}
                      >
                        <Linkedin className="h-4 w-4" />
                      </a>
                    ) : null}
                    {s.social.website ? (
                      <a
                        href={s.social.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn("hover:opacity-80", colors.social.className)}
                        style={colors.social.style}
                        aria-label={`${s.name} website`}
                      >
                        <Globe className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                )}
                {showReadMore ? (
                  <button
                    type="button"
                    onClick={() => setModal(s)}
                    className={cn(
                      "mt-3 text-left text-xs font-bold uppercase tracking-wide hover:underline",
                      colors.social.className
                    )}
                    style={colors.social.style}
                  >
                    Read more
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={modal != null}
        title={modal?.name ?? "Speaker"}
        subtitle={modal ? `${modal.title}${modal.company?.trim() ? ` · ${modal.company}` : ""}` : undefined}
        onClose={() => setModal(null)}
        size="lg"
        tone={isNight ? "dark" : "light"}
        headerTone={isNight ? "dark" : "light"}
      >
        {modal ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--pe-on-surface-variant)]">
            {modal.bio}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
