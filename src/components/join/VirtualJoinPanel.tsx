"use client";

import { AttendMode, GuestStatus } from "@prisma/client";
import { ExternalLink, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { recordVirtualJoin } from "@/lib/actions/join.actions";
import { formatDate } from "@/lib/utils";

export type VirtualJoinPanelProps = {
  guestId: string;
  guestName: string;
  mode: AttendMode;
  status: GuestStatus;
  zoomLink: string | null;
  eventName: string;
  eventDateIso: string;
  eventLocation: string;
  zoomMeetingId: string | null;
  zoomPasscode: string | null;
  organizationName: string;
};

export function VirtualJoinPanel({
  guestId,
  guestName,
  mode,
  status,
  zoomLink,
  eventName,
  eventDateIso,
  eventLocation,
  zoomMeetingId,
  zoomPasscode,
  organizationName
}: VirtualJoinPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const when = formatDate(new Date(eventDateIso));

  function onConfirmJoined() {
    setError(null);
    startTransition(async () => {
      const res = await recordVirtualJoin({ guestId });
      if (!res.success) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  if (mode === AttendMode.IN_PERSON) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{organizationName}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Hi, {guestName}</h1>
        </div>
        <p className="text-slate-700">
          <span className="font-semibold text-slate-900">{eventName}</span> is an in-person event.
        </p>
        <p className="text-sm text-slate-600">
          {when} · {eventLocation}
        </p>
        <p className="text-sm text-slate-600">
          Use the QR code from your confirmation email at the venue check-in. This page is intended for virtual
          attendees.
        </p>
      </div>
    );
  }

  if (status === GuestStatus.NO_SHOW) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        This registration is no longer active. Contact the organizer if you need help.
      </div>
    );
  }

  const attended = status === GuestStatus.JOINED || status === GuestStatus.CHECKED_IN;
  const canMarkJoined =
    status === GuestStatus.REGISTERED || status === GuestStatus.INVITED;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{organizationName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{eventName}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Virtual · {when}
        </p>
        {eventLocation ? (
          <p className="mt-1 text-sm text-slate-500">{eventLocation}</p>
        ) : null}
      </div>

      <p className="text-slate-700">
        Welcome, <span className="font-medium text-slate-900">{guestName}</span>.
      </p>

      {attended ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          {status === GuestStatus.CHECKED_IN
            ? "You're checked in. Join via Zoom below when the session starts."
            : "You're marked as joined for this webinar."}
        </div>
      ) : null}

      {zoomLink ? (
        <div>
          <a
            href={zoomLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Video className="h-4 w-4" aria-hidden />
            Join Zoom
            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </a>
          <p className="mt-2 text-xs text-slate-500">Opens Zoom in a new tab.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your personal Zoom link is not available yet. Please use the link in your confirmation email, or contact the
          organizer.
        </div>
      )}

      {(zoomMeetingId || zoomPasscode) && (
        <dl className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          {zoomMeetingId ? (
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-slate-500">Meeting ID</dt>
              <dd className="font-mono text-slate-900">{zoomMeetingId}</dd>
            </div>
          ) : null}
          {zoomPasscode ? (
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-slate-500">Passcode</dt>
              <dd className="font-mono text-slate-900">{zoomPasscode}</dd>
            </div>
          ) : null}
        </dl>
      )}

      {canMarkJoined ? (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-600">
            After you've opened Zoom, you can confirm so the host sees you in analytics.
          </p>
          <Button type="button" className="mt-3" disabled={pending} onClick={onConfirmJoined}>
            {pending ? "Saving…" : "I've joined the webinar"}
          </Button>
          {error ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
