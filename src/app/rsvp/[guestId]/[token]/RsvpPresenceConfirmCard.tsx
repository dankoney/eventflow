"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { confirmRsvpPresence } from "@/lib/actions/rsvp.actions";

type RsvpPresenceConfirmCardProps = {
  guestId: string;
  token: string;
  accent: string;
  firstName: string;
  eventName: string;
  /**
   * True when the guest record already shows CHECKED_IN before they opened this page —
   * lets us render the success state immediately without making them tap the button.
   */
  startAsCheckedIn?: boolean;
  /**
   * Optional URL on the same screen the guest can use to edit their RSVP (switch to
   * virtual, update accommodation, etc.) when they shouldn't actually self check-in.
   */
  editRsvpHref?: string;
};

export function RsvpPresenceConfirmCard({
  guestId,
  token,
  accent,
  firstName,
  eventName,
  startAsCheckedIn = false,
  editRsvpHref
}: RsvpPresenceConfirmCardProps) {
  const [checkedIn, setCheckedIn] = useState(startAsCheckedIn);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await confirmRsvpPresence({ guestId, token });
      if (!res.success || !res.data) {
        setError(res.error ?? "Could not record your presence. Please try again.");
        return;
      }
      setCheckedIn(true);
    });
  }

  if (checkedIn) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ background: accent }}
        >
          <Check className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="mt-4 font-[Manrope,Inter,system-ui] text-xl font-bold text-zinc-900">
          You&apos;re checked in.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Welcome to {eventName}. Your presence is on the books — staff may still scan your QR if it&apos;s
          requested at any session.
        </p>
        {editRsvpHref ? (
          <Link
            href={editRsvpHref}
            className="mt-5 inline-block text-xs font-semibold uppercase tracking-wider text-zinc-500 underline-offset-4 hover:underline"
          >
            Update my RSVP instead
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Live now</p>
      <h2 className="mt-2 font-[Manrope,Inter,system-ui] text-2xl font-extrabold tracking-tight text-zinc-900">
        Hi {firstName}, ready when you are.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        Tap below to self check-in. We&apos;ll log your presence right now — staff don&apos;t need to scan you.
      </p>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={pending}
        style={{ background: accent, color: pickContrastTextColor(accent) }}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-extrabold uppercase tracking-wider transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Confirming…
          </>
        ) : (
          "Confirm my presence"
        )}
      </button>
      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {editRsvpHref ? (
        <p className="mt-4 text-xs text-zinc-500">
          Changed your mind?{" "}
          <Link
            href={editRsvpHref}
            className="font-semibold text-zinc-700 underline-offset-4 hover:underline"
          >
            Update my RSVP instead
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function pickContrastTextColor(hex: string): string {
  const t = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return "#ffffff";
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0a0a" : "#ffffff";
}
