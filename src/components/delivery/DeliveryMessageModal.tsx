"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { getDeliveryMessageDetail } from "@/lib/actions/delivery.actions";
import type { DeliveryMessageDetail } from "@/lib/delivery/messagePreview";
import { formatDate } from "@/lib/utils";

import { Modal } from "@/components/ui/Modal";

type DeliveryMessageModalProps = {
  open: boolean;
  rowId: string | null;
  eventId: string;
  onClose: () => void;
};

export function DeliveryMessageModal({ open, rowId, eventId, onClose }: DeliveryMessageModalProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DeliveryMessageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !rowId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getDeliveryMessageDetail({ rowId, eventId }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.success || !res.data) {
        setError(res.error ?? "Could not load message.");
        return;
      }
      setDetail(res.data);
    });

    return () => {
      cancelled = true;
    };
  }, [open, rowId, eventId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={detail?.kindLabel ?? "Message sent"}
      subtitle={
        detail
          ? `${detail.guestName} · ${formatDate(detail.sentAt)} · ${detail.channel}`
          : undefined
      }
      size="lg"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading message…
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : detail ? (
        <div className="space-y-4 text-sm">
          <dl className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-zinc-500">Status</dt>
              <dd className="mt-0.5 text-zinc-900">{detail.status}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-zinc-500">Recipient</dt>
              <dd className="mt-0.5 break-all text-zinc-900">{detail.recipient ?? "—"}</dd>
            </div>
            {detail.providerRef ? (
              <div className="sm:col-span-2">
                <dt className="font-semibold uppercase tracking-wide text-zinc-500">Provider ref</dt>
                <dd className="mt-0.5 break-all font-mono text-zinc-700">{detail.providerRef}</dd>
              </div>
            ) : null}
          </dl>

          {detail.errorDetail && detail.status !== "SENT" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
              {detail.errorDetail}
            </div>
          ) : null}

          {detail.subject ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Subject</p>
              <p className="mt-1 font-medium text-zinc-900">{detail.subject}</p>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {detail.channel === "SMS" ? "SMS text" : "Email preview"}
            </p>
            {detail.bodyHtml ? (
              <div className="mt-1 space-y-2">
                <p className="text-xs text-zinc-500">
                  Preview only — links and buttons are disabled.
                </p>
                <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-inner">
                  <iframe
                    title={`Email preview for ${detail.guestName}`}
                    srcDoc={detail.bodyHtml}
                    sandbox=""
                    className="h-[min(32rem,70vh)] w-full bg-white"
                  />
                </div>
              </div>
            ) : (
              <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 font-sans text-sm leading-relaxed text-zinc-800">
                {detail.body}
              </pre>
            )}
          </div>

          {detail.reconstructed ? (
            <p className="text-xs text-zinc-500">
              {detail.bodyFormat === "html"
                ? "Rebuilt from email templates — layout should match what was sent; exact dynamic content may differ slightly."
                : "Reconstructed from templates — exact send-time content may differ slightly."}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
