"use client";

import { BookOpen, Check, CheckCircle2, CircleCheck, Info, Loader2, Lock, ThumbsDown, ThumbsUp, Minus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { Modal } from "@/components/ui/Modal";
import { submitBallot } from "@/lib/actions/poll.actions";
import { cn } from "@/lib/utils";

import { PollPublicHeader } from "./PollPublicHeader";
import type {
  BallotConfidenceChoice,
  BallotSelection,
  EventPollPositionView
} from "./pollPageTypes";

type EventPollBallotClientProps = {
  accent: string;
  eventName: string;
  pollTitle: string;
  pollDescription: string | null;
  /**
   * Optional procedural voting instructions (OTP, deadlines, rules). When
   * provided, rendered as a highlighted callout just below the "About this
   * ballot" preamble so voters see them before scrolling into positions.
   */
  pollInstructions: string | null;
  pollEndTime: string;
  positions: EventPollPositionView[];
  voter: { id: string; firstName: string; emailHint: string };
  orgName: string;
  brandLogoUrl: string | null;
  /**
   * Mirrors `Poll.isAnonymous`. Drives the submit-button label and an inline
   * "this poll is attributed" disclaimer at the top of the ballot.
   */
  isAnonymous: boolean;
};

type SelectionMap = Record<string, BallotSelection>;

export function EventPollBallotClient({
  accent,
  eventName,
  pollTitle,
  pollDescription,
  pollInstructions,
  pollEndTime,
  positions,
  voter,
  orgName,
  brandLogoUrl,
  isAnonymous
}: EventPollBallotClientProps) {
  const router = useRouter();
  const [selections, setSelections] = useState<SelectionMap>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const accentText = pickContrastTextColor(accent);
  const trimmedInstructions = pollInstructions?.trim() ?? "";
  const hasInstructions = trimmedInstructions.length > 0;

  const completeCount = useMemo(
    () => positions.filter((p) => isComplete(selections[p.id])).length,
    [positions, selections]
  );
  const total = positions.length;
  const progressPct = total === 0 ? 0 : Math.round((completeCount / total) * 100);
  const ready = completeCount === total;

  function setPick(positionId: string, candidateId: string) {
    setSelections((prev) => ({
      ...prev,
      [positionId]: { positionId, candidateId, confidenceChoice: null }
    }));
  }

  function setConfidence(
    positionId: string,
    choice: BallotConfidenceChoice,
    candidateId: string | null
  ) {
    setSelections((prev) => ({
      ...prev,
      [positionId]: {
        positionId,
        candidateId: choice === "YES" ? candidateId : null,
        confidenceChoice: choice
      }
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!ready) {
      setError("Make a selection for every position before submitting.");
      return;
    }
    const picks = positions.map<BallotSelection>((p) => {
      const s = selections[p.id]!;
      return {
        positionId: p.id,
        candidateId: s.candidateId,
        confidenceChoice: s.confidenceChoice
      };
    });
    startTransition(async () => {
      const res = await submitBallot({ picks });
      if (!res.success || !res.data) {
        setError(res.error ?? "Submission failed. Please try again.");
        return;
      }
      /**
       * Server action clears the voting cookie and sets a short thanks cookie; RSC
       * refresh lands on {@link EventPollVoteConfirmedClient} instead of the gate.
       */
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="sticky top-0 z-50">
        <PollPublicHeader
          orgName={orgName}
          brandLogoUrl={brandLogoUrl}
          accent={accent}
          context={eventName}
          right={
            <div className="flex shrink-0 items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-accent">
              <Lock className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-[10px] font-semibold tracking-[0.18em] text-accent">SECURE BALLOT</span>
            </div>
          }
        />
        <div className="h-1.5 w-full border-b border-outline-variant/40 bg-surface-container-low">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-8 sm:py-10">
        {!isAnonymous ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 shadow-sm">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700">
                Attributed ballot
              </p>
              <p className="mt-1 text-amber-900">
                The organizer has chosen to run this poll non-anonymously. Your selections will be
                linked to your guest profile and we&apos;ll email you a copy of how you voted.
              </p>
            </div>
          </div>
        ) : null}
        {pollDescription?.trim() ? (
          <div className="mb-6 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-5 text-sm leading-relaxed text-on-surface-variant shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#5e5e5e]">
              About this ballot
            </span>
            <p className="mt-2 text-[#1b1b1b]">{pollDescription.trim()}</p>
            <p className="mt-2 text-xs font-medium text-[#5e5e5e]">
              Poll: <span className="text-[#1b1b1b]">{pollTitle}</span> · Closes {formatStamp(pollEndTime)}
            </p>
          </div>
        ) : (
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-[#5e5e5e]">
            {pollTitle} · Hi {voter.firstName} · Closes {formatStamp(pollEndTime)}
          </p>
        )}

        {hasInstructions ? (
          <div className="mb-8 flex justify-center">
            <button
              type="button"
              onClick={() => setInstructionsOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent transition hover:border-accent/70 hover:bg-accent/[0.12]"
              aria-haspopup="dialog"
              aria-expanded={instructionsOpen}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              How to vote
            </button>
          </div>
        ) : null}

        {positions.map((position, idx) => {
          const selection = selections[position.id];
          const complete = isComplete(selection);
          const isUnopposed = position.candidates.length === 1;
          const unopposedCandidate = isUnopposed ? position.candidates[0]! : null;

          return (
            <div key={position.id} className="mb-10 sm:mb-12">
              <div className="mb-6 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-6 shadow-sm">
                <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5e5e5e]">
                      Active ballot item
                    </p>
                    <h2 className="mt-1 font-[Manrope,Inter,system-ui] text-2xl font-extrabold tracking-tight text-[#1b1b1b] sm:text-3xl">
                      Position {idx + 1} of {total}: {position.title}
                    </h2>
                  </div>
                  <span className="w-fit rounded bg-surface-container-high px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    {isUnopposed ? "Unopposed confirmation" : "Opposed election"}
                  </span>
                </div>
                {position.description?.trim() ? (
                  <div className="flex items-start gap-3 border-t border-outline-variant/40 pt-4">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                    <p className="text-base font-medium italic leading-relaxed text-on-surface-variant">
                      {position.description.trim()}
                    </p>
                  </div>
                ) : null}
              </div>

              {isUnopposed && unopposedCandidate ? (
                <UnopposedConfidenceBlock
                  candidate={unopposedCandidate}
                  selected={selection?.confidenceChoice ?? null}
                  accent={accent}
                  accentText={accentText}
                  onSelect={(choice) => setConfidence(position.id, choice, unopposedCandidate.id)}
                />
              ) : (
                <CandidateCardGrid
                  candidates={position.candidates}
                  selectedCandidateId={selection?.candidateId ?? null}
                  accent={accent}
                  accentText={accentText}
                  onSelect={(candidateId) => setPick(position.id, candidateId)}
                />
              )}

              {complete ? (
                <p className="mt-3 flex items-center justify-end gap-1.5 text-xs font-semibold text-emerald-700">
                  <CircleCheck className="h-4 w-4" aria-hidden />
                  Selection saved for this position
                </p>
              ) : null}
            </div>
          );
        })}

        {error ? (
          <p className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>
        ) : null}

        <div className="h-36 sm:h-40" aria-hidden />
      </main>

      <footer className="sticky bottom-0 z-40 border-t border-outline-variant/80 bg-surface-container-lowest shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-4 py-4 sm:py-5">
          <button
            type="submit"
            disabled={!ready || pending}
            className={cn(
              "w-full rounded-lg py-4 text-base font-extrabold uppercase tracking-[0.18em] shadow-lg transition-all sm:w-auto sm:min-w-[22rem] sm:px-16",
              ready && !pending
                ? "hover:brightness-110 active:scale-[0.99]"
                : "cursor-not-allowed bg-zinc-200 text-zinc-500"
            )}
            style={ready && !pending ? { backgroundColor: accent, color: accentText } : undefined}
          >
            {pending ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Submitting…
              </span>
            ) : isAnonymous ? (
              "Submit my secret ballot"
            ) : (
              "Submit my ballot"
            )}
          </button>
          <div className="flex items-center gap-2 text-center text-on-surface-variant">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-wider">
              Your vote is anonymized and cannot be changed once submitted.
            </p>
          </div>
        </div>
      </footer>

      <Modal
        open={instructionsOpen}
        title="How to vote"
        subtitle={pollTitle}
        size="md"
        onClose={() => setInstructionsOpen(false)}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border-l-4 border-accent bg-accent/[0.06] p-4 text-sm leading-relaxed text-[#1b1b1b]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <p className="whitespace-pre-wrap">{trimmedInstructions}</p>
          </div>
          <p className="text-xs text-on-surface-variant">
            Voting closes {formatStamp(pollEndTime)}.
          </p>
        </div>
      </Modal>
    </form>
  );
}

function CandidateCardGrid({
  candidates,
  selectedCandidateId,
  accent,
  accentText,
  onSelect
}: {
  candidates: EventPollPositionView["candidates"];
  selectedCandidateId: string | null;
  accent: string;
  accentText: string;
  onSelect: (candidateId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {candidates.map((c) => {
        const selected = c.id === selectedCandidateId;
        return (
          <div
            key={c.id}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-xl border bg-surface-container-lowest shadow-md transition-all hover:shadow-xl",
              selected ? "ring-2 ring-accent ring-offset-0" : "border-outline-variant/40"
            )}
            style={selected ? { borderColor: `${accent}55` } : undefined}
          >
            {selected ? (
              <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Selected
              </div>
            ) : null}
            <div className="relative aspect-[4/3] overflow-hidden shadow-[inset_0_-20px_20px_-20px_rgba(0,0,0,0.08)]">
              {c.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.photoUrl}
                  alt={c.name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center bg-[#e8e8e8] font-[Manrope,Inter,system-ui] text-4xl font-extrabold text-[#5e5e5e]"
                  aria-hidden
                >
                  {initialsOf(c.name)}
                </div>
              )}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-t to-transparent",
                  selected ? "from-accent/15" : "from-black/5"
                )}
              />
            </div>
            <div className="flex flex-grow flex-col items-center p-6 text-center">
              <h4 className="font-[Manrope,Inter,system-ui] text-xl font-bold tracking-tight text-[#1b1b1b]">
                {c.name}
              </h4>
              {c.bio?.trim() ? (
                <p className="mb-4 mt-1 line-clamp-3 text-sm font-medium leading-relaxed text-on-surface-variant">
                  {c.bio.trim()}
                </p>
              ) : (
                <div className="mb-4" />
              )}
            </div>
            <div
              className={cn(
                "border-t p-4",
                selected ? "border-accent/30 bg-accent/10" : "border-outline-variant/40 bg-surface-container-low/80"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  "w-full rounded-lg py-3 text-[11px] font-bold uppercase tracking-[0.16em] transition-opacity active:opacity-80",
                  selected ? "font-extrabold" : ""
                )}
                style={
                  selected
                    ? { backgroundColor: accent, color: accentText }
                    : { backgroundColor: "#000000", color: "#ffffff" }
                }
              >
                {selected ? "Candidate selected" : "Select candidate"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UnopposedConfidenceBlock({
  candidate,
  selected,
  accent,
  accentText,
  onSelect
}: {
  candidate: EventPollPositionView["candidates"][number];
  selected: BallotConfidenceChoice | null;
  accent: string;
  accentText: string;
  onSelect: (choice: BallotConfidenceChoice) => void;
}) {
  return (
    <section className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-6 shadow-sm sm:p-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5e5e5e]">
          Unopposed confirmation
        </p>
        <h3 className="mt-2 font-[Manrope,Inter,system-ui] text-2xl font-extrabold tracking-tight text-[#1b1b1b] sm:text-3xl">
          Confidence vote
        </h3>
        {candidate.bio?.trim() ? (
          <p className="mx-auto mt-3 max-w-xl text-base italic leading-relaxed text-on-surface-variant">
            {candidate.bio.trim()}
          </p>
        ) : null}
      </div>

      <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm sm:flex-row sm:items-center sm:gap-8">
        {candidate.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.photoUrl}
            alt={candidate.name}
            className="h-24 w-24 shrink-0 rounded-full border-2 border-surface-container-high object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-surface-container-high bg-[#e8e8e8] font-[Manrope,Inter,system-ui] text-xl font-extrabold text-[#5e5e5e]">
            {initialsOf(candidate.name)}
          </div>
        )}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h4 className="font-[Manrope,Inter,system-ui] text-lg font-bold text-[#1b1b1b]">{candidate.name}</h4>
          <p className="mt-1 text-sm font-medium text-on-surface-variant">Sole candidate for this position</p>
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        <ConfidenceTile
          choice="YES"
          label="Yes / Approve"
          icon={<ThumbsUp className="h-5 w-5" aria-hidden />}
          selected={selected === "YES"}
          onSelect={onSelect}
          variant="yes"
          accent={accent}
          accentText={accentText}
        />
        <ConfidenceTile
          choice="NO"
          label="No / Reject"
          icon={<ThumbsDown className="h-5 w-5" aria-hidden />}
          selected={selected === "NO"}
          onSelect={onSelect}
          variant="no"
          accent={accent}
          accentText={accentText}
        />
        <ConfidenceTile
          choice="ABSTAIN"
          label="Abstain"
          icon={<Minus className="h-5 w-5" aria-hidden />}
          selected={selected === "ABSTAIN"}
          onSelect={onSelect}
          variant="abstain"
          accent={accent}
          accentText={accentText}
        />
      </div>
    </section>
  );
}

function ConfidenceTile({
  choice,
  label,
  icon,
  selected,
  onSelect,
  variant,
  accent,
  accentText
}: {
  choice: BallotConfidenceChoice;
  label: string;
  icon: ReactNode;
  selected: boolean;
  onSelect: (choice: BallotConfidenceChoice) => void;
  variant: "yes" | "no" | "abstain";
  accent: string;
  accentText: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(choice)}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-outline-variant py-4 text-[11px] font-semibold uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-1",
        selected && variant === "yes" && "border-accent bg-accent text-white shadow-md",
        selected && variant === "no" && "border-rose-600 bg-rose-600 text-white shadow-md",
        selected && variant === "abstain" && "border-[#5e5e5e] bg-[#5e5e5e] text-white shadow-md",
        !selected && "bg-surface-container-lowest hover:border-zinc-400",
        !selected && variant === "yes" && "hover:bg-accent hover:text-white hover:border-accent",
        !selected && variant === "no" && "hover:border-rose-500 hover:bg-rose-500 hover:text-white",
        !selected && variant === "abstain" && "hover:border-[#5e5e5e] hover:bg-[#5e5e5e] hover:text-white"
      )}
      style={
        selected && variant === "yes"
          ? { backgroundColor: accent, borderColor: accent, color: accentText }
          : undefined
      }
    >
      {icon}
      {label}
    </button>
  );
}

function isComplete(s: BallotSelection | undefined): boolean {
  if (!s) return false;
  return s.candidateId !== null || s.confidenceChoice !== null;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function formatStamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

function pickContrastTextColor(hex: string): string {
  const t = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return "#ffffff";
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0a0a" : "#ffffff";
}
