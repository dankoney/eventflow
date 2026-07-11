"use client";

import { ArrowRight, BookOpen, FileText, Info, ShieldCheck, Vote, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import type { PublicElectionView } from "@/lib/public-event/electionView";
import { cn } from "@/lib/utils";

type PublicEventElectionSectionProps = {
  election: PublicElectionView;
  dark?: boolean;
};

/**
 * Public registration-page section that introduces the event's election, lists every
 * position + candidate (photo, role, bio excerpt) and exposes the supporting document
 * (CV / manifesto) when the organizer uploaded one. The "Open secure ballot" CTA
 * deep-links to `/events/[id]/poll` and is only enabled when the voting window is
 * actually open — outside the window we still render the candidates so registrants
 * can review them ahead of time.
 */
export function PublicEventElectionSection({
  election,
  dark = false
}: PublicEventElectionSectionProps) {
  const [modalCandidate, setModalCandidate] =
    useState<{ candidate: PublicElectionView["positions"][number]["candidates"][number]; positionTitle: string } | null>(
      null
    );
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  if (election.positions.length === 0) return null;

  const trimmedInstructions = election.instructions?.trim() ?? "";
  const hasInstructions = trimmedInstructions.length > 0;

  const startLabel = formatDate(election.startTime);
  const endLabel = formatDate(election.endTime);

  return (
    <section
      id="election"
      className={cn(
        "mb-20 scroll-mt-24 rounded-xl p-8 md:p-12 lg:mb-24",
        dark
          ? "border border-white/10 bg-zinc-900/60 text-zinc-100"
          : "border border-outline-variant/30 bg-surface-container-low text-zinc-900"
      )}
    >
      <header className="flex flex-col items-center text-center">
        <span
          className={cn(
            "mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
            dark
              ? "border-white/15 bg-white/5 text-accent"
              : "border-outline-variant/40 bg-white text-accent"
          )}
        >
          <ShieldCheck className="h-3 w-3" aria-hidden /> Election & ballot
        </span>
        <h2
          className={cn(
            "font-register-display text-3xl font-extrabold tracking-tight sm:text-4xl",
            dark ? "text-white" : "text-zinc-950"
          )}
        >
          {election.title}
        </h2>
        {election.description?.trim() ? (
          <p
            className={cn(
              "mt-4 max-w-2xl whitespace-pre-wrap font-register-body text-base leading-relaxed",
              dark ? "text-zinc-300" : "text-on-surface-variant"
            )}
          >
            {election.description}
          </p>
        ) : null}
        <p
          className={cn(
            "mt-4 text-xs font-semibold uppercase tracking-[0.18em]",
            dark ? "text-zinc-400" : "text-on-surface-variant"
          )}
        >
          Ballot window · {startLabel} → {endLabel}
        </p>

        <BallotCta election={election} dark={dark} />

        {hasInstructions ? (
          <button
            type="button"
            onClick={() => setInstructionsOpen(true)}
            className={cn(
              "mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition",
              dark
                ? "border-white/20 bg-white/5 text-zinc-200 hover:border-accent/60 hover:text-white"
                : "border-outline-variant/60 bg-white text-zinc-700 hover:border-accent/70 hover:text-zinc-950"
            )}
            aria-haspopup="dialog"
            aria-expanded={instructionsOpen}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> How to vote
          </button>
        ) : null}
      </header>

      <div className="mt-10 space-y-10">
        {election.positions.map((position, idx) => (
          <PositionBlock
            key={position.id}
            position={position}
            index={idx}
            dark={dark}
            onProfile={(candidate) =>
              setModalCandidate({ candidate, positionTitle: position.title })
            }
          />
        ))}
      </div>

      <Modal
        open={modalCandidate != null}
        title={modalCandidate ? `${modalCandidate.candidate.name}` : ""}
        subtitle={
          modalCandidate
            ? `Candidate for ${modalCandidate.positionTitle}${
                modalCandidate.candidate.role?.trim() ? ` · ${modalCandidate.candidate.role}` : ""
              }`
            : undefined
        }
        size="lg"
        onClose={() => setModalCandidate(null)}
      >
        {modalCandidate ? (
          <CandidateProfileBody candidate={modalCandidate.candidate} />
        ) : null}
      </Modal>

      <Modal
        open={instructionsOpen}
        title="How to vote"
        subtitle={election.title}
        size="md"
        onClose={() => setInstructionsOpen(false)}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border-l-4 border-accent/80 bg-amber-50/70 p-4 text-sm leading-relaxed text-zinc-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            <p className="whitespace-pre-wrap font-register-body">{trimmedInstructions}</p>
          </div>
          <p className="text-xs text-zinc-500">
            Ballot window · {formatDate(election.startTime)} → {formatDate(election.endTime)}
          </p>
        </div>
      </Modal>
    </section>
  );
}

function PositionBlock({
  position,
  index,
  dark,
  onProfile
}: {
  position: PublicElectionView["positions"][number];
  index: number;
  dark: boolean;
  onProfile: (candidate: PublicElectionView["positions"][number]["candidates"][number]) => void;
}) {
  const isUnopposed = position.candidates.length === 1;
  if (position.candidates.length === 0) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.2em]",
              dark ? "text-accent" : "text-accent"
            )}
          >
            Position {index + 1}
          </p>
          <h3
            className={cn(
              "mt-1 font-register-display text-2xl font-bold tracking-tight",
              dark ? "text-white" : "text-zinc-950"
            )}
          >
            {position.title}
          </h3>
          {position.description?.trim() ? (
            <p
              className={cn(
                "mt-1.5 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed",
                dark ? "text-zinc-300" : "text-on-surface-variant"
              )}
            >
              {position.description}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
            isUnopposed
              ? dark
                ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30"
                : "bg-amber-100 text-amber-900 ring-1 ring-amber-200"
              : dark
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                : "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
          )}
        >
          {isUnopposed
            ? "Unopposed · confidence vote"
            : `${position.candidates.length} candidates`}
        </span>
      </div>

      <div
        className={
          isUnopposed
            ? "mx-auto grid max-w-md gap-6"
            : position.candidates.length === 2
              ? "mx-auto grid max-w-3xl gap-6 sm:grid-cols-2"
              : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {position.candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            dark={dark}
            onProfile={() => onProfile(candidate)}
          />
        ))}
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  dark,
  onProfile
}: {
  candidate: PublicElectionView["positions"][number]["candidates"][number];
  dark: boolean;
  onProfile: () => void;
}) {
  const excerpt = candidate.bio?.trim() ? excerptText(candidate.bio.trim(), 160) : "";
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl shadow-sm transition",
        dark
          ? "border border-white/10 bg-zinc-900/80 hover:border-white/20"
          : "border border-outline-variant/30 bg-white hover:shadow-md"
      )}
    >
      <div className={cn("relative aspect-[4/3] w-full", dark ? "bg-zinc-800" : "bg-zinc-100")}>
        <CandidateAvatar
          photoUrl={candidate.photoUrl}
          name={candidate.name}
          className="absolute inset-0"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h4
          className={cn(
            "font-register-display text-lg font-semibold",
            dark ? "text-white" : "text-zinc-950"
          )}
        >
          {candidate.name}
        </h4>
        {candidate.role?.trim() ? (
          <p
            className={cn(
              "mt-1 text-[10px] font-bold uppercase tracking-[0.18em]",
              dark ? "text-accent" : "text-accent"
            )}
          >
            {candidate.role}
          </p>
        ) : null}
        {excerpt ? (
          <p
            className={cn(
              "mt-3 text-sm leading-relaxed",
              dark ? "text-zinc-300" : "text-on-surface-variant"
            )}
          >
            {excerpt}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
          <button
            type="button"
            onClick={onProfile}
            className={cn(
              "text-xs font-bold uppercase tracking-[0.16em] transition hover:opacity-70",
              dark ? "text-accent" : "text-accent"
            )}
          >
            View profile
          </button>
          {candidate.resourceUrl?.trim() ? (
            <a
              href={candidate.resourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-1 text-xs font-semibold transition hover:underline",
                dark ? "text-zinc-300" : "text-on-surface-variant"
              )}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
              {candidate.resourceName?.trim() || "Manifesto"}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CandidateProfileBody({
  candidate
}: {
  candidate: PublicElectionView["positions"][number]["candidates"][number];
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
      <div className="aspect-square overflow-hidden rounded-xl bg-zinc-100">
        <CandidateAvatar photoUrl={candidate.photoUrl} name={candidate.name} className="h-full w-full" />
      </div>
      <div className="min-w-0 space-y-4">
        {candidate.role?.trim() ? (
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{candidate.role}</p>
        ) : null}
        {candidate.bio?.trim() ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {candidate.bio}
          </p>
        ) : (
          <p className="text-sm italic text-zinc-500">No biography provided.</p>
        )}
        {candidate.resourceUrl?.trim() ? (
          <a
            href={candidate.resourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-800 transition hover:bg-zinc-50"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Download {candidate.resourceName?.trim() || "supporting document"}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function CandidateAvatar({
  photoUrl,
  name,
  className
}: {
  photoUrl: string | null;
  name: string;
  className?: string;
}) {
  if (photoUrl?.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`Portrait of ${name}`}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-600 to-zinc-900 text-3xl font-bold text-white",
        className
      )}
    >
      {initials || "?"}
    </span>
  );
}

function BallotCta({ election, dark }: { election: PublicElectionView; dark: boolean }) {
  if (election.isOpen) {
    return (
      <Link
        href={election.ballotHref}
        className={cn(
          "mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition",
          dark
            ? "bg-white text-zinc-950 hover:bg-zinc-100"
            : "bg-zinc-950 text-white hover:opacity-90"
        )}
      >
        <Vote className="h-4 w-4" aria-hidden />
        Cast your ballot
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    );
  }
  return (
    <span
      aria-disabled
      className={cn(
        "mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold opacity-70",
        dark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-700"
      )}
    >
      <X className="h-4 w-4" aria-hidden />
      Ballot opens at the scheduled window
    </span>
  );
}

function excerptText(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max).trim()}…`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}
