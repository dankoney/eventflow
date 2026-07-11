"use client";

import { Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  GuestAudiencePicker,
  feedbackEligibleToAudienceRow,
  type GuestAudiencePickerOptions
} from "@/components/guests/GuestAudiencePicker";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  listFeedbackBlastEligibleGuests,
  sendEventFeedbackRequestBlast
} from "@/lib/actions/eventFeedback.actions";
import type { FeedbackBlastEligibleGuest } from "@/lib/db/eventFeedback";
import { EMPTY_SEGMENT_FILTER, type GuestSegmentFilterInput } from "@/lib/guests/segmentFilters";

type EventFeedbackBlastDialogProps = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickerOptions: GuestAudiencePickerOptions;
  lastBlastAudienceGuestIds?: string[];
  onSent?: () => void;
};

export function EventFeedbackBlastDialog({
  eventId,
  open,
  onOpenChange,
  pickerOptions,
  lastBlastAudienceGuestIds = [],
  onSent
}: EventFeedbackBlastDialogProps) {
  const [segmentFilter, setSegmentFilter] = useState<GuestSegmentFilterInput>(EMPTY_SEGMENT_FILTER);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [eligibleGuests, setEligibleGuests] = useState<FeedbackBlastEligibleGuest[]>([]);
  const [loadBusy, setLoadBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const audienceRows = useMemo(
    () => eligibleGuests.map(feedbackEligibleToAudienceRow),
    [eligibleGuests]
  );

  const handleSelectedIdsChange = useCallback((next: Set<string>) => {
    setSelectedIds(next);
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadBusy(true);
    setLoadError(null);
    setSendError(null);
    setSegmentFilter(EMPTY_SEGMENT_FILTER);

    void listFeedbackBlastEligibleGuests({ eventId }).then((res) => {
      if (cancelled) return;
      setLoadBusy(false);
      if (!res.success || !res.data) {
        setEligibleGuests([]);
        setSelectedIds(new Set());
        setLoadError(res.error ?? "Could not load eligible guests.");
        return;
      }
      setEligibleGuests(res.data.guests);
      const eligibleIds = new Set(res.data.guests.map((g) => g.id));
      const preselect =
        lastBlastAudienceGuestIds.length > 0
          ? lastBlastAudienceGuestIds.filter((id) => eligibleIds.has(id))
          : res.data.guests.map((g) => g.id);
      setSelectedIds(new Set(preselect.length > 0 ? preselect : res.data.guests.map((g) => g.id)));
    });

    return () => {
      cancelled = true;
    };
  }, [open, eventId, lastBlastAudienceGuestIds]);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSend() {
    const guestIds = [...selectedIds];
    if (guestIds.length === 0) return;

    setSendError(null);
    setSendBusy(true);
    const res = await sendEventFeedbackRequestBlast({ eventId, guestIds });
    setSendBusy(false);
    if (!res.success || !res.data) {
      setSendError(res.error ?? "Could not send feedback requests.");
      return;
    }
    handleClose();
    onSent?.();
  }

  const selectedCount = audienceRows.filter((g) => selectedIds.has(g.id)).length;

  return (
    <Modal
      open={open}
      title="Request feedback"
      subtitle="Checked-in or joined guests who have not responded yet. Filter, then choose who receives the request."
      onClose={handleClose}
      size="xl"
      headerTone="dark"
      footer={
        <div className="space-y-2">
          {sendError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {sendError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">
              <span className="font-semibold text-zinc-900">{selectedCount}</span> guest
              {selectedCount === 1 ? "" : "s"} will receive a feedback request
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={sendBusy}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={sendBusy || loadBusy || selectedCount === 0}
                onClick={() => void handleSend()}
              >
                <Send className="mr-2 inline h-4 w-4" aria-hidden />
                {sendBusy ? "Sending…" : `Send (${selectedCount})`}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex h-[min(58vh,32rem)] min-h-0 flex-col">
        {loadBusy ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-600">
            Loading eligible guests…
          </div>
        ) : loadError ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-center text-sm text-red-800">
            {loadError}
          </div>
        ) : (
          <GuestAudiencePicker
            guests={audienceRows}
            options={pickerOptions}
            selectable
            selectedIds={selectedIds}
            onSelectedIdsChange={handleSelectedIdsChange}
            segmentFilter={segmentFilter}
            onSegmentFilterChange={setSegmentFilter}
            listTitle="Eligible guests"
            emptyListMessage="No pending guests match these filters."
          />
        )}
      </div>
    </Modal>
  );
}
