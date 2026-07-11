"use client";

import { ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";

import type { BoothPartyMember } from "@/lib/actions/walkInBooth.actions";
import { kioskBackButtonClass, kioskPrimaryButtonClass } from "@/components/checkin-booth/kioskClasses";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type CheckInBoothGroupFormProps = {
  groupName: string | null;
  primaryGuestId: string;
  members: BoothPartyMember[];
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (guestIds: string[]) => void;
};

export function CheckInBoothGroupForm({
  groupName,
  primaryGuestId,
  members,
  busy,
  error,
  onBack,
  onSubmit
}: CheckInBoothGroupFormProps) {
  const defaultSelected = useMemo(() => {
    const ids = new Set<string>();
    ids.add(primaryGuestId);
    for (const m of members) {
      if (!m.alreadyCheckedIn) ids.add(m.id);
    }
    return ids;
  }, [members, primaryGuestId]);

  const [selected, setSelected] = useState<Set<string>>(defaultSelected);

  function toggle(id: string, disabled: boolean) {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCount = [...selected].filter((id) => {
    const m = members.find((x) => x.id === id);
    return m && !m.alreadyCheckedIn;
  }).length;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <button type="button" onClick={onBack} className={kioskBackButtonClass} disabled={busy}>
        <ChevronLeft className="h-6 w-6" aria-hidden />
        Back
      </button>

      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#0040e0]">Group check-in</p>
        <h2 className="mt-2 text-2xl font-bold text-[#151c27] sm:text-3xl">
          {groupName ? `Table: ${groupName}` : "Check in your group"}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-base text-[#434656]">
          Select everyone arriving with you. Guests already signed in are shown below.
        </p>
      </div>

      <ul className="space-y-3 rounded-2xl border border-[#c4c5d9] bg-white p-4 shadow-sm sm:p-6">
        {members.map((m) => {
          const isChecked = selected.has(m.id);
          const disabled = m.alreadyCheckedIn;
          return (
            <li key={m.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition",
                  disabled
                    ? "cursor-default border-slate-200 bg-slate-50 opacity-80"
                    : isChecked
                      ? "border-[#0040e0] bg-[#f4f6ff]"
                      : "border-slate-200 hover:border-[#0040e0]/40"
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-[#0040e0]"
                  checked={isChecked}
                  disabled={disabled || busy}
                  onChange={() => toggle(m.id, disabled)}
                />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-lg font-semibold text-[#151c27]">{m.name}</span>
                  <span className="block text-sm text-[#434656]">{m.email}</span>
                  {m.company ? (
                    <span className="block text-sm text-slate-500">{m.company}</span>
                  ) : null}
                  {disabled ? (
                    <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      Already signed in
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-base text-red-700">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={busy || selectedCount === 0}
        className={cn(kioskPrimaryButtonClass, "bg-[#0040e0] hover:bg-[#0035be]")}
        onClick={() => onSubmit([...selected])}
      >
        {busy
          ? "Checking in…"
          : selectedCount === 0
            ? "Select guests to check in"
            : `Check in ${selectedCount} guest${selectedCount === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}
