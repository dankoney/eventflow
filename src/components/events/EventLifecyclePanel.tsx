"use client";

import { EventStatus } from "@prisma/client";
import { Check, GitBranch } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cancelEvent, cloneEvent, deleteEvent, markEventCompleted } from "@/lib/actions/event.actions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

const PIPELINE = ["Draft", "Published", "Live", "Completed"] as const;

/** Completed step circles — matches EventCard status chips (not neutral zinc). */
const PIPELINE_STEP_DONE_CLASS: Record<number, string> = {
  0: "border-amber-500 bg-amber-400 text-amber-950 ring-1 ring-amber-500/35",
  1: "border-sky-600 bg-sky-500 text-white ring-1 ring-sky-700/40",
  2: "border-zinc-800 bg-zinc-900 text-white ring-1 ring-zinc-950/45",
  3: "border-zinc-600 bg-zinc-500 text-white ring-1 ring-zinc-800/35"
};

const PIPELINE_STEP_LABEL_DONE_CLASS: Record<number, string> = {
  0: "text-amber-950",
  1: "text-sky-800",
  2: "text-zinc-800",
  3: "text-zinc-600"
};

/** Connectors after each step when progress has passed that point. */
const PIPELINE_SEGMENT_FILL = ["bg-amber-400", "bg-sky-500", "bg-zinc-700"] as const;

function pipelineStep(status: EventStatus): number {
  switch (status) {
    case EventStatus.DRAFT:
      return 0;
    case EventStatus.PUBLISHED:
      return 1;
    case EventStatus.LIVE:
      return 2;
    case EventStatus.COMPLETED:
      return 3;
    case EventStatus.CANCELLED:
      return -1;
  }
}

type EventLifecyclePanelProps = {
  eventId: string;
  status: EventStatus;
  canManage: boolean;
  /** Draft, past, no guests, or cancelled — server enforces the same rules. */
  canDeleteEvent: boolean;
  /** Scheduled end time has passed (automation still waits for the post-end grace window). */
  scheduledEndHasPassed: boolean;
};

