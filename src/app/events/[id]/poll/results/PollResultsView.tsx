"use client";

import { CheckCircle2, Crown, Minus, ThumbsDown, ThumbsUp, Users2 } from "lucide-react";

import type { PollPositionTally } from "@/lib/db/pollTally";
import { cn } from "@/lib/utils";

type PollResultsViewProps = {
  title: string;
  description: string | null;
  summary: string | null;
  publishedAt: string;
  turnout: { totalGuests: number; ballotsCast: number; turnoutPct: number };
  positions: PollPositionTally[];
  accent: string;
};

/**
 * Read-only results presentation used on the public `/events/[id]/poll/results` page.
 * Renders winner badges, per-candidate share bars, and confidence outcomes. No vote
 * counts are linked to individual voters — this is summary tally data only.
 */
export function PollResultsView({
  title,
  description,
  summary,
  publishedAt,
  turnout,
  positions,
  accent
}: PollResultsViewProps) {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-8 sm:py-14">
      <header className="mb-8 text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ background: `${accent}1a`, color: accent }}
        >
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Official results
        </span>
        <h1 className="mt-4 font-[Manrope,Inter,system-ui] text-3xl font-extrabold tracking-tight text-[#1b1b1b] sm:text-4xl">
          {title}
        </h1>
        {description?.trim() ? (
          <p className="mx-auto mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
            {description}
          </p>
        ) : null}
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5e5e5e]">
          Published {formatStamp(publishedAt)}
        </p>
      </header>

      <section
        className="mb-10 grid gap-4 sm:grid-cols-3"
        aria-label="Turnout statistics"
      >
        <StatTile
          icon={<Users2 className="h-4 w-4" aria-hidden />}
          label="Eligible voters"
          value={turnout.totalGuests.toLocaleString()}
        />
        <StatTile
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          label="Ballots cast"
          value={turnout.ballotsCast.toLocaleString()}
        />
        <StatTile
          icon={<TurnoutIcon pct={turnout.turnoutPct} accent={accent} />}
          label="Turnout"
          value={`${turnout.turnoutPct}%`}
        />
      </section>

      {summary?.trim() ? (
        <div className="mb-10 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-5 text-sm leading-relaxed text-[#1b1b1b] shadow-sm">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5e5e5e]">
            Note from the organizers
          </p>
          <p className="whitespace-pre-wrap">{summary}</p>
        </div>
      ) : null}

      <div className="space-y-6">
        {positions.map((position, idx) => (
          <PositionResultCard
            key={position.positionId}
            position={position}
            index={idx}
            accent={accent}
          />
        ))}
      </div>
    </main>
  );
}

function PositionResultCard({
  position,
  index,
  accent
}: {
  position: PollPositionTally;
  index: number;
  accent: string;
}) {
  if (position.isUnopposed) {
    return <UnopposedCard position={position} index={index} accent={accent} />;
  }
  return <OpposedCard position={position} index={index} accent={accent} />;
}

function OpposedCard({
  position,
  index,
  accent
}: {
  position: PollPositionTally;
  index: number;
  accent: string;
}) {
  const sorted = [...position.candidates].sort((a, b) => b.votes - a.votes);
  const highestVotes = sorted[0]?.votes ?? 0;
  const winnerCount = highestVotes > 0 ? sorted.filter((c) => c.votes === highestVotes).length : 0;
  const isDraw = winnerCount > 1;

  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm sm:p-8">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5e5e5e]">
            Position {index + 1}
          </p>
          <h3 className="mt-1 font-[Manrope,Inter,system-ui] text-xl font-extrabold tracking-tight text-[#1b1b1b] sm:text-2xl">
            {position.title}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-700">
          {position.totalVotes.toLocaleString()} cast
        </span>
      </header>

      <ol className="space-y-3">
        {sorted.map((c, i) => {
          const isLeader = highestVotes > 0 && c.votes === highestVotes;
          return (
            <li
              key={c.candidateId}
              className={cn(
                "rounded-xl border p-3 transition",
                isLeader && !isDraw
                  ? "border-amber-300/70 bg-amber-50"
                  : "border-outline-variant/40 bg-white"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="truncate text-sm font-semibold text-[#1b1b1b]">{c.name}</span>
                  {isLeader && !isDraw ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-900">
                      <Crown className="h-3 w-3" aria-hidden /> Winner
                    </span>
                  ) : null}
                  {isLeader && isDraw ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-900">
                      Tied
                    </span>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-[#5e5e5e]">
                  {c.votes.toLocaleString()} · {c.sharePct}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${c.sharePct}%`, background: isLeader ? "#b45309" : accent }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function UnopposedCard({
  position,
  index,
  accent
}: {
  position: PollPositionTally;
  index: number;
  accent: string;
}) {
  const conf = position.confidence ?? { yes: 0, no: 0, abstain: 0 };
  const total = conf.yes + conf.no + conf.abstain;
  const yesPct = total > 0 ? Math.round((conf.yes / total) * 100) : 0;
  const noPct = total > 0 ? Math.round((conf.no / total) * 100) : 0;
  const abstainPct = total > 0 ? Math.round((conf.abstain / total) * 100) : 0;
  const passed = conf.yes > conf.no;
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm sm:p-8">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5e5e5e]">
            Position {index + 1}
          </p>
          <h3 className="mt-1 font-[Manrope,Inter,system-ui] text-xl font-extrabold tracking-tight text-[#1b1b1b] sm:text-2xl">
            {position.title}
          </h3>
          <p className="mt-1 text-xs font-medium text-[#5e5e5e]">
            Unopposed · {position.candidates[0]?.name ?? "single candidate"} · confidence vote
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
            passed
              ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
              : "bg-rose-100 text-rose-900 ring-1 ring-rose-200"
          )}
        >
          {passed ? "Confirmed" : "Not confirmed"}
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <ConfidenceTile
          icon={<ThumbsUp className="h-4 w-4" aria-hidden />}
          label="Yes"
          votes={conf.yes}
          pct={yesPct}
          color="#15803d"
          accent={accent}
        />
        <ConfidenceTile
          icon={<ThumbsDown className="h-4 w-4" aria-hidden />}
          label="No"
          votes={conf.no}
          pct={noPct}
          color="#b91c1c"
          accent={accent}
        />
        <ConfidenceTile
          icon={<Minus className="h-4 w-4" aria-hidden />}
          label="Abstain"
          votes={conf.abstain}
          pct={abstainPct}
          color="#475569"
          accent={accent}
        />
      </div>
    </article>
  );
}

function ConfidenceTile({
  icon,
  label,
  votes,
  pct,
  color
}: {
  icon: React.ReactNode;
  label: string;
  votes: number;
  pct: number;
  color: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5e5e5e]">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums text-[#1b1b1b]">
        {votes.toLocaleString()}
        <span className="ml-2 text-sm font-semibold text-[#5e5e5e]">· {pct}%</span>
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5e5e5e]">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums text-[#1b1b1b]">{value}</p>
    </div>
  );
}

function TurnoutIcon({ pct, accent }: { pct: number; accent: string }) {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: accent, opacity: Math.max(0.4, Math.min(1, pct / 100)) }}
      />
    </span>
  );
}

function formatStamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}
