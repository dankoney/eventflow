"use client";

import Link from "next/link";
import { EventStatus, EventType } from "@prisma/client";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EventCard } from "@/components/events/EventCard";
import type { EventListItem, EventsListTabId } from "@/lib/db/events";
import { cn, coerceDate } from "@/lib/utils";

const VIEW_STORAGE_KEY = "eventflow-events-catalog-view";

const TAB_CONFIG: { id: EventsListTabId; label: string }[] = [
  { id: "ongoing", label: "Ongoing" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" }
];

const filterSelect =
  "h-10 min-w-[140px] rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm outline-none ring-zinc-900/10 transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15";

type EventsCatalogProps = {
  activeTab: EventsListTabId;
  counts: Record<EventsListTabId, number>;
  activeList: EventListItem[];
  canCreate: boolean;
  title: string;
  subtitle: string;
};

export function EventsCatalog({
  activeTab,
  counts,
  activeList,
  canCreate,
  title,
  subtitle
}: EventsCatalogProps) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<EventType | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<"date_desc" | "date_asc" | "name_asc">("date_desc");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "grid" || stored === "list") setView(stored);
    } catch {
      /* ignore */
    }
  }, []);

  function setViewAndPersist(next: "grid" | "list") {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const filtered = useMemo(() => {
    const rows = activeList.filter((e) => {
      if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && e.type !== typeFilter) return false;
      return true;
    });
    const copy = [...rows];
    if (sortKey === "date_desc") copy.sort((a, b) => coerceDate(b.date).getTime() - coerceDate(a.date).getTime());
    else if (sortKey === "date_asc") copy.sort((a, b) => coerceDate(a.date).getTime() - coerceDate(b.date).getTime());
    else copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return copy;
  }, [activeList, statusFilter, typeFilter, sortKey]);

  const tabLabel = TAB_CONFIG.find((t) => t.id === activeTab)?.label ?? activeTab;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-zinc-900/[0.04]">
      <div className="border-b border-zinc-200/80 bg-gradient-to-br from-zinc-50 via-white to-zinc-100/70 px-5 py-6 sm:px-8 sm:py-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Events workspace</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">{subtitle}</p>
          </div>
          {canCreate ? (
            <Link
              href="/events/new"
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                "bg-zinc-900 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              )}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create new event
            </Link>
          ) : null}
        </div>
      </div>

      <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        <nav
          className="inline-flex flex-wrap gap-1 rounded-xl border border-zinc-200/90 bg-zinc-100/90 p-1 shadow-inner"
          aria-label="Filter events by phase"
        >
          {TAB_CONFIG.map(({ id, label }) => {
            const count = counts[id];
            const isActive = activeTab === id;
            return (
              <Link
                key={id}
                href={`/events?tab=${id}`}
                scroll={false}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                  isActive
                    ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80"
                    : "text-zinc-600 hover:bg-white/60 hover:text-zinc-900"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                    isActive ? "bg-zinc-900 text-white" : "bg-zinc-200/80 text-zinc-600"
                  )}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-3 shadow-inner sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="events-filter-status">
              Status
            </label>
            <select
              id="events-filter-status"
              className={filterSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EventStatus | "ALL")}
            >
              <option value="ALL">All statuses</option>
              {Object.values(EventStatus).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="events-filter-type">
              Event type
            </label>
            <select
              id="events-filter-type"
              className={filterSelect}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EventType | "ALL")}
            >
              <option value="ALL">All types</option>
              <option value={EventType.IN_PERSON}>In person</option>
              <option value={EventType.VIRTUAL}>Virtual only</option>
              <option value={EventType.HYBRID}>Hybrid</option>
            </select>
            <label className="sr-only" htmlFor="events-sort">
              Sort by
            </label>
            <select
              id="events-sort"
              className={filterSelect}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            >
              <option value="date_desc">Date · Newest</option>
              <option value="date_asc">Date · Oldest</option>
              <option value="name_asc">Name · A–Z</option>
            </select>
          </div>

          <div
            className="inline-flex shrink-0 rounded-xl border border-zinc-200 bg-white/90 p-1 shadow-sm"
            role="group"
            aria-label="Layout"
          >
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-lg px-3 py-2 transition",
                view === "grid"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              )}
              aria-pressed={view === "grid"}
              onClick={() => setViewAndPersist("grid")}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              <span className="sr-only">Grid view</span>
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-lg px-3 py-2 transition",
                view === "list"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              )}
              aria-pressed={view === "list"}
              onClick={() => setViewAndPersist("list")}
            >
              <List className="h-4 w-4" aria-hidden />
              <span className="sr-only">List view</span>
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-14 text-center">
            <p className="text-sm text-zinc-600">
              {activeList.length === 0 ? (
                <>
                  No events in <span className="font-semibold text-zinc-800">{tabLabel}</span>.
                </>
              ) : (
                <>No events match your filters in {tabLabel}. Try clearing filters.</>
              )}
            </p>
            {activeList.length > 0 && filtered.length === 0 ? (
              <button
                type="button"
                className="mt-4 text-sm font-semibold text-zinc-800 underline decoration-zinc-400 underline-offset-2 hover:text-zinc-950"
                onClick={() => {
                  setStatusFilter("ALL");
                  setTypeFilter("ALL");
                }}
              >
                Reset filters
              </button>
            ) : null}
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                layout="grid"
                variant={activeTab === "past" ? "past" : "default"}
                canManage={canCreate}
              />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((event) => (
              <li key={event.id}>
                <EventCard
                  event={event}
                  layout="list"
                  variant={activeTab === "past" ? "past" : "default"}
                  canManage={canCreate}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