export function EventLifecyclePanel({
  eventId,
  status,
  canManage,
  canDeleteEvent,
  scheduledEndHasPassed
}: EventLifecyclePanelProps) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCancel = canManage && (status === EventStatus.PUBLISHED || status === EventStatus.LIVE);
  const canClone = canManage;
  const canDelete = canManage && canDeleteEvent;
  const showComplete =
    canManage &&
    scheduledEndHasPassed &&
    (status === EventStatus.PUBLISHED || status === EventStatus.LIVE);

  const stepIdx = pipelineStep(status);

  async function onClone() {
    setError(null);
    setBusy(true);
    const res = await cloneEvent({ eventId });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not clone event.");
      return;
    }
    router.push(`/events/${res.data.id}/edit`);
    router.refresh();
  }

  async function onConfirmCancel(notifyGuests: boolean) {
    setError(null);
    setBusy(true);
    const res = await cancelEvent({ eventId, notifyGuests });
    setBusy(false);
    setCancelOpen(false);
    if (!res.success) {
      setError(res.error ?? "Could not cancel event.");
      return;
    }
    router.refresh();
  }

  async function onConfirmDelete() {
    setError(null);
    setBusy(true);
    const res = await deleteEvent(eventId);
    setBusy(false);
    setDeleteOpen(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not delete event.");
      return;
    }
    router.push("/events");
    router.refresh();
  }

  async function onConfirmComplete() {
    setError(null);
    setBusy(true);
    const res = await markEventCompleted({ eventId });
    setBusy(false);
    if (!res.success) {
      setError(res.error ?? "Could not mark event complete.");
      return;
    }
    setCompleteOpen(false);
    router.refresh();
  }

  if (!canManage) return null;

  const stepDone = (i: number) => {
    if (status === EventStatus.CANCELLED) return false;
    if (status === EventStatus.COMPLETED) return true;
    return i < stepIdx;
  };

  const stepCurrent = (i: number) => {
    if (status === EventStatus.CANCELLED || status === EventStatus.COMPLETED) return false;
    return i === stepIdx;
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border-2 border-zinc-900 bg-white shadow-[6px_6px_0_0_rgb(24_24_27)]"
      aria-labelledby="lifecycle-heading"
    >
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <GitBranch className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="lifecycle-heading" className="text-base font-bold tracking-tight text-zinc-900">
              Lifecycle
            </h2>
            <p className="mt-0.5 text-sm text-zinc-600">
              Where this event sits in your go-live pipeline — then the actions you can take from here.
            </p>
          </div>
        </div>

        {status === EventStatus.CANCELLED ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
            This event is <span className="font-semibold">cancelled</span>. Registration is closed; use clone to spin
            up a new draft if needed.
          </p>
        ) : (
          <div className="mt-6">
            <ol className="flex w-full items-start justify-between gap-1 sm:gap-2">
              {PIPELINE.map((label, i) => {
                const done = stepDone(i);
                const current = stepCurrent(i);
                const segmentAfterDone =
                  status === EventStatus.COMPLETED || stepIdx > i;

                return (
                  <li key={label} className="flex min-w-0 flex-1 items-start">
                    <div className="flex shrink-0 flex-col items-center text-center">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold sm:h-10 sm:w-10 sm:text-sm",
                          done && PIPELINE_STEP_DONE_CLASS[i],
                          current &&
                            "border-amber-500 bg-amber-50 text-amber-950 shadow-[0_0_0_4px_rgba(245,158,11,0.25)]",
                          !done && !current && "border-zinc-200 bg-white text-zinc-400"
                        )}
                        aria-current={current ? "step" : undefined}
                      >
                        {done ? <Check className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} aria-hidden /> : i + 1}
                      </div>
                      <span
                        className={cn(
                          "mt-2 text-[10px] font-semibold uppercase leading-tight tracking-wide sm:text-[11px]",
                          current && "text-amber-950",
                          done && !current && PIPELINE_STEP_LABEL_DONE_CLASS[i],
                          !done && !current && "text-zinc-400"
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {i < PIPELINE.length - 1 ? (
                      <div
                        className="mx-0.5 mt-[18px] hidden h-0.5 min-w-[6px] flex-1 rounded-full sm:mx-1 sm:mt-5 sm:block"
                        aria-hidden
                      >
                        <div
                          className={cn(
                            "h-full rounded-full",
                            segmentAfterDone ? PIPELINE_SEGMENT_FILL[i] : "bg-zinc-200"
                          )}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 sm:hidden" aria-hidden>
              <div
                className="h-full rounded-full bg-sky-500 transition-[width]"
                style={{
                  width: `${status === EventStatus.COMPLETED ? 100 : Math.max(0, (stepIdx / (PIPELINE.length - 1)) * 100)}%`
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-6 sm:py-5">
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {showComplete ? (
            <Button
              type="button"
              disabled={busy}
              className="w-full justify-center bg-amber-500 font-semibold text-zinc-950 shadow-sm hover:bg-amber-400 sm:w-auto"
              onClick={() => setCompleteOpen(true)}
            >
              {busy ? "Working…" : "Mark complete"}
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              className="w-full justify-center sm:w-auto"
              onClick={() => setCancelOpen(true)}
            >
              Cancel event
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            className="w-full border-zinc-200 bg-zinc-50 justify-center font-medium hover:bg-zinc-100 sm:w-auto"
            onClick={() => void onClone()}
          >
            {busy ? "Working…" : "Clone event"}
          </Button>
          {canDelete ? (
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              className="w-full justify-center sm:w-auto"
              onClick={() => setDeleteOpen(true)}
            >
              Delete event
            </Button>
          ) : null}
        </div>
      </div>

      <Modal
        open={completeOpen}
        title="Mark event as complete?"
        onClose={() => {
          if (!busy) setCompleteOpen(false);
        }}
      >
        <p className="text-sm text-slate-700">
          This sets the event to <span className="font-medium">Completed</span> now. Public registration closes
          immediately. You can use this right after the session ends instead of waiting for the automatic completion
          job.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy}
            className="bg-amber-500 font-semibold text-zinc-950 hover:bg-amber-400"
            onClick={() => void onConfirmComplete()}
          >
            {busy ? "Saving…" : "Mark complete"}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setCompleteOpen(false)}>
            Not yet
          </Button>
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        title="Cancel this event?"
        onClose={() => {
          if (!busy) setCancelOpen(false);
        }}
      >
        <p className="text-sm text-slate-700">
          This will stop public registration immediately. Do you want to notify all registered guests by email and
          WhatsApp (for guests with a phone number on file)?
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="danger" disabled={busy} onClick={() => void onConfirmCancel(true)}>
            {busy ? "Cancelling…" : "Cancel and notify guests"}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void onConfirmCancel(false)}>
            Cancel without notifying
          </Button>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        title="Delete this event?"
        onClose={() => {
          if (!busy) setDeleteOpen(false);
        }}
      >
        <p className="text-sm text-slate-700">
          This permanently deletes this event and related guest data. You can delete drafts, events with no
          registered guests, events that have already ended, or cancelled events. This action cannot be undone.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="danger" disabled={busy} onClick={() => void onConfirmDelete()}>
            {busy ? "Deleting…" : "Delete event permanently"}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleteOpen(false)}>
            Keep event
          </Button>
        </div>
      </Modal>
    </section>
  );
}
