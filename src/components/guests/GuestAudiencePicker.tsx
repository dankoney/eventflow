"use client";

import { GuestStatus } from "@prisma/client";
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/Input";
import { CRM_KIND_OPTIONS, formatCrmKindLabel } from "@/lib/crm/crmKindLabels";
import {
  collectCompanyFilterOptionsFromRows,
  collectDistinctEmailDomains,
  type GuestAudienceRow
} from "@/lib/guests/audienceRows";
import {
  EMPTY_SEGMENT_FILTER,
  SEGMENT_GROUP_UNGROUPED,
  extractEmailDomain,
  guestMatchesSegmentFilter,
  segmentFilterIsActive,
  type GuestSegmentFilterInput
} from "@/lib/guests/segmentFilters";
import { parseZoomAnonRosterName } from "@/lib/zoom/anonRosterName";
import { cn } from "@/lib/utils";

export type GuestAudiencePickerOptions = {
  eventGuestGroups: Array<{ id: string; name: string }>;
  contactCategories: string[];
};

type GuestAudiencePickerProps = {
  guests: GuestAudienceRow[];
  options: GuestAudiencePickerOptions;
  selectable?: boolean;
  selectedIds: Set<string>;
  onSelectedIdsChange: (next: Set<string>) => void;
  segmentFilter: GuestSegmentFilterInput;
  onSegmentFilterChange: (next: GuestSegmentFilterInput) => void;
  listTitle?: string;
  emptyListMessage?: string;
};

