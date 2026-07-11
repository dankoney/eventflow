"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { revokeCheckInForOrganizer } from "@/lib/actions/checkin.actions";
import { removeGuestFromEventAsOrganizer } from "@/lib/actions/guest.actions";
import type { RecentCheckInRow } from "@/lib/db/checkins";
import { formatDate } from "@/lib/utils";

type RecentActivityProps = {
  eventId: string;
  canManageRoster: boolean;
  entries: RecentCheckInRow[];
};

export function RecentActivity({ eventId, canManageRoster, entries }: RecentActivityProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ guestId: string; guestName: string } | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  async function onUndo(checkInId: string) {
    setError(null);
    setBusyId(checkInId);
    const res = await revokeCheckInForOrganizer({ eventId, checkInId });
    setBusyId(null);
    if (!res.success) {
      setError(res.error ?? "Could not undo check-in.");
      return;
    }
    router.refresh();
  }

  function requestRemoveGuest(guestId: string, guestName: string) {
    setRemoveTarget({ guestId, guestName });
    setError(null);
  }

  async function confirmRemoveGuest() {
    const target = removeTarget;
    if (!target) return;
    setRemoveBusy(true);
    const res = await removeGuestFromEventAsOrganizer({ eventId, guestId: target.guestId });
    setRemoveBusy(false);
    setRemoveTarget(null);
    if (!res.success) {
      setError(res.error ?? "Could not remove guest.");
      return;
    }
    router.refresh();
  }

  const actionLink =
    "text-xs font-semibold text-zinc-800 underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-950 hover:decoration-zinc-500 disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-lg font-semibold text-zinc-900">Recent check-ins</h3>
      <p className="mt-1 text-sm text-zinc-600">
        Latest activity for this event (scoped to guests you can access).
      </p>

      {error ? (
        <div className="mt-3">
          <WorkspaceNotice variant="error" onDismiss={() => setError(null)}>
            {error}
          </WorkspaceNotice>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No check-ins yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100">
          {entries.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 py-3 text-sm first:pt-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between"
            >
              <div>
                <span className="font-medium text-zinc-900">{row.guestName}</span>
                <span className="ml-2 text-zinc-500">{row.guestEmail}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-xs text-zinc-500">
                  {formatDate(row.checkedInAt)}
                  {row.method === "qr" ? " · QR" : " · Manual"}
                  {row.dayIndex > 1 ? ` · Day ${row.dayIndex}` : ""}
                </span>
                {canManageRoster ? (
                  <span className="flex flex-wrap gap-2 text-xs">
                    <Link
                      href={`/events/${eventId}/guests?guest=${encodeURIComponent(row.guestId)}`}
                      className={actionLink}
                    >
                      Edit guest
                    </Link>
                    <button
                      type="button"
                      className={actionLink}
                      disabled={busyId !== null}
                      onClick={() => void onUndo(row.id)}
                    >
                      {busyId === row.id ? "Working…" : "Undo check-in"}
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-700 underline decoration-red-200 underline-offset-2 transition hover:text-red-800 hover:decoration-red-400 disabled:pointer-events-none disabled:opacity-50"
                      disabled={busyId !== null}
                      onClick={() => requestRemoveGuest(row.guestId, row.guestName)}
                    >
                      {busyId === `del-${row.guestId}` ? "Working…" : "Remove guest"}
                    </button>
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove guest from event?"
        message={
          removeTarget
            ? `Remove ${removeTarget.guestName} from this event entirely? This cannot be undone.`
            : ""
        }
        confirmLabel="Remove guest"
        cancelLabel="Cancel"
        variant="danger"
        busy={removeBusy}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void confirmRemoveGuest()}
      />
    </div>
  );
}
