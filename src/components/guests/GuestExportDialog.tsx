"use client";

import { Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  GuestAudiencePicker,
  type GuestAudiencePickerOptions
} from "@/components/guests/GuestAudiencePicker";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { GuestWithRep } from "@/lib/db/guests";
import { guestWithRepToAudienceRow } from "@/lib/guests/audienceRows";
import { EMPTY_SEGMENT_FILTER, type GuestSegmentFilterInput } from "@/lib/guests/segmentFilters";

type GuestExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guests: GuestWithRep[];
  pickerOptions: GuestAudiencePickerOptions;
  onExportCsv: (rows: GuestWithRep[]) => void;
  onExportPdf: (rows: GuestWithRep[]) => Promise<void>;
};

export function GuestExportDialog({
  open,
  onOpenChange,
  guests,
  pickerOptions,
  onExportCsv,
  onExportPdf
}: GuestExportDialogProps) {
  const [segmentFilter, setSegmentFilter] = useState<GuestSegmentFilterInput>(EMPTY_SEGMENT_FILTER);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pdfBusy, setPdfBusy] = useState(false);

  const audienceRows = useMemo(() => guests.map(guestWithRepToAudienceRow), [guests]);

  const handleSelectedIdsChange = useCallback((next: Set<string>) => {
    setSelectedIds(next);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSegmentFilter(EMPTY_SEGMENT_FILTER);
    setSelectedIds(new Set(guests.map((g) => g.id)));
    setPdfBusy(false);
  }, [open, guests]);

  const selectedRows = useMemo(() => {
    return guests.filter((g) => selectedIds.has(g.id));
  }, [guests, selectedIds]);

  function handleClose() {
    onOpenChange(false);
  }

  function handleExportCsv() {
    onExportCsv(selectedRows);
    handleClose();
  }

  async function handleExportPdf() {
    setPdfBusy(true);
    try {
      await onExportPdf(selectedRows);
      handleClose();
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Export guests"
      subtitle="Filter by registration status, check-in, CRM type, company, email domain, category, or event group — then fine-tune who is included."
      onClose={handleClose}
      size="xl"
      headerTone="dark"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">{selectedRows.length}</span> guest
            {selectedRows.length === 1 ? "" : "s"} ready to export
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={selectedRows.length === 0}
              onClick={handleExportCsv}
            >
              <Download className="mr-2 inline h-4 w-4" aria-hidden />
              CSV
            </Button>
            <Button
              type="button"
              disabled={selectedRows.length === 0 || pdfBusy}
              onClick={() => void handleExportPdf()}
            >
              <Download className="mr-2 inline h-4 w-4" aria-hidden />
              {pdfBusy ? "Exporting…" : "PDF"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex h-[min(58vh,32rem)] min-h-0 flex-col">
        <GuestAudiencePicker
          guests={audienceRows}
          options={pickerOptions}
          selectable
          selectedIds={selectedIds}
          onSelectedIdsChange={handleSelectedIdsChange}
          segmentFilter={segmentFilter}
          onSegmentFilterChange={setSegmentFilter}
          listTitle="Export roster"
          emptyListMessage="No guests match these filters. Try Include mode or reset filters."
        />
      </div>
    </Modal>
  );
}
