"use client";

import { Loader2, Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

import type { SpotlightPlaybackPhase } from "./spotlightPlayback";

type Props = {
  phase: SpotlightPlaybackPhase;
  onPlay: () => void;
  onPause: () => void;
  className?: string;
  playLabel?: string;
  pauseLabel?: string;
  cancelLabel?: string;
};

export function SpotlightPlaybackControls({
  phase,
  onPlay,
  onPause,
  className,
  playLabel = "Play video",
  pauseLabel = "Pause video",
  cancelLabel = "Cancel video playback"
}: Props) {
  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={onPlay}
        className={cn(
          "pe-spotlight-play-btn flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--pe-primary)] text-[color:var(--pe-on-primary)] shadow-lg transition-transform hover:scale-105 sm:h-20 sm:w-20",
          className
        )}
        aria-label={playLabel}
      >
        <Play className="h-8 w-8 fill-current sm:h-10 sm:w-10" aria-hidden />
      </button>
    );
  }

  if (phase === "buffering") {
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white shadow-lg backdrop-blur-md sm:h-20 sm:w-20"
          role="status"
          aria-live="polite"
          aria-label="Loading video"
        >
          <Loader2 className="h-9 w-9 animate-spin sm:h-10 sm:w-10" aria-hidden />
        </div>
        <button
          type="button"
          onClick={onPause}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black/70"
          aria-label={cancelLabel}
        >
          <Pause className="h-5 w-5" aria-hidden />
        </button>
      </div>
    );
  }

  if (phase === "playing") {
    return (
      <button
        type="button"
        onClick={onPause}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black/70",
          className
        )}
        aria-label={pauseLabel}
      >
        <Pause className="h-5 w-5" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      className={cn(
        "pe-spotlight-play-btn flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--pe-primary)] text-[color:var(--pe-on-primary)] shadow-lg transition-transform hover:scale-105 sm:h-20 sm:w-20",
        className
      )}
      aria-label={playLabel}
    >
      <Play className="h-8 w-8 fill-current sm:h-10 sm:w-10" aria-hidden />
    </button>
  );
}
