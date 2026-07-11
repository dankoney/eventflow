"use client";

import { Button } from "@/components/ui/Button";

type FeedbackSubmitVisibilityStepProps = {
  guestFirstName: string;
  accent?: string;
  busy: boolean;
  error: string | null;
  onSubmitNamed: () => void;
  onSubmitAnonymous: () => void;
  onBack: () => void;
};

export function FeedbackSubmitVisibilityStep({
  guestFirstName,
  accent = "#0f172a",
  busy,
  error,
  onSubmitNamed,
  onSubmitAnonymous,
  onBack
}: FeedbackSubmitVisibilityStepProps) {
  const name = guestFirstName.trim() || "there";

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-lg font-bold text-zinc-900">Almost done</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Choose how organizers should see your feedback. You can update your answers anytime using this link.
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onSubmitNamed}
        className="w-full rounded-xl px-4 py-3.5 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-60"
        style={{ backgroundColor: accent }}
      >
        {busy ? "Saving…" : `Submit as ${name}`}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={onSubmitAnonymous}
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Submit anonymously"}
      </button>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={onBack}
        className="w-full text-center text-sm font-medium text-zinc-500 hover:text-zinc-800"
      >
        Back to feedback
      </button>
    </div>
  );
}
