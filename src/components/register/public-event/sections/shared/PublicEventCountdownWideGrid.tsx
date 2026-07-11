"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

type Props = {
  startIso: string;
  endIso: string;
  className?: string;
  /** `bright` = white on gradient bands; `muted` = soft zinc on dark surfaces. */
  tone?: "bright" | "muted";
};

/** Large 4-column countdown — matches Template 2 (Night Edition) structure. */
export function PublicEventCountdownWideGrid({
  startIso,
  endIso,
  className,
  tone = "bright"
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (Number.isNaN(start)) return null;
    const target = now >= end ? end : now >= start ? end : start;
    const ms = Math.max(0, target - now);
    const totalSec = Math.floor(ms / 1000);
    return {
      days: pad(Math.floor(totalSec / 86400)),
      hours: pad(Math.floor((totalSec % 86400) / 3600)),
      minutes: pad(Math.floor((totalSec % 3600) / 60)),
      seconds: pad(totalSec % 60)
    };
  }, [startIso, endIso, now]);

  if (!remaining) return null;

  const muted = tone === "muted";
  const valueClass = muted
    ? "text-3xl font-black leading-none text-zinc-100 sm:text-4xl md:text-5xl"
    : "text-3xl font-black leading-none sm:text-4xl md:text-6xl";
  const labelClass = muted
    ? "mt-2 text-xs font-bold uppercase tracking-widest text-zinc-400"
    : "mt-2 text-xs font-bold uppercase tracking-widest opacity-60";
  const dividerClass = muted ? "border-l border-zinc-600/60" : "border-l border-current/20";

  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-md grid-cols-4 gap-2 sm:max-w-lg sm:gap-4 md:mx-0 md:max-w-xl md:gap-6",
        !muted && className
      )}
    >
      {(
        [
          ["days", remaining.days, "Days"],
          ["hours", remaining.hours, "Hrs"],
          ["min", remaining.minutes, "Min"],
          ["sec", remaining.seconds, "Sec"]
        ] as const
      ).map(([key, val, label], i) => (
        <div
          key={key}
          className={cn(
            "flex flex-col items-center",
            i > 0 && cn(dividerClass, "pl-2 sm:pl-3 md:pl-5")
          )}
        >
          <div className={valueClass}>{val}</div>
          <div className={labelClass}>{label}</div>
        </div>
      ))}
    </div>
  );
}
