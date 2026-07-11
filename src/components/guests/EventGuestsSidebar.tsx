"use client";

import { GuestStatus } from "@prisma/client";
import { Pencil, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

import { EventGuestGroupsPanel } from "@/components/guests/EventGuestGroupsPanel";
import type { EventGuestGroupRow } from "@/lib/db/eventGuestGroups";

const STATUS_LABELS: Record<GuestStatus, string> = {
  [GuestStatus.INVITED]: "Invited",
  [GuestStatus.REGISTERED]: "Registered",
  [GuestStatus.ACCEPTED]: "Accepted",
  [GuestStatus.CHECKED_IN]: "Checked in",
  [GuestStatus.JOINED]: "Joined (virtual)",
  [GuestStatus.NO_SHOW]: "No-show",
  [GuestStatus.DECLINED]: "Declined"
};

type EventGuestsSidebarProps = {
  eventId: string;
  guestTotal: number;
  capacityInPerson: number;
  capacityVirtual: number;
  /** Counts per status (all guests on event). */
  statusCounts: Partial<Record<GuestStatus, number>>;
  eventGuestGroups: EventGuestGroupRow[];
  ungroupedGuestCount: number;
};

function href(eventId: string, status: "ALL" | GuestStatus) {
  if (status === "ALL") return `/events/${eventId}/guests`;
  return `/events/${eventId}/guests?status=${status}`;
}

export function EventGuestsSidebar({
  eventId,
  guestTotal,
  capacityInPerson,
  capacityVirtual,
  statusCounts,
  eventGuestGroups,
  ungroupedGuestCount
}: EventGuestsSidebarProps) {
  const sp = useSearchParams();
  const statusParam = sp.get("status");
  const current: "ALL" | GuestStatus =
    statusParam && (Object.values(GuestStatus) as string[]).includes(statusParam)
      ? (statusParam as GuestStatus)
      : "ALL";
  const cap = capacityInPerson + capacityVirtual;
  const capLabel = cap > 0 ? `${guestTotal} / ${cap}` : String(guestTotal);

  const rows: { key: "ALL" | GuestStatus; label: string; count: number }[] = [
    { key: "ALL", label: "All registrations", count: guestTotal },
    ...(
      [
        GuestStatus.INVITED,
        GuestStatus.REGISTERED,
        GuestStatus.ACCEPTED,
        GuestStatus.CHECKED_IN,
        GuestStatus.JOINED,
        GuestStatus.NO_SHOW
      ] as const
    ).map((key) => ({
      key,
      label: STATUS_LABELS[key],
      count: statusCounts[key] ?? 0
    }))
  ];

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-zinc-900">All registrations</p>
          <span
            className="inline-flex items-center gap-1 text-xs text-zinc-500"
            title="Capacity (in person + virtual)"
          >
            <span className="font-semibold tabular-nums text-zinc-800">{capLabel}</span>
            <Settings2 className="h-3.5 w-3.5 opacity-60" aria-hidden />
          </span>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {rows.map((row) => {
            const isActive = current === row.key;
            return (
              <li key={row.key}>
                <Link
                  href={href(eventId, row.key)}
                  scroll={false}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-2 py-1.5 font-medium transition",
                    isActive
                      ? "bg-zinc-900 text-white ring-1 ring-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  <span>{row.label}</span>
                  <span className={cn("tabular-nums", isActive ? "text-white/90" : "text-zinc-500")}>{row.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <EventGuestGroupsPanel
        eventId={eventId}
        groups={eventGuestGroups}
        ungroupedCount={ungroupedGuestCount}
      />

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-zinc-900">Forms</p>
          <Link
            href={`/events/${eventId}/guests/form`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-zinc-400 text-zinc-700 transition hover:bg-zinc-100"
            title="New custom registration form"
          >
            <Plus className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Custom fields for the public sign-up flow.</p>
        <ul className="mt-2 text-sm">
          <li>
            <Link
              href={`/events/${eventId}/guests/form`}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 font-medium text-zinc-900 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
            >
              Registration form
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
}
