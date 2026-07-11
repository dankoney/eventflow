"use client";

import { Accessibility, Car, MapPin, Wifi } from "lucide-react";
import { useState } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import type { PublicEventSiteSummary } from "../../siteSummary";
import { SectionHeader } from "../shared/SectionHeader";
import { SectionShell } from "../shared/SectionShell";
import type { SummitSectionVariant } from "./summitSectionUtils";

type Props = {
  variant: SummitSectionVariant;
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  mapsHref: string;
  theme: PublicEventThemeClasses;
};

function CopyWifiRow({
  label,
  value,
  dark
}: {
  label: string;
  value: string;
  dark: boolean;
}) {
  const [done, setDone] = useState(false);
  if (!value.trim()) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border p-3",
        dark ? "border-white/10 bg-zinc-950/40" : "border-outline-variant/40 bg-surface-container-low"
      )}
    >
      <div className="min-w-0">
        <span className={cn("mb-1 block text-[10px] font-semibold uppercase", dark ? "text-zinc-500" : "text-on-surface-variant")}>
          {label}
        </span>
        <span className={cn("block truncate font-mono text-sm font-medium", dark ? "text-zinc-100" : "text-zinc-900")}>
          {value}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          });
        }}
        className={cn(
          "shrink-0 rounded px-2 py-1 text-xs font-semibold",
          dark ? "text-zinc-400 hover:bg-white/10" : "text-accent hover:bg-accent/10"
        )}
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** `#venue-ops` — parking, accessibility, Wi‑Fi, and maps for on-site attendees. */
export function SummitVenueOpsSection({ variant, summary, experience, mapsHref, theme }: Props) {
  const dark = variant === "summit-dark";
  const parking = experience.venue?.parkingInfo?.trim() ?? null;
  const access = experience.venue?.accessInfo?.trim() ?? null;
  const hasWifi =
    Boolean(experience.venue?.wifiSsid?.trim()) ||
    Boolean(experience.venue?.wifiPassword?.trim()) ||
    Boolean(experience.venue?.wifiNote?.trim());
  const section = resolvePublicEventSectionHeader("venueOps", experience, {
    variant: dark ? "night-edition" : "summit"
  });

  return (
    <SectionShell id={PUBLIC_EVENT_SECTION_IDS.venueOps} theme={theme} variant="default">
      <SectionHeader
        theme={theme}
        variant={dark ? "night-edition" : "professional-light"}
        badge={section.badge}
        title={section.title}
        description={section.description}
        centered={false}
      />

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className={cn("rounded-xl p-6 lg:col-span-5", dark ? theme.card : "border border-outline-variant/30 bg-white shadow-sm")}>
          <div className="flex items-start gap-3">
            <MapPin className={cn("h-5 w-5 shrink-0", dark ? "text-[color:var(--accent)]" : "text-accent")} aria-hidden />
            <div>
              <p className={cn("text-xs font-semibold uppercase tracking-wide", theme.muted)}>Location</p>
              <p className={cn("mt-1 text-sm font-semibold", dark ? "text-zinc-100" : "text-zinc-900")}>
                {summary.locationLine}
              </p>
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("mt-3 inline-flex text-sm font-semibold hover:underline", dark ? "text-[color:var(--accent)]" : "text-accent")}
              >
                Open in Maps
              </a>
            </div>
          </div>
          {summary.location.facilityImageUrl ? (
            <div className={cn("mt-6 overflow-hidden rounded-lg border", dark ? "border-white/10" : "border-outline-variant")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={summary.location.facilityImageUrl} alt="" className="aspect-video w-full object-cover" />
            </div>
          ) : null}
        </div>

        <div className="space-y-4 lg:col-span-7">
          {parking ? (
            <div className={cn("rounded-xl p-6", dark ? theme.card : "border border-outline-variant/30 bg-white shadow-sm")}>
              <div className="mb-3 flex items-center gap-2">
                <Car className={cn("h-5 w-5", dark ? "text-[color:var(--accent)]" : "text-accent")} aria-hidden />
                <h3 className={cn("text-base font-semibold", theme.heading)}>Parking & arrival</h3>
              </div>
              <p className={cn("text-sm leading-relaxed", theme.muted)}>{parking}</p>
            </div>
          ) : null}
          {access ? (
            <div className={cn("rounded-xl p-6", dark ? theme.card : "border border-outline-variant/30 bg-white shadow-sm")}>
              <div className="mb-3 flex items-center gap-2">
                <Accessibility className={cn("h-5 w-5", dark ? "text-[color:var(--accent)]" : "text-accent")} aria-hidden />
                <h3 className={cn("text-base font-semibold", theme.heading)}>Accessibility</h3>
              </div>
              <p className={cn("text-sm leading-relaxed", theme.muted)}>{access}</p>
            </div>
          ) : null}
          {hasWifi ? (
            <div className={cn("rounded-xl p-6", dark ? theme.card : "border border-outline-variant/30 bg-white shadow-sm")}>
              <div className="mb-4 flex items-center gap-2">
                <Wifi className={cn("h-5 w-5", dark ? "text-[color:var(--accent)]" : "text-accent")} aria-hidden />
                <h3 className={cn("text-base font-semibold", theme.heading)}>Wi‑Fi</h3>
              </div>
              <div className="space-y-3">
                <CopyWifiRow label="Network" value={experience.venue?.wifiSsid?.trim() ?? ""} dark={dark} />
                <CopyWifiRow label="Password" value={experience.venue?.wifiPassword?.trim() ?? ""} dark={dark} />
              </div>
              {experience.venue?.wifiNote?.trim() ? (
                <p className={cn("mt-4 text-xs leading-relaxed", theme.muted)}>{experience.venue.wifiNote}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}
