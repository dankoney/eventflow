"use client";

import { useState, useTransition, type FormEvent } from "react";
import { RsvpDeclineReason } from "@prisma/client";

import { submitRsvpDecline } from "@/lib/actions/rsvp.actions";

type Reason = { id: RsvpDeclineReason; label: string };

const BASE_REASONS: Reason[] = [
  { id: "SCHEDULING_CONFLICT", label: "Scheduling conflict" },
  { id: "NOT_RELEVANT", label: "Not relevant to my role" },
  { id: "OUT_OF_OFFICE", label: "Out of office / on leave" }
];

const VIRTUAL_REASON: Reason = {
  id: "PREFER_VIRTUAL_ONLY",
  label: "Prefer a virtual-only option"
};

const OTHER_REASON: Reason = { id: "OTHER", label: "Other" };

type Props = {
  guestId: string;
  token: string;
  accent: string;
  alreadyDeclined: boolean;
  priorReason: RsvpDeclineReason | null;
  priorNote: string | null;
  showVirtualOption: boolean;
};

export function RsvpDeclineForm({
  guestId,
  token,
  accent,
  alreadyDeclined,
  priorReason,
  priorNote,
  showVirtualOption
}: Props) {
  const [reason, setReason] = useState<RsvpDeclineReason | null>(priorReason ?? null);
  const [note, setNote] = useState<string | null>(priorNote ?? "");
  const [submitted, setSubmitted] = useState<boolean>(alreadyDeclined);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reasons: Reason[] = [
    ...BASE_REASONS,
    ...(showVirtualOption ? [VIRTUAL_REASON] : []),
    OTHER_REASON
  ];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError("Please choose a reason so we can plan better.");
      return;
    }
    const trimmedNote = (note ?? "").trim();
    if (reason === "OTHER" && trimmedNote.length < 2) {
      setError("Please share a quick note so the organizer can follow up.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await submitRsvpDecline({
        guestId,
        token,
        reason,
        note: trimmedNote.length > 0 ? trimmedNote.slice(0, 2000) : null
      });
      if (!res.success) {
        setError(res.error ?? "Could not save your response. Please try again.");
        return;
      }
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ background: accent }}
        >
          ✓
        </div>
        <h2 className="mt-4 font-[Manrope,Inter,system-ui] text-xl font-bold text-zinc-900">
          Thanks for letting us know.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          We&apos;ve removed you from this event and will not send any further reminders.
          You&apos;ll still hear from us about future events that may be a better fit.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-zinc-900">Why can&apos;t you attend?</legend>
        <div className="space-y-2">
          {reasons.map((r) => {
            const checked = reason === r.id;
            return (
              <label
                key={r.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                  checked
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.id}
                  checked={checked}
                  onChange={() => setReason(r.id)}
                  className="h-4 w-4 accent-zinc-900"
                />
                <span>{r.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {reason === "OTHER" ? "Tell us a bit more" : "Anything else we should know? (optional)"}
        </span>
        <textarea
          value={note ?? ""}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={2000}
          required={reason === "OTHER"}
          aria-describedby="decline-note-help"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
          placeholder={
            reason === "OTHER"
              ? "What made this event a no-go?"
              : "Anything specific — conflict timing, missing info, or what would help us plan better."
          }
        />
        <p id="decline-note-help" className="mt-1 text-[11px] text-zinc-500">
          Notes go straight to the organizer. We don&apos;t share them with anyone else on the program.
        </p>
      </label>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
