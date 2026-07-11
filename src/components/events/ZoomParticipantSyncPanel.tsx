"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { syncZoomParticipantsForEvent } from "@/lib/actions/zoomParticipantSync.actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ZoomParticipantSyncPanelProps = {
  eventId: string;
  /** `toolbar` = compact control for the guests page; `card` = full explainer (e.g. settings docs). */
  layout?: "toolbar" | "card";
};

export function ZoomParticipantSyncPanel({ eventId, layout = "toolbar" }: ZoomParticipantSyncPanelProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runSync() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await syncZoomParticipantsForEvent({ eventId });
      if (!res.success) {
        setError(res.error ?? "Sync failed.");
        return;
      }
      const d = res.data;
      if (!d) return;
      setMessage(
        `Merged ${d.fetched} row(s) — live ${d.liveDashboardRows}, dashboard past ${d.pastDashboardRows}, ` +
          `dashboard pastOne ${d.pastOneDashboardRows}, report ${d.reportRows}. ` +
          `Updated ${d.matchedUpdated} roster guest(s), ${d.matchedNoChange} already up-to-date; ` +
          `created ${d.externalCreated} external/anonymous. ` +
          `Skipped ${d.skippedNoIdentifier}.`
      );
    });
  }

  const button = (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={runSync}
      className="h-10 w-fit shrink-0 border-2 border-zinc-300 px-4 font-semibold text-zinc-900 hover:bg-zinc-50"
    >
      <RefreshCw className={cn("mr-2 inline h-4 w-4", pending && "animate-spin")} aria-hidden />
      {pending ? "Syncing…" : "Sync from Zoom"}
    </Button>
  );

  const feedback = (
    <>
      {message ? (
        <p
          className="max-w-[min(100vw-2rem,28rem)] text-xs leading-relaxed text-zinc-700 sm:max-w-sm"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="max-w-[min(100vw-2rem,28rem)] text-xs leading-relaxed text-red-700 sm:max-w-sm" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );

  if (layout === "toolbar") {
    return (
      <div className="flex max-w-full min-w-0 flex-wrap items-start gap-1.5 align-top">
        {button}
        <div className="basis-full">{feedback}</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Zoom participant report</h3>
      <p className="mt-1 text-xs text-slate-600">
        Merges <span className="font-medium">live + past dashboard</span> metrics with the{" "}
        <span className="font-medium">report</span>. Match by email marks roster guests{" "}
        <span className="font-medium">JOINED</span>; unknowns become <span className="font-medium">External join</span>;
        name-only rows become <span className="font-medium">Anonymous Zoom Participant (display name)</span>.
        Dashboard scopes:{" "}
        <code className="rounded bg-slate-100 px-1">dashboard_meetings:read:admin</code> or{" "}
        <code className="rounded bg-slate-100 px-1">dashboard_webinars:read:admin</code>; report:{" "}
        <code className="rounded bg-slate-100 px-1">report:read:admin</code>. Near-real-time = click Sync; instant push
        needs Zoom webhooks.
      </p>
      <div className="mt-3">{button}</div>
      <div className="mt-2">{feedback}</div>
    </div>
  );
}
