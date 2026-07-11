"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchDoorDashboard } from "@/lib/actions/checkin.actions";
import type { CheckInsPageResult } from "@/lib/db/checkins";
import type { DoorDashboardSnapshot } from "@/lib/db/doorDashboard";
import { RecentCheckInsPanel } from "@/components/checkin/RecentCheckInsPanel";
import { cn } from "@/lib/utils";

const POLL_MS = 5000;

type DoorDashboardClientProps = {
  eventId: string;
  initial: DoorDashboardSnapshot;
  initialCheckIns: CheckInsPageResult;
  dayIndex: number;
};

export function DoorDashboardClient({
  eventId,
  initial,
  initialCheckIns,
  dayIndex
}: DoorDashboardClientProps) {
  const [snap, setSnap] = useState(initial);
  const [polling, setPolling] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetchDoorDashboard({ eventId });
    if (res.success && res.data) setSnap(res.data);
  }, [eventId]);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [polling, refresh]);

  const barColor =
    snap.percent >= 100 ? "bg-red-500" : snap.percent >= 80 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span
            className={cn("inline-block h-2 w-2 rounded-full", polling ? "bg-emerald-500" : "bg-slate-300")}
            aria-hidden
          />
          {polling ? "Live · refreshes every 5s" : "Paused"}
          <button
            type="button"
            className="ml-2 font-medium text-[#0040e0] hover:underline"
            onClick={() => setPolling((p) => !p)}
          >
            {polling ? "Pause" : "Resume"}
          </button>
        </div>
        <Link
          href={`/events/${eventId}/checkin`}
          className="text-sm font-semibold text-[#0040e0] hover:underline"
        >
          Open check-in desk →
        </Link>
      </div>

      {!snap.checkInOpen ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {snap.checkInWindowError ?? "Check-in window is closed for this session."}
        </p>
      ) : null}

      {snap.atCapacity ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          Venue at capacity — kiosk walk-ins may be blocked until capacity is raised or guests check out.
        </p>
      ) : snap.percent >= 80 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Approaching venue capacity ({snap.percent}%).
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Checked in" value={String(snap.checkedInCount)} sub={`of ${snap.capacity} capacity`} />
        <MetricCard label="Door fill" value={`${snap.percent}%`} sub={snap.atCapacity ? "At capacity" : "In progress"} />
        <MetricCard
          label="Registered in-person"
          value={String(snap.registeredInPersonCount)}
          sub="On guest list"
        />
        <MetricCard label="Session day" value={String(snap.dayIndex)} sub={snap.eventStatus} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-2 flex justify-between text-sm font-medium text-slate-700">
          <span>Venue capacity</span>
          <span>
            {snap.checkedInCount} / {snap.capacity}
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${Math.min(100, snap.percent)}%` }}
          />
        </div>
      </div>

      <RecentCheckInsPanel
        eventId={eventId}
        canManageRoster={false}
        initial={initialCheckIns}
        dayIndex={dayIndex}
        variant="door"
      />

      <p className="text-xs text-slate-400">Last updated {new Date(snap.updatedAt).toLocaleString()}</p>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{sub}</p>
    </div>
  );
}
