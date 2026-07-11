"use client";

import { AttendMode, GuestStatus, Tier } from "@prisma/client";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  LayoutGrid,
  List,
  Search
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { GuestStatusBadge } from "@/components/guests/GuestStatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { rowsToCsv } from "@/lib/csv";
import { parseZoomAnonRosterName } from "@/lib/zoom/anonRosterName";
import { cn, formatDate } from "@/lib/utils";
import type { GuestStatus as GuestStatusT } from "@/types";

export type GuestHubRowClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  tier: string;
  mode: string | null;
  status: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  repName: string | null;
  repEmail: string | null;
};

export type EventFilterOptionClient = { id: string; name: string; date: string };

type GuestsHubPanelProps = {
  guests: GuestHubRowClient[];
  eventOptions: EventFilterOptionClient[];
  atCap: boolean;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const filterSelect =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 outline-none ring-zinc-900/10 transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15";

const HUB_MODE_FILTER_UNSET = "__UNSET__" as const;

function hubModeLabel(mode: string | null) {
  if (mode == null) return "Undecided";
  return mode === AttendMode.VIRTUAL ? "Virtual" : "In person";
}

export function GuestsHubPanel({ guests, eventOptions, atCap }: GuestsHubPanelProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [eventIdFilter, setEventIdFilter] = useState<string>("ALL");
  const [modeFilter, setModeFilter] = useState<"ALL" | AttendMode | typeof HUB_MODE_FILTER_UNSET>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | GuestStatus>("ALL");
  const [tierFilter, setTierFilter] = useState<"ALL" | Tier>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(50);
  const [view, setView] = useState<"table" | "grid">("table");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (eventIdFilter !== "ALL" && g.eventId !== eventIdFilter) return false;
      if (modeFilter === HUB_MODE_FILTER_UNSET) {
        if (g.mode != null) return false;
      } else if (modeFilter !== "ALL" && g.mode !== modeFilter) {
        return false;
      }
      if (statusFilter !== "ALL" && g.status !== statusFilter) return false;
      if (tierFilter !== "ALL" && g.tier !== tierFilter) return false;
      if (!q) return true;
      const { displayName } = parseZoomAnonRosterName(g.name, g.email);
      const hay = [displayName, g.name, g.email, g.phone ?? "", g.company ?? "", g.eventName]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [guests, search, eventIdFilter, modeFilter, statusFilter, tierFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, eventIdFilter, modeFilter, statusFilter, tierFilter, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

  function exportCsv() {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Company",
      "Event",
      "Event date",
      "Tier",
      "Mode",
      "Status",
      "Rep"
    ];
    const rows = filtered.map((g) => [
      parseZoomAnonRosterName(g.name, g.email).displayName,
      g.email ?? "",
      g.phone ?? "",
      g.company ?? "",
      g.eventName,
      formatDate(g.eventDate),
      g.tier,
      hubModeLabel(g.mode),
      g.status,
      g.repName ?? g.repEmail ?? ""
    ]);
    const csv = "\uFEFF" + rowsToCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "guests-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {atCap ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Showing the most recent {guests.length.toLocaleString()} guests (cap). Open a specific event for full lists
          if needed.
        </p>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Filters</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              className="rounded-lg border-zinc-300 pl-9 focus:border-zinc-900 focus:ring-zinc-900/15"
              placeholder="Search name, email, phone, company, event…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className={cn(filterSelect, "min-w-[10rem]")}
              value={eventIdFilter}
              onChange={(e) => setEventIdFilter(e.target.value)}
            >
              <option value="ALL">All events</option>
              {eventOptions.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
            <select
              className={filterSelect}
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
            >
              <option value="ALL">Mode: All</option>
              <option value={HUB_MODE_FILTER_UNSET}>Undecided</option>
              <option value={AttendMode.IN_PERSON}>In person</option>
              <option value={AttendMode.VIRTUAL}>Virtual</option>
            </select>
            <select
              className={filterSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="ALL">Status: All</option>
              <option value={GuestStatus.INVITED}>Invited</option>
              <option value={GuestStatus.REGISTERED}>Registered</option>
              <option value={GuestStatus.ACCEPTED}>Accepted</option>
              <option value={GuestStatus.CHECKED_IN}>Checked in</option>
              <option value={GuestStatus.JOINED}>Joined</option>
              <option value={GuestStatus.NO_SHOW}>No show</option>
              <option value={GuestStatus.DECLINED}>Declined</option>
            </select>
            <select
              className={filterSelect}
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}
            >
              <option value="ALL">Tier: All</option>
              <option value={Tier.A}>A</option>
              <option value={Tier.B}>B</option>
              <option value={Tier.C}>C</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="text-sm text-zinc-600">
            {total > 0 ? (
              <>
                Showing <span className="font-semibold text-zinc-900">{rangeStart}</span>–
                <span className="font-semibold text-zinc-900">{rangeEnd}</span> of{" "}
                <span className="font-semibold text-zinc-900">{total.toLocaleString()}</span>
              </>
            ) : (
              "No matching guests"
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Per page</span>
            <select
              className={cn(filterSelect, "h-9 min-w-[5.5rem] py-0 text-xs")}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5" role="group" aria-label="Layout">
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition",
                view === "table" ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200" : "text-zinc-600 hover:text-zinc-900"
              )}
              aria-pressed={view === "table"}
            >
              <List className="h-3.5 w-3.5" aria-hidden />
              Table
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition",
                view === "grid" ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200" : "text-zinc-600 hover:text-zinc-900"
              )}
              aria-pressed={view === "grid"}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              Grid
            </button>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="border-zinc-200 font-semibold"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="mr-2 inline h-4 w-4" />
            Export CSV ({filtered.length})
          </Button>
        </div>
      </div>

      {view === "table" ? (
        <Table
          variant="workspace"
          headers={["Name", "Email", "Phone", "Company", "Event", "When", "Mode", "Tier", "Status", "Rep", "Actions"]}
        >
          {pageRows.map((g) => (
            <tr
              key={g.id}
              className={cn("cursor-pointer transition-colors hover:bg-zinc-50/90")}
              onClick={() => router.push(`/events/${g.eventId}/guests`)}
            >
              <td className="px-4 py-3 font-semibold text-zinc-900">
                {parseZoomAnonRosterName(g.name, g.email).displayName}
              </td>
              <td className="px-4 py-3 text-sm text-zinc-700">{g.email}</td>
              <td className="px-4 py-3 text-sm text-zinc-700">{g.phone ?? "—"}</td>
              <td className="px-4 py-3 text-sm text-zinc-700">{g.company ?? "—"}</td>
              <td className="px-4 py-3 text-sm font-medium text-zinc-800">{g.eventName}</td>
              <td className="px-4 py-3 text-xs text-zinc-600">{formatDate(g.eventDate)}</td>
              <td className="px-4 py-3 text-sm text-zinc-800">
                {hubModeLabel(g.mode)}
              </td>
              <td className="px-4 py-3 font-medium text-zinc-800">{g.tier}</td>
              <td className="px-4 py-3">
                <GuestStatusBadge status={g.status as GuestStatusT} />
              </td>
              <td className="px-4 py-3 text-sm text-zinc-700">{g.repName ?? g.repEmail ?? "—"}</td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <Link
                  href={`/events/${g.eventId}/guests`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-100"
                  )}
                >
                  Manage
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pageRows.map((g) => (
            <div
              key={g.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/events/${g.eventId}/guests`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/events/${g.eventId}/guests`);
                }
              }}
              className="cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm outline-none transition hover:border-zinc-300 hover:bg-zinc-50/80 focus-visible:ring-2 focus-visible:ring-zinc-900/20"
            >
              <p className="font-semibold text-zinc-900">
                {parseZoomAnonRosterName(g.name, g.email).displayName}
              </p>
              <p className="mt-1 truncate text-sm text-zinc-600">{g.email}</p>
              <p className="mt-2 text-xs font-medium text-zinc-500">{g.eventName}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{formatDate(g.eventDate)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <GuestStatusBadge status={g.status as GuestStatusT} />
                <span className="text-xs text-zinc-600">
                  {hubModeLabel(g.mode)} · Tier {g.tier}
                </span>
              </div>
              <div className="mt-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <Link
                  href={`/events/${g.eventId}/guests`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-white"
                >
                  Manage
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 0 && totalPages > 1 ? (
        <div className="flex flex-col items-stretch justify-between gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center">
          <p className="text-sm text-zinc-600">
            Page <span className="font-semibold text-zinc-900">{page}</span> of{" "}
            <span className="font-semibold text-zinc-900">{totalPages}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="border-zinc-200 font-medium"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="mr-1 inline h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="border-zinc-200 font-medium"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="ml-1 inline h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-8 text-center text-sm text-zinc-600">
          No guests match your filters.
        </p>
      ) : null}
    </div>
  );
}
