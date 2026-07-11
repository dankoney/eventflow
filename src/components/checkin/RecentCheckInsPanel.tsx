"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { fetchCheckInsPage, revokeCheckInForOrganizer } from "@/lib/actions/checkin.actions";
import { removeGuestFromEventAsOrganizer } from "@/lib/actions/guest.actions";
import type { CheckInsPageResult, RecentCheckInRow } from "@/lib/db/checkins";
import { cn, formatDate } from "@/lib/utils";

type RecentCheckInsPanelProps = {
  eventId: string;
  canManageRoster: boolean;
  /** Initial page from server render. */
  initial: CheckInsPageResult;
  /** When set, only check-ins for this session day (door dashboard). */
  dayIndex?: number;
  className?: string;
  /** Compact styling for door dashboard. */
  variant?: "default" | "door";
};

export function RecentCheckInsPanel({
  eventId,
  canManageRoster,
  initial,
  dayIndex,
  className,
  variant = "default"
}: RecentCheckInsPanelProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(initial.page);
  const [result, setResult] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ guestId: string; guestName: string } | null>(
    null
  );
  const [removeBusy, setRemoveBusy] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, dayIndex]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    const res = await fetchCheckInsPage({
      eventId,
      query: debouncedQuery || undefined,
      page,
      pageSize: result.pageSize,
      dayIndex
    });
    setLoading(false);
    if (res.success && res.data) {
      setResult(res.data);
    } else if (!res.success) {
      setError(res.error ?? "Could not load check-ins.");
    }
  }, [eventId, debouncedQuery, page, result.pageSize, dayIndex]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

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
    void loadPage();
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
    void loadPage();
  }

  const actionLink =
    variant === "door"
      ? "text-xs font-semibold text-[#0040e0] hover:underline disabled:pointer-events-none disabled:opacity-50"
      : "text-xs font-semibold text-zinc-800 underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-950 hover:decoration-zinc-500 disabled:pointer-events-none disabled:opacity-50";

  const shellClass =
    variant === "door"
      ? "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      : "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5";

  return (
    <div className={cn(shellClass, className)}>
      <div
        className={cn(
          variant === "door" && "border-b border-slate-200 px-4 py-3 sm:px-6",
          variant === "default" && "mb-4"
        )}
      >
        <h3
          className={cn(
            "font-semibold text-zinc-900",
            variant === "door" ? "text-lg text-slate-900" : "text-lg"
          )}
        >
          Recent check-ins
        </h3>
        {variant === "default" ? (
          <p className="mt-1 text-sm text-zinc-600">
            Search and browse check-ins for this event (scoped to guests you can access).
          </p>
        ) : null}
        <div className={cn("mt-3 flex flex-col gap-2 sm:flex-row sm:items-center", variant === "door" && "sm:px-0")}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone, or company…"
            className={cn(
              "min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2",
              variant === "door"
                ? "border-slate-300 focus:border-[#0040e0] focus:ring-[#0040e0]/20"
                : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10"
            )}
            aria-label="Search check-ins"
          />
          <p className="shrink-0 text-xs text-zinc-500">
            {loading ? "Loading…" : `${result.total} check-in${result.total === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {error ? (
        <div className={cn(variant === "door" ? "px-4 pt-3 sm:px-6" : "mb-3")}>
          <WorkspaceNotice variant="error" onDismiss={() => setError(null)}>
            {error}
          </WorkspaceNotice>
        </div>
      ) : null}

      {result.rows.length === 0 ? (
        <p
          className={cn(
            "text-sm text-zinc-500",
            variant === "door" ? "px-4 py-8 text-center sm:px-6" : "mt-4"
          )}
        >
          {debouncedQuery ? "No check-ins match your search." : "No check-ins yet."}
        </p>
      ) : (
        <ul className={cn("divide-y divide-zinc-100", variant === "door" && "divide-slate-100")}>
          {result.rows.map((row) => (
            <CheckInRowItem
              key={row.id}
              row={row}
              eventId={eventId}
              canManageRoster={canManageRoster}
              busyId={busyId}
              variant={variant}
              actionLink={actionLink}
              onUndo={onUndo}
              onRemove={requestRemoveGuest}
            />
          ))}
        </ul>
      )}

      {result.totalPages > 1 ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 border-t text-sm",
            variant === "door"
              ? "border-slate-200 px-4 py-3 sm:px-6"
              : "border-zinc-100 pt-3"
          )}
        >
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500">
            Page {result.page} of {result.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= result.totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}

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

function CheckInRowItem({
  row,
  eventId,
  canManageRoster,
  busyId,
  variant,
  actionLink,
  onUndo,
  onRemove
}: {
  row: RecentCheckInRow;
  eventId: string;
  canManageRoster: boolean;
  busyId: string | null;
  variant: "default" | "door";
  actionLink: string;
  onUndo: (checkInId: string) => void;
  onRemove: (guestId: string, guestName: string) => void;
}) {
  const timeLabel =
    variant === "door"
      ? formatDate(row.checkedInAt)
      : formatDate(row.checkedInAt);

  return (
    <li
      className={cn(
        "flex flex-col gap-2 py-3 text-sm first:pt-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between",
        variant === "door" ? "px-4 sm:px-6" : ""
      )}
    >
      <div>
        <span className={cn("font-medium", variant === "door" ? "text-slate-900" : "text-zinc-900")}>
          {row.guestName}
        </span>
        <span className={cn("ml-2", variant === "door" ? "text-slate-500" : "text-zinc-500")}>
          {row.guestEmail}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs text-zinc-500">
          {timeLabel}
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
              onClick={() => onUndo(row.id)}
            >
              {busyId === row.id ? "Working…" : "Undo check-in"}
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-red-700 underline decoration-red-200 underline-offset-2 transition hover:text-red-800 hover:decoration-red-400 disabled:pointer-events-none disabled:opacity-50"
              disabled={busyId !== null}
              onClick={() => onRemove(row.guestId, row.guestName)}
            >
              Remove guest
            </button>
          </span>
        ) : null}
      </div>
    </li>
  );
}
