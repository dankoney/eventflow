"use client";

import { GuestStatus } from "@prisma/client";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { CachedGuestRow } from "@/lib/checkin-offline-db";
import { cn } from "@/lib/utils";

type CheckInSearchProps = {
  onCheckIn: (guestId: string) => void;
  disabled?: boolean;
  guests: CachedGuestRow[];
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function guestMatchesQuery(g: CachedGuestRow, q: string): boolean {
  const co = (g.company ?? "").toLowerCase();
  const jt = (g.jobTitle ?? "").toLowerCase();
  const phone = (g.phone ?? "").toLowerCase();
  const qDigits = digitsOnly(q);
  const phoneDigits = digitsOnly(g.phone ?? "");

  if (
    g.name.toLowerCase().includes(q) ||
    (g.email ?? "").toLowerCase().includes(q) ||
    co.includes(q) ||
    jt.includes(q) ||
    phone.includes(q)
  ) {
    return true;
  }

  if (qDigits.length >= 3 && phoneDigits.includes(qDigits)) {
    return true;
  }

  return false;
}

function isCheckedIn(status: string): boolean {
  return status === GuestStatus.CHECKED_IN || status === GuestStatus.JOINED;
}

export function CheckInSearch({ onCheckIn, disabled, guests }: CheckInSearchProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const sorted = [...guests].sort((a, b) => a.name.localeCompare(b.name));
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((g) => guestMatchesQuery(g, q));
  }, [guests, query]);

  const checkedInCount = guests.filter((g) => isCheckedIn(g.status)).length;
  const notCheckedInCount = guests.length - checkedInCount;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Attendee lookup</h3>
      <p className="mt-1 text-sm text-slate-600">
        All registered guests are listed below. Filter by name, email, phone, company, or job title,
        then check in with one tap.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {checkedInCount} checked in · {notCheckedInCount} not yet checked in · {guests.length} total
      </p>

      <div className="mt-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Filter by name, email, phone…"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || !query.trim()}
          onClick={() => setQuery("")}
          aria-label="Clear filter"
        >
          <X className="h-4 w-4" aria-hidden />
          Clear
        </Button>
      </div>

      <ul className="mt-3 max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto">
        {filtered.map((g) => {
          const checkedIn = isCheckedIn(g.status);
          return (
            <li
              key={g.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5",
                checkedIn ? "border-emerald-100 bg-emerald-50/50" : "border-slate-100 bg-slate-50/50"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{g.name}</p>
                <p className="truncate text-xs text-slate-600">{g.email}</p>
                {g.phone ? <p className="truncate text-xs text-slate-600">{g.phone}</p> : null}
                {g.jobTitle || g.company ? (
                  <p className="truncate text-xs text-slate-500">
                    {[g.jobTitle, g.company].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant={checkedIn ? "secondary" : "default"}
                disabled={disabled || checkedIn}
                className="shrink-0"
                onClick={() => onCheckIn(g.id)}
              >
                {checkedIn ? "Checked in" : "Check in"}
              </Button>
            </li>
          );
        })}
      </ul>

      {guests.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No registered guests for this event yet.</p>
      ) : null}

      {guests.length > 0 && filtered.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No guests match this filter.</p>
      ) : null}
    </div>
  );
}
