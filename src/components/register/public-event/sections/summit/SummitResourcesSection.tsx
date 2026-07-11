"use client";

import { FileText } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";

import { SectionHeader } from "../shared/SectionHeader";
import { SectionShell } from "../shared/SectionShell";
import { resourceHref, resourceIcon } from "./summitSectionUtils";

type Props = {
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  hasProgram: boolean;
  onDownloadAgendaPdf: () => void;
};

/** Template 1 light — standalone resources list */
export function SummitResourcesSection({ experience, theme, hasProgram, onDownloadAgendaPdf }: Props) {
  const section = resolvePublicEventSectionHeader("resources", experience, { variant: "summit" });

  return (
    <SectionShell id={PUBLIC_EVENT_SECTION_IDS.resources} theme={theme} variant="default">
      <SectionHeader
        theme={theme}
        variant="professional-light"
        badge={section.badge}
        title={section.title}
        description={section.description}
        centered={false}
      />
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200/80">
        <ul className="divide-y divide-zinc-100">
          {hasProgram ? (
            <li className="flex flex-col gap-4 p-6 transition-colors hover:bg-zinc-50/80 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <FileText className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h5 className="font-semibold text-zinc-900">Detailed PDF schedule</h5>
                  <p className="text-xs text-on-surface-variant">PDF</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onDownloadAgendaPdf}
                className="shrink-0 text-xs font-bold uppercase tracking-widest text-accent hover:opacity-70"
              >
                Download
              </button>
            </li>
          ) : null}
          {experience.resources.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-4 p-6 transition-colors hover:bg-zinc-50/80 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-4">
                {resourceIcon(r.kind, "summit-light")}
                <div className="min-w-0">
                  <h5 className="font-semibold text-zinc-900">{r.title}</h5>
                  <p className="text-xs text-on-surface-variant">
                    {r.kind}
                    {r.meta ? ` · ${r.meta}` : ""}
                  </p>
                </div>
              </div>
              <a
                href={resourceHref(r)}
                target={/^https?:\/\//i.test(resourceHref(r)) ? "_blank" : undefined}
                rel={/^https?:\/\//i.test(resourceHref(r)) ? "noopener noreferrer" : undefined}
                download={r.fileUrl ? true : undefined}
                className="shrink-0 text-xs font-bold uppercase tracking-widest text-accent hover:opacity-70"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
