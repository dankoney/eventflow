"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { updateEventAllowFlashEntry } from "@/lib/actions/event.actions";

type EventWalkInAccessCardProps = {
  eventId: string;
  readOnly?: boolean;
  initialAllowFlashEntry: boolean;
};

export function EventWalkInAccessCard({ eventId, readOnly = false, initialAllowFlashEntry }: EventWalkInAccessCardProps) {
  const router = useRouter();
  const [allowFlashEntry, setAllowFlashEntry] = useState(initialAllowFlashEntry);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAllowFlashEntry(initialAllowFlashEntry);
  }, [initialAllowFlashEntry]);

  async function onSave() {
    setError(null);
    setBusy(true);
    const res = await updateEventAllowFlashEntry({ eventId, allowFlashEntry });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not save.");
      return;
    }
    setAllowFlashEntry(res.data.allowFlashEntry);
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Command Center entry</p>
        <h2 className="mt-2 text-base font-semibold text-slate-900">Walk-ins at the org lobby</h2>
        <p className="mt-1 text-sm text-slate-600">
          When enabled, someone whose work email is not on the guest list or CRM can complete a short form at the org
          Command Center and join as a walk-in (subject to your registration profile).
        </p>
      </div>
      <div className="space-y-4 px-4 py-5 sm:px-6">
        {error ? (
          <WorkspaceNotice variant="error" onDismiss={() => setError(null)}>
            {error}
          </WorkspaceNotice>
        ) : null}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300"
            disabled={readOnly || busy}
            checked={allowFlashEntry}
            onChange={(e) => setAllowFlashEntry(e.target.checked)}
          />
          <span>
            <span className="font-medium text-slate-900">Allow Command Center walk-ins</span>
            <span className="mt-1 block text-xs text-slate-600">
              Turn off for strictly invite-only programs (guest list + CRM matches only).
            </span>
          </span>
        </label>
        {!readOnly ? (
          <Button type="button" disabled={busy || allowFlashEntry === initialAllowFlashEntry} onClick={() => void onSave()}>
            {busy ? "Saving…" : "Save walk-in setting"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
