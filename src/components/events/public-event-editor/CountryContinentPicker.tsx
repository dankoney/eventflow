"use client";

import { useMemo, useState } from "react";

import { CountryAttendanceSearch } from "@/components/register/public-event/sections/shared/CountryAttendanceSearch";
import { CountryFlag } from "@/components/public-event/CountryFlag";
import {
  CONTINENT_IDS,
  CONTINENT_LABELS,
  COUNTRIES_BY_CONTINENT,
  filterCountriesByQuery,
  type ContinentId
} from "@/lib/public-event/countriesByContinent";
import { cn } from "@/lib/utils";

type Props = {
  selectedCodes: string[];
  readOnly: boolean;
  onChange: (codes: string[]) => void;
};

export function CountryContinentPicker({ selectedCodes, readOnly, onChange }: Props) {
  const [query, setQuery] = useState("");
  const selected = new Set(selectedCodes);
  const normalizedQuery = query.trim();

  const continents = useMemo(() => {
    return CONTINENT_IDS.map((continent) => ({
      continent,
      countries: filterCountriesByQuery(COUNTRIES_BY_CONTINENT[continent], query)
    })).filter((entry) => entry.countries.length > 0);
  }, [query]);

  function toggle(code: string) {
    if (readOnly) return;
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(Array.from(next).sort());
  }

  function toggleContinent(continent: ContinentId, selectAll: boolean) {
    if (readOnly) return;
    const codes = COUNTRIES_BY_CONTINENT[continent].map((c) => c.code);
    const next = new Set(selected);
    for (const code of codes) {
      if (selectAll) next.add(code);
      else next.delete(code);
    }
    onChange(Array.from(next).sort());
  }

  return (
    <div className="mt-4 space-y-4">
      <CountryAttendanceSearch value={query} onChange={setQuery} />

      {normalizedQuery && continents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 bg-white px-3 py-4 text-sm text-zinc-500">
          No countries match &ldquo;{normalizedQuery}&rdquo;.
        </p>
      ) : null}

      {continents.map(({ continent, countries }) => {
        const allContinentCountries = COUNTRIES_BY_CONTINENT[continent];
        const allSelected = allContinentCountries.every((c) => selected.has(c.code));
        const someSelected = allContinentCountries.some((c) => selected.has(c.code));
        const openBySearch = normalizedQuery.length > 0;
        return (
          <details
            key={continent}
            open={someSelected || openBySearch}
            className="rounded-lg border border-zinc-200 bg-white"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-sm font-semibold text-zinc-900">
                {CONTINENT_LABELS[continent]}
                {someSelected ? (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    ({allContinentCountries.filter((c) => selected.has(c.code)).length} selected)
                  </span>
                ) : null}
              </span>
              {!readOnly ? (
                <span className="flex gap-2" onClick={(e) => e.preventDefault()}>
                  <button
                    type="button"
                    className="text-xs font-semibold text-zinc-700 underline"
                    onClick={() => toggleContinent(continent, !allSelected)}
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </span>
              ) : null}
            </summary>
            <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto border-t border-zinc-100 px-3 py-2 sm:grid-cols-2">
              {countries.map((country) => (
                <label
                  key={country.code}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-50",
                    readOnly && "cursor-not-allowed opacity-60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(country.code)}
                    disabled={readOnly}
                    onChange={() => toggle(country.code)}
                    className="rounded border-zinc-300"
                  />
                  <CountryFlag code={country.code} title={country.name} className="h-4 w-6" />
                  <span>{country.name}</span>
                </label>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
