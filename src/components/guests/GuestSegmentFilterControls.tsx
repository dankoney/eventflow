"use client";

import { Tier } from "@prisma/client";

import {
  EMPTY_SEGMENT_FILTER,
  SEGMENT_GROUP_UNGROUPED,
  type GuestSegmentFilterInput,
  type SegmentFilterMode
} from "@/lib/guests/segmentFilters";
import { cn } from "@/lib/utils";

export type GuestSegmentFilterOptions = {
  tiers: Tier[];
  groups: Array<{ id: string; name: string }>;
  contactCategories: string[];
};

type GuestSegmentFilterControlsProps = {
  value: GuestSegmentFilterInput;
  onChange: (next: GuestSegmentFilterInput) => void;
  options: GuestSegmentFilterOptions;
  className?: string;
  compact?: boolean;
};

function toggleValue<T extends string>(list: T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function GuestSegmentFilterControls({
  value,
  onChange,
  options,
  className,
  compact = false
}: GuestSegmentFilterControlsProps) {
  const labelClass = compact
    ? "text-[10px] font-bold uppercase tracking-wide text-zinc-500"
    : "text-xs font-semibold uppercase tracking-wide text-zinc-600";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={labelClass}>Filter mode</span>
        {(["include", "exclude"] as SegmentFilterMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium capitalize",
              value.mode === mode
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            )}
            onClick={() => onChange({ ...value, mode })}
          >
            {mode}
          </button>
        ))}
      </div>

      <div>
        <p className={labelClass}>Guest category (tier)</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {options.tiers.map((tier) => (
            <label key={tier} className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
              <input
                type="checkbox"
                className="rounded border-zinc-300"
                checked={(value.tiers ?? []).includes(tier)}
                onChange={() => onChange({ ...value, tiers: toggleValue(value.tiers, tier) })}
              />
              {tier}
            </label>
          ))}
        </div>
      </div>

      {options.groups.length > 0 ? (
        <div>
          <p className={labelClass}>Group</p>
          <div className="mt-1.5 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            <label className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
              <input
                type="checkbox"
                className="rounded border-zinc-300"
                checked={(value.groupIds ?? []).includes(SEGMENT_GROUP_UNGROUPED)}
                onChange={() =>
                  onChange({
                    ...value,
                    groupIds: toggleValue(value.groupIds, SEGMENT_GROUP_UNGROUPED)
                  })
                }
              />
              Ungrouped
            </label>
            {options.groups.map((g) => (
              <label key={g.id} className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  className="rounded border-zinc-300"
                  checked={(value.groupIds ?? []).includes(g.id)}
                  onChange={() => onChange({ ...value, groupIds: toggleValue(value.groupIds, g.id) })}
                />
                {g.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {options.contactCategories.length > 0 ? (
        <div>
          <p className={labelClass}>CRM category</p>
          <div className="mt-1.5 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {options.contactCategories.map((cat) => (
              <label key={cat} className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  className="rounded border-zinc-300"
                  checked={(value.contactCategories ?? []).includes(cat)}
                  onChange={() =>
                    onChange({
                      ...value,
                      contactCategories: toggleValue(value.contactCategories, cat)
                    })
                  }
                />
                {cat}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline"
        onClick={() => onChange(EMPTY_SEGMENT_FILTER)}
      >
        Clear segment filters
      </button>
    </div>
  );
}
