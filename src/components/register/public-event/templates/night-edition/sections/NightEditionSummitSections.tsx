"use client";

import { Download, FileText } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { buildAgendaPdfHtml } from "@/lib/public-event/agendaPdfHtml";

import { resourceHref } from "@/components/register/public-event/sections/shared/utils";
import type { PublicEventPageModel } from "../../../templates/usePublicEventPageModel";
import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  pageModel: PublicEventPageModel;
  hasProgramContent: boolean;
};

/** Resources block — Template 2 */
export function NightEditionSummitSections({
  summary,
  experience,
  pageModel,
  hasProgramContent
}: Props) {
  function downloadAgendaPdf() {
    const html = buildAgendaPdfHtml({
      eventName: summary.name,
      orgName: summary.orgName,
      periodLabel: summary.periodLabel,
      locationLine: summary.locationLine,
      description: summary.description,
      experience
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  if (!pageModel.showResourcesSection) return null;

  return (
    <section
      id={PUBLIC_EVENT_SECTION_IDS.resources}
      className="scroll-mt-24 rounded-t-[2rem] bg-[var(--pe-surface-container-lowest)] px-5 py-20 md:px-16 md:py-24"
    >
      <div className="mx-auto max-w-[var(--pe-container-max,1280px)]">
        <h2 className="mb-8 text-3xl font-extrabold text-[var(--pe-on-surface)]">Attendee resources</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {hasProgramContent ? (
            <div className="pe-panel-surface rounded-xl p-6">
              <FileText className="mb-4 h-9 w-9 text-[color:var(--pe-primary)]" />
              <h3 className="font-semibold text-[var(--pe-on-surface)]">Detailed PDF schedule</h3>
              <button
                type="button"
                onClick={downloadAgendaPdf}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--pe-primary)]"
              >
                Download
                <Download className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          {experience.resources.map((r) => (
            <div
              key={r.id}
              className="pe-panel-surface rounded-xl p-6 transition hover:border-[color-mix(in_srgb,var(--pe-primary)_35%,transparent)]"
            >
              <FileText className="mb-4 h-9 w-9 text-[color:var(--pe-primary)]" />
              <h3 className="font-semibold text-[var(--pe-on-surface)]">{r.title}</h3>
              <p className="mt-1 text-xs text-[var(--pe-on-surface-variant)]">{r.kind}</p>
              <a
                href={resourceHref(r)}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--pe-primary)]"
              >
                Download
                <Download className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
