"use client";

import { Accessibility, Car, MapPin, Wifi } from "lucide-react";
import { useState } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import type { PublicEventSiteSummary } from "../../../siteSummary";

import { TechnexusSectionTitle } from "./TechnexusSectionTitle";

type Props = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  mapsHref: string;
  sectionBandClass: string;
};

function CopyWifiRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  if (!value.trim()) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--pe-outline-variant)] bg-[var(--pe-surface-container-high)] p-3">
      <div className="min-w-0">
        <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--pe-on-surface-variant)]">
          {label}
        </span>
        <span className="block truncate font-mono text-sm font-medium text-[var(--pe-on-surface)]">{value}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          });
        }}
        className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-[var(--pe-primary)] hover:bg-[var(--pe-primary)]/10"
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function TechnexusVenueSection({ summary, experience, mapsHref, sectionBandClass }: Props) {
  const section = resolvePublicEventSectionHeader("venueOps", experience, { variant: "technexus" });
  const parking = experience.venue?.parkingInfo?.trim();
  const access = experience.venue?.accessInfo?.trim();
  const hasWifi =
    Boolean(experience.venue?.wifiSsid?.trim()) ||
    Boolean(experience.venue?.wifiPassword?.trim()) ||
    Boolean(experience.venue?.wifiNote?.trim());
  const facilityImage = summary.location.facilityImageUrl?.trim() || null;

  return (
    <section id={PUBLIC_EVENT_SECTION_IDS.venueOps} className={cn("tn-section scroll-mt-24", sectionBandClass)}>
      <div className="tn-section-inner">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <TechnexusSectionTitle title={section.title} />
            {section.description ? (
              <p className="mb-6 text-lg text-[var(--pe-on-surface-variant)]">{section.description}</p>
            ) : null}
            <div className="mb-8 space-y-4 text-[var(--pe-on-surface)]">
              <div className="flex gap-3">
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-[var(--pe-primary)]" aria-hidden />
                <span>{summary.locationLine}</span>
              </div>
              {parking ? (
                <div className="flex gap-3">
                  <Car className="mt-1 h-5 w-5 shrink-0 text-[var(--pe-primary)]" aria-hidden />
                  <div>
                    <strong className="mb-1 block">Parking</strong>
                    <span className="text-[var(--pe-on-surface-variant)]">{parking}</span>
                  </div>
                </div>
              ) : null}
              {access ? (
                <div className="flex gap-3">
                  <Accessibility className="mt-1 h-5 w-5 shrink-0 text-[var(--pe-primary)]" aria-hidden />
                  <div>
                    <strong className="mb-1 block">Accessibility</strong>
                    <span className="text-[var(--pe-on-surface-variant)]">{access}</span>
                  </div>
                </div>
              ) : null}
              {hasWifi ? (
                <div className="flex gap-3">
                  <Wifi className="mt-1 h-5 w-5 shrink-0 text-[var(--pe-primary)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <strong className="mb-3 block">Wi‑Fi</strong>
                    <div className="space-y-3">
                      <CopyWifiRow label="Network" value={experience.venue?.wifiSsid?.trim() ?? ""} />
                      <CopyWifiRow label="Password" value={experience.venue?.wifiPassword?.trim() ?? ""} />
                    </div>
                    {experience.venue?.wifiNote?.trim() ? (
                      <p className="mt-3 text-sm text-[var(--pe-on-surface-variant)]">{experience.venue.wifiNote}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="tn-btn-outline !px-6 !py-3"
            >
              Get directions
            </a>
          </div>
          <div className="tn-glass-card aspect-video overflow-hidden rounded-xl">
            {facilityImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={facilityImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center bg-[var(--pe-surface-container-high)] text-sm text-[var(--pe-on-surface-variant)]">
                {summary.location.name || summary.locationLine}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
