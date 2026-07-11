"use client";

import { Eye, Globe, Loader2, Lock, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { setPollActive, setPollPublicElectionPublished, upsertEventPoll } from "@/lib/actions/poll.actions";

type PollSetupCardProps = {
  eventId: string;
  initial: {
    title: string;
    description: string | null;
    /** Mirrors `Poll.instructions` — procedural voting guidance shown to voters. */
    instructions: string | null;
    isActive: boolean;
    /** When true, election block appears on the public registration page. */
    publicElectionPublished: boolean;
    /** Mirrors `Poll.isAnonymous`. Defaults to true at the DB layer. */
    isAnonymous: boolean;
    /** ISO string (matches the value prop expected by `datetime-local`). */
    startTime: string;
    endTime: string;
  } | null;
  /**
   * Number of ballots already cast. When > 0 the anonymity toggle is locked,
   * matching the server-side guard in `upsertEventPoll`. We mirror the rule on
   * the client so admins see immediately why the control is disabled.
   */
  ballotsCast: number;
};

/**
 * Setup form for the Poll metadata. When `initial` is null we render in create
 * mode (button label "Create poll"); otherwise edit mode ("Save changes").
 *
 * The "Open voting" master switch is split out from the form so an admin can flip
 * the poll on/off without having to re-save the entire form — `setPollActive` is
 * a lightweight action separate from `upsertEventPoll`.
 */
export function PollSetupCard({ eventId, initial, ballotsCast }: PollSetupCardProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [startTime, setStartTime] = useState(
    initial ? toLocalDateTimeInput(initial.startTime) : ""
  );
  const [endTime, setEndTime] = useState(initial ? toLocalDateTimeInput(initial.endTime) : "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? false);
  const [publicElectionPublished, setPublicElectionPublished] = useState(
    initial?.publicElectionPublished ?? false
  );
  /** Defaults to true on new polls (matches DB default + secret-ballot default posture). */
  const [isAnonymous, setIsAnonymous] = useState(initial?.isAnonymous ?? true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [togglePending, startToggle] = useTransition();
  const [publishPending, startPublish] = useTransition();
  const isEdit = initial !== null;
  /**
   * Anonymity is frozen once the first ballot lands so we never end up with a
   * partial attribution dataset. Mirrors the server-side guard.
   */
  const anonymityLocked = ballotsCast > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!title.trim()) {
      setError("Give the ballot a title (e.g. \"AGM Elections 2026\").");
      return;
    }
    if (!startTime || !endTime) {
      setError("Set both the open and close timestamps.");
      return;
    }
    startTransition(async () => {
      const res = await upsertEventPoll({
        eventId,
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        isActive,
        isAnonymous,
        startTime: new Date(startTime),
        endTime: new Date(endTime)
      });
      if (!res.success) {
        setError(res.error ?? "We couldn't save the poll.");
        return;
      }
      setInfo(isEdit ? "Poll updated." : "Poll created.");
      router.refresh();
    });
  }

  function handlePublishToggle(next: boolean) {
    setError(null);
    setInfo(null);
    setPublicElectionPublished(next);
    startPublish(async () => {
      const res = await setPollPublicElectionPublished({ eventId, published: next });
      if (!res.success) {
        setError(res.error ?? "Could not update public page visibility.");
        setPublicElectionPublished(!next);
        return;
      }
      setInfo(
        next
          ? "Election is now visible on the public registration page."
          : "Election removed from the public registration page."
      );
      router.refresh();
    });
  }

  function handleToggle(next: boolean) {
    setError(null);
    setInfo(null);
    setIsActive(next);
    startToggle(async () => {
      const res = await setPollActive({ eventId, isActive: next });
      if (!res.success) {
        setError(res.error ?? "Could not change the voting status.");
        /** Revert the optimistic toggle. */
        setIsActive(!next);
        return;
      }
      setInfo(next ? "Voting is now open." : "Voting is paused.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Ballot setup</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Define the ballot, publish it on the registration page when ready, and use the voting
            switch to open or pause ballot access independently.
          </p>
        </div>
        {isEdit ? (
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row">
            <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400/40"
                checked={publicElectionPublished}
                disabled={publishPending}
                onChange={(e) => handlePublishToggle(e.target.checked)}
              />
              <Globe className="h-3.5 w-3.5 opacity-70" aria-hidden />
              {publishPending
                ? "Saving…"
                : publicElectionPublished
                  ? "On public page"
                  : "Not on public page"}
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400/40"
                checked={isActive}
                disabled={togglePending}
                onChange={(e) => handleToggle(e.target.checked)}
              />
              {togglePending ? "Saving…" : isActive ? "Voting open" : "Voting paused"}
            </label>
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <Field label="Ballot title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="AGM Elections 2026"
            maxLength={160}
            required
          />
        </Field>
        <Field label="Description" hint="Editorial intro shown above the positions list. Optional.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short note voters see when they open the ballot."
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-slate-400/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-400/25"
          />
        </Field>
        <Field
          label="Voting instructions"
          hint="Procedural guidance (OTP, ballot rules, deadlines). Shown as a highlighted callout on the public election section, OTP gate, and ballot. Optional."
        >
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={[
              "You'll receive a 6-digit code by email — codes expire in 10 minutes.",
              "Pick one option for every position before submitting.",
              "Ballots can't be edited once cast."
            ].join("\n")}
            rows={4}
            maxLength={4000}
            className="w-full rounded-md border border-slate-400/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-400/25"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Voting opens" hint="Local time.">
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </Field>
          <Field label="Voting closes" hint="Local time.">
            <Input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </Field>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Ballot anonymity
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">
                {isAnonymous ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-emerald-600" aria-hidden /> Anonymous ballot
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="h-4 w-4 text-amber-600" aria-hidden /> Attributed ballot
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                {isAnonymous
                  ? "Selections are recorded with no link back to the voter. The participation flag is all we keep."
                  : "Each ballot is linked to the guest. Admins can see how every member voted and the voter receives a copy of their selections by email."}
              </p>
            </div>
            <label
              className={`flex shrink-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-700 ${
                anonymityLocked ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400/40"
                checked={isAnonymous}
                disabled={anonymityLocked || pending}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              {isAnonymous ? "Anonymous" : "Attributed"}
            </label>
          </div>
          {anonymityLocked ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Voting has already started — the anonymity setting is locked for the rest of this poll.
            </p>
          ) : !isAnonymous ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Voters will be told the poll is non-anonymous on the gate, ballot, and confirmation
              screens. Make sure your bylaws or event rules allow this before saving.
            </p>
          ) : null}
        </div>
        {!isEdit ? (
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-400 text-zinc-900 focus:ring-zinc-400/40"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>
              Open voting immediately when this poll is saved (you can still pause it from this card).
            </span>
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending} className="inline-flex items-center gap-2">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {isEdit ? "Save changes" : "Create poll"}
          </Button>
          {info ? <span className="text-xs font-medium text-emerald-700">{info}</span> : null}
        </div>
      </form>

      {error ? (
        <div className="mt-4">
          <WorkspaceNotice variant="error">{error}</WorkspaceNotice>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint ? <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span> : null}
    </label>
  );
}

/**
 * Convert an ISO string into the `YYYY-MM-DDTHH:MM` format `<input type="datetime-local">`
 * accepts. Uses local components so the value shown matches the operator's clock.
 */
function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
