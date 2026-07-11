import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import type { VoterLogEntry } from "@/lib/db/voterLog";

type Props = {
  entries: VoterLogEntry[];
  /** Public results URL — left null when the admin hasn't generated one yet. */
  voterLogCsvUrl: string;
};

/**
 * Admin-only audit table for non-anonymous polls. Each row is a guest with their
 * full ballot. Only mounted when `Poll.isAnonymous = false` (see the parent page).
 *
 * Privacy posture:
 *  - This panel intentionally leaks vote attribution because the organizer
 *    explicitly opted out of anonymity.
 *  - Voters were warned about the non-anonymous mode on the gate, ballot, and
 *    confirmation pages, and the receipt email echoes their selections.
 *  - The export endpoint is gated by `canManageEvents` + event ownership.
 */
export function PollVoterLogPanel({ entries, voterLogCsvUrl }: Props) {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
            <Eye className="h-4 w-4" aria-hidden /> Voter log
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            This poll is non-anonymous — every guest&apos;s ballot is recorded with
            their identity attached. Voters were notified before they submitted.
          </p>
        </div>
        <a
          href={voterLogCsvUrl}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          download
        >
          Export voter log (CSV)
        </a>
      </header>

      {entries.length === 0 ? (
        <WorkspaceNotice variant="info">
          No ballots have been recorded yet. Once a guest submits, their selections
          will appear here.
        </WorkspaceNotice>
      ) : (
        <Table headers={["Guest", "Selections", "Submitted", "Receipt"]} variant="workspace">
          {entries.map((entry) => (
            <tr key={entry.guestId} className="align-top">
              <td className="px-4 py-4">
                <div className="font-semibold text-zinc-900">{entry.guestName}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{entry.guestEmail}</div>
              </td>
              <td className="px-4 py-4">
                <ul className="space-y-1.5">
                  {entry.choices.map((choice) => (
                    <li
                      key={`${entry.guestId}:${choice.positionId}`}
                      className="flex flex-wrap items-center gap-2 text-xs"
                    >
                      <Badge className="bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200">
                        {choice.positionTitle}
                      </Badge>
                      <span className="font-medium text-zinc-900">{choice.selection}</span>
                    </li>
                  ))}
                </ul>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-xs text-zinc-600">
                {entry.votedAt.toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </td>
              <td className="px-4 py-4 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                {entry.receiptRef.slice(0, 8)}…
              </td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
