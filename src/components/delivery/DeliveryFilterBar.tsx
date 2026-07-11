"use client";

import { SlidersHorizontal, X } from "lucide-react";

import { DATA_QUALITY_TAG_META } from "@/lib/delivery/dataQuality";
import {
  countActiveCleanupFilters,
  countActiveLogFilters,
  DEFAULT_CLEANUP_FILTERS,
  DEFAULT_LOG_FILTERS,
  type CleanupFilterState,
  type DeliveryLogFilterState
} from "@/lib/delivery/tableFilters";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 shadow-sm";

type DeliveryLogFilterBarProps = {
  filters: DeliveryLogFilterState;
  onChange: (next: DeliveryLogFilterState) => void;
  kindOptions: Array<{ value: string; label: string }>;
  eventOptions?: Array<{ value: string; label: string }>;
  resultCount: number;
  totalCount: number;
};

export function DeliveryLogFilterBar({
  filters,
  onChange,
  kindOptions,
  eventOptions,
  resultCount,
  totalCount
}: DeliveryLogFilterBarProps) {
  const active = countActiveLogFilters(filters);

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <SlidersHorizontal className="h-4 w-4 text-zinc-500" aria-hidden />
          Filters
          {active > 0 ? (
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white">
              {active}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-zinc-500">
          Showing {resultCount} of {totalCount}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status: status as DeliveryLogFilterState["status"] })}
          options={[
            ["ALL", "All statuses"],
            ["SENT", "Sent"],
            ["FAILED", "Failed"],
            ["SKIPPED", "Skipped"]
          ]}
        />
        <FilterSelect
          label="Channel"
          value={filters.channel}
          onChange={(channel) =>
            onChange({ ...filters, channel: channel as DeliveryLogFilterState["channel"] })
          }
          options={[
            ["ALL", "All channels"],
            ["EMAIL", "Email"],
            ["SMS", "SMS"]
          ]}
        />
        <FilterSelect
          label="Type"
          value={filters.kind}
          onChange={(kind) => onChange({ ...filters, kind })}
          options={[["ALL", "All types"], ...kindOptions.map((k) => [k.value, k.label] as const)]}
        />
        {eventOptions && eventOptions.length > 0 ? (
          <FilterSelect
            label="Event"
            value={filters.eventId}
            onChange={(eventId) => onChange({ ...filters, eventId })}
            options={[["ALL", "All events"], ...eventOptions.map((e) => [e.value, e.label] as const)]}
          />
        ) : null}
        <FilterSelect
          label="Source"
          value={filters.source}
          onChange={(source) =>
            onChange({ ...filters, source: source as DeliveryLogFilterState["source"] })
          }
          options={[
            ["ALL", "All sources"],
            ["system", "System"],
            ["custom", "Custom message"]
          ]}
        />
        <FilterSelect
          label="Sort"
          value={filters.sort}
          onChange={(sort) => onChange({ ...filters, sort: sort as DeliveryLogFilterState["sort"] })}
          options={[
            ["newest", "Newest first"],
            ["oldest", "Oldest first"],
            ["issues_first", "Issues first"],
            ["guest_asc", "Guest A–Z"],
            ["guest_desc", "Guest Z–A"]
          ]}
        />
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm shadow-sm">
          <input
            type="checkbox"
            className="rounded border-zinc-300"
            checked={filters.issuesOnly}
            onChange={(e) => onChange({ ...filters, issuesOnly: e.target.checked })}
          />
          <span className="text-zinc-700">Issues only</span>
        </label>
        {active > 0 ? (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_LOG_FILTERS)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-600 shadow-sm hover:bg-zinc-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

type DeliveryCleanupFilterBarProps = {
  filters: CleanupFilterState;
  onChange: (next: CleanupFilterState) => void;
  resultCount: number;
  totalCount: number;
};

export function DeliveryCleanupFilterBar({
  filters,
  onChange,
  resultCount,
  totalCount
}: DeliveryCleanupFilterBarProps) {
  const active = countActiveCleanupFilters(filters);
  const tagOptions = Object.entries(DATA_QUALITY_TAG_META).map(([id, meta]) => [
    id,
    meta.label
  ] as const);

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <SlidersHorizontal className="h-4 w-4 text-zinc-500" aria-hidden />
          Filters
          {active > 0 ? (
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white">
              {active}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-zinc-500">
          Showing {resultCount} of {totalCount}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <FilterSelect
          label="Alert"
          value={filters.tag}
          onChange={(tag) => onChange({ ...filters, tag: tag as CleanupFilterState["tag"] })}
          options={[["ALL", "All alerts"], ...tagOptions]}
        />
        <FilterSelect
          label="Severity"
          value={filters.severity}
          onChange={(severity) =>
            onChange({ ...filters, severity: severity as CleanupFilterState["severity"] })
          }
          options={[
            ["ALL", "All severities"],
            ["critical", "Critical"],
            ["error", "Error"],
            ["warning", "Warning"],
            ["info", "Info"]
          ]}
        />
        <FilterSelect
          label="Failures"
          value={filters.failures}
          onChange={(failures) =>
            onChange({ ...filters, failures: failures as CleanupFilterState["failures"] })
          }
          options={[
            ["ALL", "All guests"],
            ["with_failures", "With delivery failures"],
            ["contact_only", "Contact data only"]
          ]}
        />
        <FilterSelect
          label="Sort"
          value={filters.sort}
          onChange={(sort) => onChange({ ...filters, sort: sort as CleanupFilterState["sort"] })}
          options={[
            ["severity", "Severity (highest first)"],
            ["failures_desc", "Most failures"],
            ["guest_asc", "Guest A–Z"],
            ["guest_desc", "Guest Z–A"]
          ]}
        />
        {active > 0 ? (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_CLEANUP_FILTERS)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-600 shadow-sm hover:bg-zinc-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <label
      className={cn(
        "inline-flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
      )}
    >
      {label}
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