function toggleValue<T extends string>(list: T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function toSegmentRow(row: GuestAudienceRow) {
  return {
    tier: row.tier,
    status: row.status,
    hasCheckedIn: row.hasCheckedIn,
    eventGuestGroupId: row.eventGuestGroupId,
    contactCategory: row.contactCategory,
    contactCrmKind: row.contactCrmKind,
    company: row.company,
    email: row.email
  };
}

const GUEST_STATUS_FILTER_OPTIONS: Array<{ value: GuestStatus; label: string }> = [
  { value: GuestStatus.INVITED, label: "Invited" },
  { value: GuestStatus.REGISTERED, label: "Registered" },
  { value: GuestStatus.ACCEPTED, label: "Accepted" },
  { value: GuestStatus.CHECKED_IN, label: "Checked in (status)" },
  { value: GuestStatus.JOINED, label: "Joined (virtual)" },
  { value: GuestStatus.NO_SHOW, label: "No show" },
  { value: GuestStatus.DECLINED, label: "Declined" }
];

const CHECK_IN_FILTER_OPTIONS = [
  { value: "checked_in" as const, label: "Has checked in" },
  { value: "not_checked_in" as const, label: "Not checked in" }
];

function FilterGroup({
  title,
  selectedCount,
  defaultOpen = true,
  children,
  empty
}: {
  title: string;
  selectedCount: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  empty?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (empty) return null;

  return (
    <div className="border-b border-zinc-200/90 last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-xs font-semibold text-zinc-800">{title}</span>
        <span className="flex items-center gap-1.5">
          {selectedCount > 0 ? (
            <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {selectedCount}
            </span>
          ) : null}
          <ChevronDown
            className={cn("h-4 w-4 text-zinc-400 transition", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>
      {open ? <div className="space-y-0.5 pb-3">{children}</div> : null}
    </div>
  );
}

function FilterOption({
  checked,
  label,
  hint,
  onChange
}: {
  checked: boolean;
  label: string;
  hint?: string;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition",
        checked ? "bg-zinc-100" : "hover:bg-zinc-50"
      )}
    >
      <input
        type="checkbox"
        className="rounded border-zinc-300 text-zinc-900"
        checked={checked}
        onChange={onChange}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-zinc-700">{label}</span>
        {hint ? <span className="block text-[10px] text-zinc-400">{hint}</span> : null}
      </span>
    </label>
  );
}

type SearchableFilterItem = {
  key: string;
  label: string;
  hint?: string;
};

function SearchableFilterList({
  items,
  selectedKeys,
  onToggle,
  searchPlaceholder,
  minItemsForSearch = 8
}: {
  items: SearchableFilterItem[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  searchPlaceholder: string;
  minItemsForSearch?: number;
}) {
  const [query, setQuery] = useState("");
  const showSearch = items.length >= minItemsForSearch;

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.key.includes(q) ||
        item.hint?.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="space-y-2">
      {showSearch ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-7 text-xs"
          />
        </div>
      ) : null}
      <div
        className={cn(
          "space-y-0.5",
          showSearch && "max-h-36 overflow-y-auto overscroll-contain pr-0.5"
        )}
      >
        {visibleItems.length === 0 ? (
          <p className="px-2 py-1 text-xs text-zinc-500">No matches.</p>
        ) : (
          visibleItems.map((item) => (
            <FilterOption
              key={item.key}
              label={item.label}
              hint={item.hint}
              checked={selectedKeys.includes(item.key)}
              onChange={() => onToggle(item.key)}
            />
          ))
        )}
      </div>
      {showSearch ? (
        <p className="text-[10px] text-zinc-400">
          {visibleItems.length} of {items.length} shown
        </p>
      ) : null}
    </div>
  );
}

export function GuestAudiencePicker({
  guests,
  options,
  selectable = true,
  selectedIds,
  onSelectedIdsChange,
  segmentFilter,
  onSegmentFilterChange,
  listTitle = "Guests",
  emptyListMessage = "No guests match the current filters."
}: GuestAudiencePickerProps) {
  const [listSearch, setListSearch] = useState("");
  const skipSelectionSync = useRef(false);

  const companyOptions = useMemo(() => collectCompanyFilterOptionsFromRows(guests), [guests]);
  const emailDomainOptions = useMemo(() => collectDistinctEmailDomains(guests), [guests]);

  const emailDomainFilterItems = useMemo(
    () => emailDomainOptions.map((domain) => ({ key: domain, label: `@${domain}` })),
    [emailDomainOptions]
  );

  const categoryFilterItems = useMemo(
    () => options.contactCategories.map((cat) => ({ key: cat, label: cat })),
    [options.contactCategories]
  );

  const groupFilterItems = useMemo(
    () => [
      { key: SEGMENT_GROUP_UNGROUPED, label: "Ungrouped" },
      ...options.eventGuestGroups.map((g) => ({ key: g.id, label: g.name }))
    ],
    [options.eventGuestGroups]
  );

  const matchingGuests = useMemo(() => {
    return guests.filter((g) => guestMatchesSegmentFilter(toSegmentRow(g), segmentFilter));
  }, [guests, segmentFilter]);

  const visibleGuests = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return matchingGuests;
    return matchingGuests.filter((g) => {
      const { displayName } = parseZoomAnonRosterName(g.name, g.email);
      const hay = [
        displayName,
        g.name,
        g.email ?? "",
        extractEmailDomain(g.email) ?? "",
        g.company ?? "",
        g.contactCategory ?? "",
        formatCrmKindLabel(g.contactCrmKind) ?? "",
        g.eventGuestGroupName ?? ""
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [matchingGuests, listSearch]);

  useEffect(() => {
    if (!selectable || skipSelectionSync.current) return;
    onSelectedIdsChange(new Set(matchingGuests.map((g) => g.id)));
  }, [matchingGuests, selectable, onSelectedIdsChange]);

  const allVisibleSelected =
    visibleGuests.length > 0 && visibleGuests.every((g) => selectedIds.has(g.id));
  const someVisibleSelected = visibleGuests.some((g) => selectedIds.has(g.id));

  function toggleGuest(id: string) {
    if (!selectable) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange(next);
  }

  function selectAllVisible() {
    const next = new Set(selectedIds);
    for (const g of visibleGuests) next.add(g.id);
    onSelectedIdsChange(next);
  }

  function clearVisible() {
    const next = new Set(selectedIds);
    for (const g of visibleGuests) next.delete(g.id);
    onSelectedIdsChange(next);
  }

  function clearFilters() {
    skipSelectionSync.current = true;
    onSegmentFilterChange(EMPTY_SEGMENT_FILTER);
    onSelectedIdsChange(new Set(guests.map((g) => g.id)));
    queueMicrotask(() => {
      skipSelectionSync.current = false;
    });
  }

  const selectedCount = selectable
    ? guests.filter((g) => selectedIds.has(g.id)).length
    : matchingGuests.length;

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] overflow-hidden rounded-xl border border-zinc-200 bg-white sm:flex sm:flex-row">
      <aside className="flex min-h-0 flex-col border-b border-zinc-200 sm:w-72 sm:shrink-0 sm:border-b-0 sm:border-r">
        <div className="shrink-0 border-b border-zinc-200 bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Match mode</p>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            {(["include", "exclude"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition",
                  segmentFilter.mode === mode
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-white"
                )}
                onClick={() => onSegmentFilterChange({ ...segmentFilter, mode })}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            {segmentFilter.mode === "include"
              ? "Only guests matching the filters below are included."
              : "Guests matching the filters below are removed."}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Filters</p>
            {segmentFilterIsActive(segmentFilter) ? (
              <button
                type="button"
                className="text-[11px] font-medium text-zinc-600 underline-offset-2 hover:underline"
                onClick={clearFilters}
              >
                Reset
              </button>
            ) : null}
          </div>

          <FilterGroup
            title="Registration status"
            selectedCount={segmentFilter.statuses?.length ?? 0}
            defaultOpen
          >
            {GUEST_STATUS_FILTER_OPTIONS.map(({ value, label }) => (
              <FilterOption
                key={value}
                label={label}
                checked={(segmentFilter.statuses ?? []).includes(value)}
                onChange={() =>
                  onSegmentFilterChange({
                    ...segmentFilter,
                    statuses: toggleValue(segmentFilter.statuses, value)
                  })
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup
            title="Check-in"
            selectedCount={segmentFilter.checkInPresence?.length ?? 0}
            defaultOpen
          >
            {CHECK_IN_FILTER_OPTIONS.map(({ value, label }) => (
              <FilterOption
                key={value}
                label={label}
                checked={(segmentFilter.checkInPresence ?? []).includes(value)}
                onChange={() =>
                  onSegmentFilterChange({
                    ...segmentFilter,
                    checkInPresence: toggleValue(segmentFilter.checkInPresence, value)
                  })
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup
            title="CRM type"
            selectedCount={segmentFilter.crmKinds?.length ?? 0}
            defaultOpen
          >
            {CRM_KIND_OPTIONS.map(({ value, label }) => (
              <FilterOption
                key={value}
                label={label}
                checked={(segmentFilter.crmKinds ?? []).includes(value)}
                onChange={() =>
                  onSegmentFilterChange({
                    ...segmentFilter,
                    crmKinds: toggleValue(segmentFilter.crmKinds, value)
                  })
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup
            title="Company"
            selectedCount={segmentFilter.companies?.length ?? 0}
            empty={companyOptions.length === 0}
            defaultOpen={companyOptions.length <= 12}
          >
            <SearchableFilterList
              items={companyOptions.map((o) => ({
                key: o.key,
                label: o.label,
                hint: `${o.count} guest${o.count === 1 ? "" : "s"}`
              }))}
              selectedKeys={segmentFilter.companies ?? []}
              onToggle={(key) =>
                onSegmentFilterChange({
                  ...segmentFilter,
                  companies: toggleValue(segmentFilter.companies, key)
                })
              }
              searchPlaceholder="Search companies…"
            />
          </FilterGroup>

          <FilterGroup
            title="Email domain"
            selectedCount={segmentFilter.emailDomains?.length ?? 0}
            empty={emailDomainFilterItems.length === 0}
            defaultOpen={false}
          >
            <SearchableFilterList
              items={emailDomainFilterItems}
              selectedKeys={segmentFilter.emailDomains ?? []}
              onToggle={(key) =>
                onSegmentFilterChange({
                  ...segmentFilter,
                  emailDomains: toggleValue(segmentFilter.emailDomains, key)
                })
              }
              searchPlaceholder="Search domains…"
            />
          </FilterGroup>

          <FilterGroup
            title="CRM category"
            selectedCount={segmentFilter.contactCategories?.length ?? 0}
            empty={categoryFilterItems.length === 0}
            defaultOpen={false}
          >
            <SearchableFilterList
              items={categoryFilterItems}
              selectedKeys={segmentFilter.contactCategories ?? []}
              onToggle={(key) =>
                onSegmentFilterChange({
                  ...segmentFilter,
                  contactCategories: toggleValue(segmentFilter.contactCategories, key)
                })
              }
              searchPlaceholder="Search categories…"
              minItemsForSearch={10}
            />
          </FilterGroup>

          <FilterGroup
            title="Event group"
            selectedCount={segmentFilter.groupIds?.length ?? 0}
            empty={groupFilterItems.length === 0}
            defaultOpen={false}
          >
            <SearchableFilterList
              items={groupFilterItems}
              selectedKeys={segmentFilter.groupIds ?? []}
              onToggle={(key) =>
                onSegmentFilterChange({
                  ...segmentFilter,
                  groupIds: toggleValue(segmentFilter.groupIds, key)
                })
              }
              searchPlaceholder="Search groups…"
              minItemsForSearch={10}
            />
          </FilterGroup>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900">{listTitle}</p>
              <p className="text-xs text-zinc-500">
                {selectable
                  ? `${selectedCount} selected · ${matchingGuests.length} matching`
                  : `${matchingGuests.length} matching`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectable ? (
                <>
                  <button
                    type="button"
                    className="text-xs font-medium text-zinc-700 hover:text-zinc-900"
                    onClick={selectAllVisible}
                    disabled={visibleGuests.length === 0}
                  >
                    Select visible
                  </button>
                  <span className="text-zinc-300">|</span>
                  <button
                    type="button"
                    className="text-xs font-medium text-zinc-700 hover:text-zinc-900"
                    onClick={clearVisible}
                    disabled={!someVisibleSelected}
                  >
                    Clear visible
                  </button>
                </>
              ) : null}
              <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Search list…"
                  className="h-9 pl-8 text-sm"
                />
              </div>
            </div>
          </div>

          {selectable && visibleGuests.length > 0 ? (
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-500">
              <input
                type="checkbox"
                className="rounded border-zinc-300"
                checked={allVisibleSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                }}
                onChange={() => (allVisibleSelected ? clearVisible() : selectAllVisible())}
              />
              Select all visible ({visibleGuests.length})
            </label>
          ) : null}
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {visibleGuests.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-500">{emptyListMessage}</li>
          ) : (
            visibleGuests.map((guest) => {
              const { displayName } = parseZoomAnonRosterName(guest.name, guest.email);
              const checked = selectable ? selectedIds.has(guest.id) : true;
              const typeLabel = formatCrmKindLabel(guest.contactCrmKind);

              return (
                <li key={guest.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 border-b border-zinc-100 px-4 py-3 transition hover:bg-zinc-50",
                      selectable && checked && "bg-indigo-50/40"
                    )}
                  >
                    {selectable ? (
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-zinc-300"
                        checked={checked}
                        onChange={() => toggleGuest(guest.id)}
                      />
                    ) : (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zinc-300" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-medium text-zinc-900">{displayName}</span>
                        {typeLabel ? (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                            {typeLabel}
                          </span>
                        ) : null}
                        {guest.eventGuestGroupName ? (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                            {guest.eventGuestGroupName}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        {[guest.email, guest.company, guest.contactCategory]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

export function feedbackEligibleToAudienceRow(
  guest: import("@/lib/db/eventFeedback").FeedbackBlastEligibleGuest
): GuestAudienceRow {
  return {
    id: guest.id,
    name: guest.name,
    email: guest.email,
    company: guest.company,
    tier: "A",
    status: "CHECKED_IN",
    hasCheckedIn: true,
    contactCrmKind: guest.contactCrmKind,
    contactCategory: guest.contactCategory,
    eventGuestGroupId: guest.eventGuestGroupId,
    eventGuestGroupName: guest.eventGuestGroupName
  };
}
