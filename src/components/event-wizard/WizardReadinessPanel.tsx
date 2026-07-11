"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";

import type { ReadinessIssue } from "@/lib/event-wizard/readiness";
import { hasBlockingIssues } from "@/lib/event-wizard/readiness";
import { cn } from "@/lib/utils";

type WizardReadinessPanelProps = {
  issues: ReadinessIssue[];
  className?: string;
};

function fieldLabel(field: NonNullable<ReadinessIssue["field"]>): string {
  const labels: Record<NonNullable<ReadinessIssue["field"]>, string> = {
    name: "Event name",
    locationId: "Venue",
    date: "Start date",
    endDate: "End date",
    type: "Event type",
    virtualCapacity: "Online seats",
    enableVirtual: "Enable online attendance",
    zoomSessionKind: "Session type",
    bannerImageUrl: "Banner",
    brandLogoUrl: "Logo",
    brandPrimaryColor: "Brand color"
  };
  return labels[field] ?? field;
}

export function WizardReadinessPanel({ issues, className }: WizardReadinessPanelProps) {
  if (issues.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950",
          className
        )}
      >
        <p className="font-medium">Readiness check</p>
        <p className="mt-1 text-emerald-900/90">This step looks good — you can continue.</p>
      </div>
    );
  }

  const blocked = hasBlockingIssues(issues);

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        blocked ? "border-amber-200 bg-amber-50 text-amber-950" : "border-sky-200 bg-sky-50 text-sky-950",
        className
      )}
    >
      <p className="font-medium">Readiness check</p>
      <ul className="mt-2 space-y-2">
        {issues.map((i) => (
          <li key={i.id} className="flex gap-2">
            {i.severity === "block" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden />
            )}
            <span>
              {i.message}
              {i.field ? (
                <span className="mt-0.5 block text-xs opacity-80">
                  Check the <span className="font-medium">{fieldLabel(i.field)}</span> field below.
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {blocked ? (
        <p className="mt-3 text-xs font-medium text-amber-900">Resolve blocking items before continuing.</p>
      ) : null}
    </div>
  );
}
