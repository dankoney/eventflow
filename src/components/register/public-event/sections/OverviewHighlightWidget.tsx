"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Lightbulb, Network } from "lucide-react";
import { useRef, useState } from "react";

import { CountryFlag } from "@/components/public-event/CountryFlag";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { countryByCode, countryMatchesQuery } from "@/lib/public-event/countriesByContinent";
import { cn } from "@/lib/utils";

import { CountryAttendanceSearch } from "./shared/CountryAttendanceSearch";

type Props = {
  experience: PublicEventExperiencePayload;
  className?: string;
};

type CountryRow = {
  id: string;
  countryCode: string;
  countryName: string;
  flagImageUrl?: string | null;
};

function CountryFlagCell({ row }: { row: CountryRow }) {
  const [legacyFailed, setLegacyFailed] = useState(false);

  if (row.flagImageUrl && !legacyFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={row.flagImageUrl}
        alt=""
        className="h-5 w-7 shrink-0 rounded object-cover shadow-sm"
        onError={() => setLegacyFailed(true)}
      />
    );
  }

  return <CountryFlag code={row.countryCode} title={row.countryName} />;
}

export function OverviewHighlightWidget({ experience, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const highlights = experience.overviewHighlights;
  const mode = highlights?.mode ?? "default";

  if (mode === "none") return null;

  if (mode === "carousel") {
    const items = highlights.carouselItems ?? [];
    if (items.length === 0) return null;
    const scroll = (dir: -1 | 1) => {
      scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
    };
    return (
      <div className={cn("relative", className)}>
        <div className="mb-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--pe-outline-variant)] text-[var(--pe-on-surface)] hover:bg-[var(--pe-primary)]/10"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--pe-outline-variant)] text-[var(--pe-on-surface)] hover:bg-[var(--pe-primary)]/10"
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pe-no-scrollbar"
        >
          {items.map((item) => (
            <article
              key={item.id}
              className="group relative aspect-[4/3] w-[min(85%,280px)] shrink-0 snap-start overflow-hidden rounded-xl border border-[var(--pe-outline-variant)]/40"
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
              ) : (
                <div className="flex h-full items-center justify-center bg-[var(--pe-surface-container-high)] text-sm text-[var(--pe-on-surface-variant)]">
                  Add image
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--pe-background)]/90 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-4">
                <h4 className="font-semibold text-[var(--pe-on-surface)]">{item.title}</h4>
                {item.href ? (
                  <a
                    href={item.href}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--pe-primary)]"
                  >
                    Learn more <ArrowRight className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "country_flags") {
    const codes = highlights.selectedCountryCodes ?? [];
    const legacy = highlights.countryFlags ?? [];
    const rows: CountryRow[] =
      codes.length > 0
        ? codes.flatMap((code) => {
            const c = countryByCode(code);
            return c ? [{ id: code, countryCode: code, countryName: c.name, flagImageUrl: null }] : [];
          })
        : legacy.map((row) => ({
            id: row.id,
            countryCode: /^[A-Za-z]{2}$/.test(row.id) ? row.id : "",
            countryName: row.countryName,
            flagImageUrl: row.flagImageUrl ?? null
          }));
    const filteredRows = countryQuery.trim()
      ? rows.filter((row) => countryMatchesQuery({ code: row.countryCode || row.id, name: row.countryName }, countryQuery))
      : rows;

    if (rows.length === 0) return null;
    return (
      <div className={cn("relative", className)}>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pe-on-surface-variant)]">
            {filteredRows.length} of {rows.length} {rows.length === 1 ? "country" : "countries"} attending
          </p>
          <CountryAttendanceSearch
            value={countryQuery}
            onChange={setCountryQuery}
            className="w-full sm:max-w-xs"
            inputClassName="border-[var(--pe-outline-variant)] bg-[var(--pe-surface-container-low)] text-[var(--pe-on-surface)] placeholder:text-[var(--pe-on-surface-variant)] focus:border-[color:var(--pe-primary)] focus:ring-[color:var(--pe-primary)]/20"
          />
        </div>
        <div className="max-h-[min(22rem,42vh)] overflow-y-auto rounded-xl pe-panel-surface-inner p-3 pe-no-scrollbar">
          {filteredRows.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--pe-on-surface-variant)]">
              No countries match your search.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filteredRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--pe-outline-variant)_28%,transparent)] bg-[color-mix(in_srgb,var(--pe-surface-container)_70%,transparent)] px-2.5 py-2"
                >
                  <CountryFlagCell row={row} />
                  <span className="min-w-0 truncate text-xs font-medium text-[var(--pe-on-surface)] sm:text-sm">
                    {row.countryName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <ul className={cn("space-y-4", className)}>
      <li className="flex gap-4">
        <div className="rounded-lg bg-[color:var(--pe-primary)]/10 p-2 text-[color:var(--pe-primary)]">
          <Lightbulb className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <strong className="block text-[var(--pe-on-surface)]">Program highlights</strong>
          <span className="text-sm text-[var(--pe-on-surface-variant)]">
            Keynotes, interactive sessions, practical discussions, and curated networking opportunities.
          </span>
        </div>
      </li>
      <li className="flex gap-4">
        <div className="rounded-lg bg-[color:var(--pe-primary)]/10 p-2 text-[color:var(--pe-primary)]">
          <Network className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <strong className="block text-[var(--pe-on-surface)]">Unified community</strong>
          <span className="text-sm text-[var(--pe-on-surface-variant)]">
            Connect with peers, experts, and stakeholders from across the industry.
          </span>
        </div>
      </li>
    </ul>
  );
}
