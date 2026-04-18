"use client";

import { EventStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cancelEvent, cloneEvent, deleteEvent, markEventCompleted } from "@/lib/actions/event.actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";

type EventLifecyclePanelProps = {
  eventId: string;
  status: EventStatus;
  canManage: boolean;
  canDeletePast: boolean;
  /** Scheduled end time has passed (automation still waits for the post-end grace window). */
  scheduledEndHasPassed: boolean;
};

export function EventLifecyclePanel({
  eventId,
  status,
  canManage,
  canDeletePast,
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
  const canDelete = canManage && canDeletePast;
  const showComplete =
    canManage &&
    scheduledEndHasPassed &&
    (status === EventStatus.PUBLISHED || status === EventStatus.LIVE);

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

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Event lifecycle</h2>
      <p className="mt-1 text-sm text-slate-600">
        Mark the event complete after it ends (or wait for automation), cancel a live or published event, clone into a
        new draft, or delete past events.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {showComplete ? (
          <Button type="button" disabled={busy} onClick={() => setCompleteOpen(true)}>
            {busy ? "Working…" : "Mark complete"}
          </Button>
        ) : null}
        {canCancel ? (
          <Button type="button" variant="danger" disabled={busy} onClick={() => setCancelOpen(true)}>
            Cancel event
          </Button>
        ) : null}
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void onClone()}>
          {busy ? "Working…" : "Clone event"}
        </Button>
        {canDelete ? (
          <Button type="button" variant="danger" disabled={busy} onClick={() => setDeleteOpen(true)}>
            Delete past event
          </Button>
        ) : null}
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
          <Button type="button" disabled={busy} onClick={() => void onConfirmComplete()}>
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
          This permanently deletes this past event and related registrations. This action cannot be undone.
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
    </Card>
  );
}
