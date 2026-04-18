"use client";

import { AttendMode, GuestStatus, Tier } from "@prisma/client";
import { Download, ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { GuestStatusBadge } from "@/components/guests/GuestStatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { rowsToCsv } from "@/lib/csv";
import { cn, formatDate } from "@/lib/utils";
import type { GuestStatus as GuestStatusT } from "@/types";

export type GuestHubRowClient = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  tier: string;
  mode: string;
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

export function GuestsHubPanel({ guests, eventOptions, atCap }: GuestsHubPanelProps) {
  const [search, setSearch] = useState("");
  const [eventIdFilter, setEventIdFilter] = useState<string>("ALL");
  const [modeFilter, setModeFilter] = useState<"ALL" | AttendMode>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | GuestStatus>("ALL");
  const [tierFilter, setTierFilter] = useState<"ALL" | Tier>("ALL");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (eventIdFilter !== "ALL" && g.eventId !== eventIdFilter) return false;
      if (modeFilter !== "ALL" && g.mode !== modeFilter) return false;
      if (statusFilter !== "ALL" && g.status !== statusFilter) return false;
      if (tierFilter !== "ALL" && g.tier !== tierFilter) return false;
      if (!q) return true;
      const hay = [g.name, g.email, g.company ?? "", g.eventName].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [guests, search, eventIdFilter, modeFilter, statusFilter, tierFilter]);

  function exportCsv() {
    const headers = ["Name", "Email", "Company", "Event", "Event date", "Tier", "Mode", "Status", "Rep"];
    const rows = filtered.map((g) => [
      g.name,
      g.email,
      g.company ?? "",
      g.eventName,
      formatDate(g.eventDate),
      g.tier,
      g.mode === AttendMode.VIRTUAL ? "Virtual" : "In person",
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
    <div className="space-y-4">
      {atCap ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Showing the most recent {guests.length.toLocaleString()} guests (cap). Open a specific event for full lists
          if needed.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search name, email, company, event…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
        >
          <option value="ALL">Mode: All</option>
          <option value={AttendMode.IN_PERSON}>In person</option>
          <option value={AttendMode.VIRTUAL}>Virtual</option>
        </select>
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="ALL">Status: All</option>
          <option value={GuestStatus.INVITED}>Invited</option>
          <option value={GuestStatus.REGISTERED}>Registered</option>
          <option value={GuestStatus.CHECKED_IN}>Checked in</option>
          <option value={GuestStatus.JOINED}>Joined</option>
          <option value={GuestStatus.NO_SHOW}>No show</option>
        </select>
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}
        >
          <option value="ALL">Tier: All</option>
          <option value={Tier.A}>A</option>
          <option value={Tier.B}>B</option>
          <option value={Tier.C}>C</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="mr-2 inline h-4 w-4" />
          Export CSV ({filtered.length})
        </Button>
      </div>

      <Table headers={["Guest", "Company", "Event", "When", "Tier", "Mode", "Status", "Rep", ""]}>
        {filtered.map((g) => (
          <tr key={g.id} className="border-t border-slate-100">
            <td className="px-4 py-2">
              <div className="font-medium text-slate-900">{g.name}</div>
              <div className="text-xs text-slate-500">{g.email}</div>
            </td>
            <td className="px-4 py-2 text-sm text-slate-700">{g.company ?? "—"}</td>
            <td className="px-4 py-2 text-sm text-slate-800">{g.eventName}</td>
            <td className="px-4 py-2 text-xs text-slate-600">{formatDate(g.eventDate)}</td>
            <td className="px-4 py-2">{g.tier}</td>
            <td className="px-4 py-2 text-sm">{g.mode === AttendMode.VIRTUAL ? "Virtual" : "In person"}</td>
            <td className="px-4 py-2">
              <GuestStatusBadge status={g.status as GuestStatusT} />
            </td>
            <td className="px-4 py-2 text-sm text-slate-600">{g.repName ?? g.repEmail ?? "—"}</td>
            <td className="px-4 py-2">
              <Link
                href={`/events/${g.eventId}/guests`}
                className={cn("inline-flex items-center gap-1 text-sm text-sky-700 hover:underline")}
              >
                Manage
                <ExternalLink className="h-3 w-3" />
              </Link>
            </td>
          </tr>
        ))}
      </Table>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-500">No guests match your filters.</p>
      ) : null}
    </div>
  );
}
