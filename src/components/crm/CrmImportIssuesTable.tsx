"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { CrmImportIssue } from "@/types/crmImport";
import { cn } from "@/lib/utils";

type CrmImportIssuesTableProps = {
  issues: CrmImportIssue[];
  pageSize?: number;
};

export function CrmImportIssuesTable({ issues, pageSize = 10 }: CrmImportIssuesTableProps) {
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(issues.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return issues.slice(start, start + pageSize);
  }, [issues, pageSize, safePage]);

  if (issues.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-amber-950">
        {issues.length} row{issues.length === 1 ? "" : "s"} skipped due to duplicate email or phone
      </p>
      <div className="overflow-auto rounded-xl border border-amber-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-amber-50 text-[10px] font-bold uppercase tracking-wide text-amber-900/80">
            <tr>
              <th className="px-3 py-2">Row</th>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Duplicate value</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Conflicts with</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {slice.map((issue) => (
              <tr key={`${issue.row}-${issue.conflictField}-${issue.duplicateValue}`}>
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-zinc-900">{issue.row}</td>
                <td className="whitespace-nowrap px-3 py-2 capitalize text-zinc-700">{issue.conflictField}</td>
                <td className="max-w-[160px] truncate px-3 py-2 font-mono text-zinc-800" title={issue.duplicateValue}>
                  {issue.duplicateValue}
                </td>
                <td className="max-w-[140px] truncate px-3 py-2 text-zinc-800" title={issue.name}>
                  {issue.name}
                </td>
                <td className="max-w-[160px] truncate px-3 py-2 text-zinc-600" title={issue.email}>
                  {issue.email}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-600">{issue.phone}</td>
                <td className="max-w-[220px] px-3 py-2 text-zinc-700" title={issue.reason}>
                  <span className="line-clamp-2">{issue.conflictWith}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-2 text-xs text-amber-900">
          <span>
            Page {safePage} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-2 text-xs"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-2 text-xs"
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
      <p className={cn("text-xs text-amber-900/80")}>
        Tip: phones are normalized to E.164 before comparison — numbers that look different in Excel may match after
        import. Rows that match an existing CRM contact are updated when &quot;Update existing contacts&quot; is
        enabled. True conflicts (same email on one record and phone on another) are still skipped.
      </p>
    </div>
  );
}
