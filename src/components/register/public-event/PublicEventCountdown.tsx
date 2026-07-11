"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

type PublicEventCountdownProps = {
  startIso: string;
  endIso: string;
  dark: boolean;
  /** Large light-on-dark blocks used in the public hero (light theme summit layout). */
  heroSleek?: boolean;
};

export function PublicEventCountdown({ startIso, endIso, dark, heroSleek }: PublicEventCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const state = useMemo(() => {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return { phase: "unknown" as const };
    if (now >= end) return { phase: "ended" as const };
    if (now >= start) return { phase: "live" as const, target: end, label: "Ends in" };
    return { phase: "upcoming" as const, target: start, label: "Starts in" };
  }, [startIso, endIso, now]);

  const remaining = useMemo(() => {
    if (state.phase !== "upcoming" && state.phase !== "live") return null;
    const ms = Math.max(0, state.target - now);
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return { days, hours, minutes, seconds, label: state.label };
  }, [state, now]);

  const box = cn(
    "flex min-w-[3.25rem] flex-col items-center justify-center rounded-xl border px-2 py-2.5 sm:min-w-[4rem] sm:px-3 sm:py-3",
    dark ? "border-white/10 bg-white/[0.06]" : "border-zinc-200/80 bg-white/90 shadow-sm"
  );
  const num = cn("text-lg font-bold tabular-nums sm:text-2xl", dark ? "text-white" : "text-zinc-900");
  const unit = cn("mt-0.5 text-[10px] font-semibold uppercase tracking-wider", dark ? "text-zinc-400" : "text-zinc-500");

  if (state.phase === "unknown") return null;
  if (state.phase === "ended") {
    return (
      <div
        className={cn(
          "rounded-2xl border px-4 py-3 text-center text-sm font-medium",
          heroSleek
            ? "border-white/20 bg-black/30 text-white backdrop-blur-sm"
            : dark
              ? "border-white/10 bg-white/[0.06] text-zinc-200"
              : "border-zinc-200 bg-zinc-50 text-zinc-700"
        )}
      >
        This program has concluded. Thank you for attending.
      </div>
    );
  }

  if (heroSleek && remaining && (state.phase === "upcoming" || state.phase === "live")) {
    const colon = (
      <div
        className={cn(
          "self-start pt-1 font-register-display text-4xl font-semibold",
          dark ? "text-white/35" : "text-white/40"
        )}
        aria-hidden
      >
        :
      </div>
    );
    const unitHero = cn(
      "text-[10px] font-bold uppercase tracking-widest",
      dark ? "text-zinc-400" : "text-white/60"
    );
    const numHero = cn(
      "font-register-display text-5xl font-extrabold tabular-nums",
      dark ? "text-zinc-100" : "text-white"
    );
    return (
      <div className="mb-8 flex flex-wrap items-start gap-6 sm:gap-8">
        {remaining.days > 0 ? (
          <>
            <div className="text-center">
              <div className={cn(numHero, "mb-1")}>{remaining.days}</div>
              <div className={unitHero}>Days</div>
            </div>
            {colon}
          </>
        ) : null}
        <div className="text-center">
          <div className={cn(numHero, "mb-1")}>{pad(remaining.hours)}</div>
          <div className={unitHero}>Hours</div>
        </div>
        {colon}
        <div className="text-center">
          <div className={cn(numHero, "mb-1")}>{pad(remaining.minutes)}</div>
          <div className={unitHero}>Mins</div>
        </div>
        {colon}
        <div className="text-center">
          <div className={cn(numHero, "mb-1")}>{pad(remaining.seconds)}</div>
          <div className={unitHero}>Sec</div>
        </div>
      </div>
    );
  }

  if (state.phase === "live") {
    return (
      <div className="space-y-3">
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest",
            dark ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-900"
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live now
        </div>
        {remaining ? (
          <div>
            <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wider", dark ? "text-zinc-400" : "text-zinc-500")}>
              {remaining.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {remaining.days > 0 ? (
                <div className={box}>
                  <span className={num}>{remaining.days}</span>
                  <span className={unit}>Days</span>
                </div>
              ) : null}
              <div className={box}>
                <span className={num}>{pad(remaining.hours)}</span>
                <span className={unit}>Hrs</span>
              </div>
              <div className={box}>
                <span className={num}>{pad(remaining.minutes)}</span>
                <span className={unit}>Min</span>
              </div>
              <div className={box}>
                <span className={num}>{pad(remaining.seconds)}</span>
                <span className={unit}>Sec</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (!remaining) return null;

  return (
    <div>
      <p className={cn("mb-3 text-xs font-semibold uppercase tracking-wider", dark ? "text-zinc-400" : "text-zinc-500")}>
        {remaining.label}
      </p>
      <div className="flex flex-wrap gap-2">
        {remaining.days > 0 ? (
          <div className={box}>
            <span className={num}>{remaining.days}</span>
            <span className={unit}>Days</span>
          </div>
        ) : null}
        <div className={box}>
          <span className={num}>{pad(remaining.hours)}</span>
          <span className={unit}>Hours</span>
        </div>
        <div className={box}>
          <span className={num}>{pad(remaining.minutes)}</span>
          <span className={unit}>Min</span>
        </div>
        <div className={box}>
          <span className={num}>{pad(remaining.seconds)}</span>
          <span className={unit}>Sec</span>
        </div>
      </div>
    </div>
  );
}
