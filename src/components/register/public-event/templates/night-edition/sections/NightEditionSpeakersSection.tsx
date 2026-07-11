"use client";

import { ArrowRight, Globe, Linkedin } from "lucide-react";
import { useState } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { speakerTextColors } from "@/lib/public-event/speakerTextColors";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

import { SectionHeader } from "../../../sections/shared/SectionHeader";
import { SectionShell } from "../../../sections/shared/SectionShell";
import { SpeakerGrid } from "../../../sections/shared/SpeakerGrid";
import { bioExcerpt, speakerInitials } from "@/components/register/public-event/sections/shared/utils";

type Props = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
};

type Speaker = PublicEventExperiencePayload["speakers"][number];
type SpeakerColors = ReturnType<typeof speakerTextColors>;

function titleCaseName(name: string): string {
  return name.trim().toUpperCase();
}

function SpeakerMobileCard({
  speaker: s,
  onReadMore,
  colors
}: {
  speaker: Speaker;
  onReadMore: () => void;
  colors: SpeakerColors;
}) {
  const company = s.company?.trim();
  const bioShort = bioExcerpt(s.bio, 160);
  const hasLongBio = s.bio.trim().length > 160;

  return (
    <article className="pe-speaker-mobile-card overflow-hidden rounded-2xl border border-[var(--pe-outline-variant)]/30 bg-[var(--pe-surface-container)]/80 shadow-lg">
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-[var(--pe-surface-container-high)]">
        {s.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.imageUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-[var(--pe-on-surface-variant)]">
            {speakerInitials(s.name)}
          </span>
        )}
        {company ? (
          <span
            className={cn(
              "absolute left-3 top-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full border border-[var(--pe-outline-variant)]/40 bg-[var(--pe-background)]/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest backdrop-blur-md",
              colors.company.className
            )}
            style={colors.company.style}
          >
            {company}
          </span>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className={cn("text-lg font-bold leading-tight", colors.name.className)} style={colors.name.style}>
            {s.name}
          </h3>
          <p
            className={cn("mt-1 text-[10px] font-bold uppercase tracking-widest", colors.title.className)}
            style={colors.title.style}
          >
            {s.title}
          </p>
        </div>
        {bioShort ? (
          <p className={cn("text-sm leading-relaxed", colors.bio.className)} style={colors.bio.style}>
            {bioShort}
          </p>
        ) : null}
        {(s.social?.linkedin || s.social?.website || hasLongBio) ? (
          <div className="flex flex-wrap items-center gap-4 pt-1">
            {s.social?.linkedin ? (
              <a
                href={s.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("hover:opacity-80", colors.social.className)}
                style={colors.social.style}
                aria-label={`${s.name} on LinkedIn`}
              >
                <Linkedin className="h-5 w-5" />
              </a>
            ) : null}
            {s.social?.website ? (
              <a
                href={s.social.website}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("hover:opacity-80", colors.social.className)}
                style={colors.social.style}
                aria-label={`${s.name} website`}
              >
                <Globe className="h-5 w-5" />
              </a>
            ) : null}
            {hasLongBio ? (
              <button
                type="button"
                onClick={onReadMore}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide",
                  colors.social.className
                )}
                style={colors.social.style}
              >
                Read full bio
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SpeakerKineticCard({
  speaker: s,
  isFeatured,
  onReadMore,
  colors
}: {
  speaker: Speaker;
  isFeatured: boolean;
  onReadMore: () => void;
  colors: SpeakerColors;
}) {
  const company = s.company?.trim();
  const bioShort = bioExcerpt(s.bio, 140);
  const hasLongBio = s.bio.trim().length > 140;

  return (
    <article className={cn("pe-kinetic-card group", isFeatured && "pe-kinetic-card--expanded")}>
      <div className="pe-kinetic-img-wrap absolute inset-0">
        {s.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.imageUrl} alt="" className="pe-kinetic-img h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full min-h-[200px] w-full items-center justify-center bg-[var(--pe-surface-container-high)]">
            <span className="text-2xl font-bold text-[var(--pe-on-surface-variant)]">{speakerInitials(s.name)}</span>
          </div>
        )}
      </div>
      <div className="pe-kinetic-caption absolute bottom-0 left-0 z-10 w-full">
        {company ? (
          <span
            className={cn(
              "mb-2 inline-flex max-w-full items-center rounded-full border border-[var(--pe-outline-variant)]/30 bg-[var(--pe-surface-container-high)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest",
              colors.company.className
            )}
            style={colors.company.style}
          >
            {company}
          </span>
        ) : null}
        <h3
          className={cn("text-base font-bold leading-tight md:text-lg", colors.name.className)}
          style={colors.name.style}
        >
          {titleCaseName(s.name)}
        </h3>
        <p
          className={cn("mt-0.5 text-[10px] font-semibold uppercase tracking-widest md:text-xs", colors.title.className)}
          style={colors.title.style}
        >
          {s.title}
        </p>
        <div className="pe-kinetic-content">
          {bioShort ? (
            <p className={cn("mb-3 mt-3 text-xs leading-relaxed md:text-sm", colors.bio.className)} style={colors.bio.style}>
              {bioShort}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {s.social?.linkedin ? (
              <a
                href={s.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("transition-colors hover:opacity-80", colors.social.className)}
                style={colors.social.style}
                aria-label={`${s.name} on LinkedIn`}
              >
                <Linkedin className="h-4 w-4" />
              </a>
            ) : null}
            {s.social?.website ? (
              <a
                href={s.social.website}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("transition-colors hover:opacity-80", colors.social.className)}
                style={colors.social.style}
                aria-label={`${s.name} website`}
              >
                <Globe className="h-4 w-4" />
              </a>
            ) : null}
            {hasLongBio ? (
              <button
                type="button"
                onClick={onReadMore}
                className={cn("transition-colors hover:opacity-80", colors.social.className)}
                style={colors.social.style}
                aria-label={`Read full bio for ${s.name}`}
              >
                Read bio
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

/** `#speakers` — configurable grid or kinetic faculty gallery */
export function NightEditionSpeakersSection({ experience, theme }: Props) {
  const [modal, setModal] = useState<Speaker | null>(null);
  const section = resolvePublicEventSectionHeader("speakers", experience, { variant: "night-edition" });
  const speakers = experience.speakers;
  const useGrid = experience.speakersDisplay?.layout === "grid";
  const colors = speakerTextColors(experience.speakersDisplay);

  if (speakers.length === 0) return null;

  return (
    <>
      <SectionShell id={PUBLIC_EVENT_SECTION_IDS.speakers} theme={theme} variant="bordered" className="!bg-[var(--pe-background)]">
        <SectionHeader
          theme={theme}
          variant="night-edition"
          badge={section.badge}
          title={section.title}
          description={section.description}
          gradientTitle={false}
        />

        {useGrid ? (
          <SpeakerGrid experience={experience} theme={theme} variant="night-edition" />
        ) : (
          <>
            <div className="pe-speakers-mobile flex flex-col gap-5 md:hidden">
              {speakers.map((s) => (
                <SpeakerMobileCard key={s.id} speaker={s} onReadMore={() => setModal(s)} colors={colors} />
              ))}
            </div>
            <div className="pe-kinetic-gallery hidden md:flex">
              {speakers.map((s, index) => (
                <SpeakerKineticCard
                  key={s.id}
                  speaker={s}
                  isFeatured={index === 0}
                  onReadMore={() => setModal(s)}
                  colors={colors}
                />
              ))}
            </div>
          </>
        )}
      </SectionShell>

      <Modal
        open={modal != null}
        title={modal?.name ?? ""}
        subtitle={modal ? `${modal.title}${modal.company?.trim() ? ` · ${modal.company}` : ""}` : undefined}
        onClose={() => setModal(null)}
        size="lg"
        tone="dark"
        headerTone="dark"
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
