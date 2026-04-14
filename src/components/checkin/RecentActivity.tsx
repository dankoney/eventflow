import { formatDate } from "@/lib/utils";
import type { RecentCheckInRow } from "@/lib/db/checkins";

type RecentActivityProps = {
  entries: RecentCheckInRow[];
};

export function RecentActivity({ entries }: RecentActivityProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Recent check-ins</h3>
      <p className="mt-1 text-sm text-slate-600">Latest activity for this event (scoped to guests you can access).</p>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No check-ins yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {entries.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
              <div>
                <span className="font-medium text-slate-900">{row.guestName}</span>
                <span className="ml-2 text-slate-500">{row.guestEmail}</span>
              </div>
              <div className="text-xs text-slate-500">
                {formatDate(row.checkedInAt)}
                {row.method === "qr" ? " · QR" : " · Manual"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
