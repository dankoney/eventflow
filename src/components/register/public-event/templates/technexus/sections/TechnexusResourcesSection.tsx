"use client";

import { FileText, Mic, Plane } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import { resourceHref } from "../../../sections/summit/summitSectionUtils";

import { TechnexusSectionTitle } from "./TechnexusSectionTitle";

type Props = {
  experience: PublicEventExperiencePayload;
  hasProgram: boolean;
  onDownloadAgendaPdf: () => void;
  sectionBandClass: string;
};

function kindIcon(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes("speaker")) return Mic;
  if (k.includes("travel")) return Plane;
  return FileText;
}

export function TechnexusResourcesSection({
  experience,
  hasProgram,
  onDownloadAgendaPdf,
  sectionBandClass
}: Props) {
  const section = resolvePublicEventSectionHeader("resources", experience, { variant: "technexus" });
  const hasItems = experience.resources.length > 0 || hasProgram;
  if (!hasItems) return null;

  return (
    <section id={PUBLIC_EVENT_SECTION_IDS.resources} className={cn("tn-section scroll-mt-24", sectionBandClass)}>
      <div className="tn-section-inner">
        <div className={section.title || section.description ? "mb-16 text-center" : "mb-0"}>
          <TechnexusSectionTitle title={section.title} centered />
          {section.description ? (
            <p className="mx-auto max-w-2xl text-lg text-[var(--pe-on-surface-variant)]">{section.description}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {hasProgram ? (
            <button
              type="button"
              onClick={onDownloadAgendaPdf}
              className="tn-glass-card tn-glow-hover flex flex-col items-center rounded-xl p-6 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--pe-primary)]/10 text-[var(--pe-primary)]">
                <FileText className="h-8 w-8" aria-hidden />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[var(--pe-on-surface)]">Agenda PDF</h3>
              <p className="text-sm text-[var(--pe-on-surface-variant)]">Download the full program schedule.</p>
            </button>
          ) : null}
          {experience.resources.map((r) => {
            const Icon = kindIcon(r.kind);
            return (
              <a
                key={r.id}
                href={resourceHref(r)}
                target={/^https?:\/\//i.test(resourceHref(r)) ? "_blank" : undefined}
                rel={/^https?:\/\//i.test(resourceHref(r)) ? "noopener noreferrer" : undefined}
                download={r.fileUrl ? true : undefined}
                className="tn-glass-card tn-glow-hover flex flex-col items-center rounded-xl p-6 text-center"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--pe-primary)]/10 text-[var(--pe-primary)]">
                  <Icon className="h-8 w-8" aria-hidden />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[var(--pe-on-surface)]">{r.title}</h3>
                {r.summary ? (
                  <p className="text-sm text-[var(--pe-on-surface-variant)]">{r.summary}</p>
                ) : null}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
