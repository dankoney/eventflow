"use client";

import { WaitlistStatus } from "@prisma/client";
import { ListOrdered, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { promoteNextWaitlistSlots } from "@/lib/actions/waitlist.actions";
import type { EventWaitlistListRow } from "@/lib/db/eventWaitlist";
import { cn } from "@/lib/utils";

type EventWaitlistPanelProps = {
  eventId: string;
  rows: EventWaitlistListRow[];
  canPromote: boolean;
};

function statusLabel(s: WaitlistStatus): string {
  switch (s) {
    case WaitlistStatus.WAITING:
      return "Waiting";
    case WaitlistStatus.PROMOTED:
      return "Promoted";
    case WaitlistStatus.EXPIRED:
      return "Expired";
    case WaitlistStatus.REMOVED:
      return "Removed";
    default:
      return s;
  }
}

export function EventWaitlistPanel({ eventId, rows, canPromote }: EventWaitlistPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const waiting = rows.filter((r) => r.status === WaitlistStatus.WAITING);
  const waitingCount = waiting.length;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <ListOrdered className="h-4 w-4 text-zinc-500" aria-hidden />
            Waitlist
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {waitingCount === 0
              ? "No one is queued for an open seat."
              : `${waitingCount} in queue — promoting sends the smart invitation email when capacity allows.`}
          </p>
        </div>
        {canPromote ? (
          <Button
            type="button"
            variant="secondary"
            className="h-9 shrink-0 border-zinc-300 text-xs font-semibold"
            disabled={pending || waitingCount === 0}
            title={waitingCount === 0 ? "Queue is empty" : "Invite everyone the event can seat from the waitlist"}
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const res = await promoteNextWaitlistSlots({ eventId });
                if (!res.success) {
                  setMessage({ ok: false, text: res.error ?? "Promotion failed." });
                  return;
                }
                setMessage({
                  ok: true,
                  text:
                    res.data?.promoted === 0
                      ? "No one was promoted (no open seats or no matching waitlist entries)."
                      : `Promoted ${res.data?.promoted} guest(s) from the waitlist.`
                });
                router.refresh();
              });
            }}
          >
            <RefreshCw className={cn("mr-1.5 inline h-3.5 w-3.5", pending && "animate-spin")} aria-hidden />
            {pending ? "Running…" : "Fill open seats from waitlist"}
          </Button>
        ) : null}
      </div>
      {message ? (
        <p
          className={cn("mt-2 text-xs font-medium", message.ok ? "text-emerald-800" : "text-red-700")}
          role="status"
        >
          {message.text}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <div className="mt-4 max-h-48 overflow-auto rounded-lg border border-zinc-100">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="sticky top-0 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Email</th>
                <th className="px-3 py-2 font-semibold">Phone</th>
                <th className="px-3 py-2 font-semibold">Mode</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-800">
              {rows.map((r) => (
                <tr key={r.id} className="bg-white">
                  <td className="px-3 py-2 font-mono text-zinc-500">{r.position}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2 text-zinc-600">{r.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-600">{r.preferredMode ?? "Any"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        r.status === WaitlistStatus.WAITING && "bg-amber-100 text-amber-900",
                        r.status === WaitlistStatus.PROMOTED && "bg-emerald-100 text-emerald-900",
                        r.status === WaitlistStatus.EXPIRED && "bg-zinc-100 text-zinc-600",
                        r.status === WaitlistStatus.REMOVED && "bg-zinc-100 text-zinc-500"
                      )}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-400">No waitlist entries for this event yet.</p>
      )}
    </section>
  );
}
