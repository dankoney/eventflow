"use client";

import { GuestJoinSource, GuestStatus } from "@prisma/client";
import { useEffect, useState } from "react";

import { GuestStatusBadge } from "@/components/guests/GuestStatusBadge";
import { formatDate } from "@/lib/utils";
import type { GuestWithRep } from "@/lib/db/guests";
import { AttendMode } from "@prisma/client";

import QRCode from "qrcode";

type GuestDetailDrawerProps = {
  guest: GuestWithRep | null;
  onClose: () => void;
};

export function GuestDetailDrawer({ guest, onClose }: GuestDetailDrawerProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!guest?.qrCode) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(guest.qrCode, { width: 200, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => setQrDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [guest?.qrCode]);

  if (!guest) return null;

  const virtualZoomHref =
    guest.mode === AttendMode.VIRTUAL ? guest.openZoomJoinUrl ?? guest.zoomLink : null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/30"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Guest details</h2>
          <button type="button" onClick={onClose} className="rounded p-2 text-sm text-slate-600 hover:bg-slate-100">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <GuestStatusBadge status={guest.status as import("@/types").GuestStatus} />
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              Tier {guest.tier}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {guest.mode === AttendMode.VIRTUAL ? "Virtual" : "In person"}
            </span>
            {guest.joinSource === GuestJoinSource.EXTERNAL_JOIN ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                External join
              </span>
            ) : null}
          </div>
          <dl className="space-y-3">
            <div>
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{guest.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd
                className={
                  guest.contactsRedacted ? "select-none blur-[3px] transition filter" : undefined
                }
                title={guest.contactsRedacted ? "Contact details limited for this guest" : undefined}
              >
                {guest.email}
              </dd>
            </div>
            {guest.phone ? (
              <div>
                <dt className="text-slate-500">Phone</dt>
                <dd
                  className={guest.contactsRedacted ? "select-none blur-[3px]" : undefined}
                  title={guest.contactsRedacted ? "Contact details limited for this guest" : undefined}
                >
                  {guest.phone}
                </dd>
              </div>
            ) : null}
            {guest.company ? (
              <div>
                <dt className="text-slate-500">Company</dt>
                <dd>{guest.company}</dd>
              </div>
            ) : null}
            {guest.jobTitle ? (
              <div>
                <dt className="text-slate-500">Job title</dt>
                <dd>{guest.jobTitle}</dd>
              </div>
            ) : null}
            {guest.dietary ? (
              <div>
                <dt className="text-slate-500">Dietary</dt>
                <dd>{guest.dietary}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-slate-500">Rep</dt>
              <dd>{guest.repName ?? guest.repEmail ?? "—"}</dd>
            </div>
          </dl>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="mb-2 font-semibold text-slate-900">Status timeline</h3>
            <ul className="space-y-2 text-slate-700">
              <li>Registered — {formatDate(guest.createdAt)}</li>
              {guest.status === GuestStatus.CHECKED_IN || guest.status === GuestStatus.JOINED ? (
                <li>
                  {guest.status === GuestStatus.JOINED ? "Joined via Zoom" : "Checked in"}
                  {guest.checkedInAt ? ` — ${formatDate(guest.checkedInAt)}` : ""}
                </li>
              ) : null}
            </ul>
          </div>

          {guest.mode === AttendMode.IN_PERSON && qrDataUrl && !guest.contactsRedacted ? (
            <div className="mt-6">
              <h3 className="mb-2 font-semibold text-slate-900">Check-in QR</h3>
              <img src={qrDataUrl} alt="Guest QR" className="mx-auto max-w-[200px] rounded border border-slate-200 p-2" />
            </div>
          ) : null}

          {guest.mode === AttendMode.VIRTUAL && virtualZoomHref && !guest.contactsRedacted ? (
            <div className="mt-6">
              <h3 className="mb-2 font-semibold text-slate-900">Zoom</h3>
              <a
                href={virtualZoomHref}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sky-700 underline"
              >
                {virtualZoomHref}
              </a>
            </div>
          ) : null}

          {guest.contactsRedacted ? (
            <p className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              QR codes and join links are hidden because this guest is not assigned to you.
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
