"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  urls: string[];
  className?: string;
  /** Start muted for autoplay policy compliance. */
  defaultMuted?: boolean;
};

/**
 * Self-hosted spotlight background — loops on load with floating mute/unmute control.
 */
export function SpotlightBackgroundVideo({ urls, className, defaultMuted = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(defaultMuted);

  const src = urls[index] ?? urls[0] ?? "";

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    el.muted = muted;
    if (!muted) {
      void el.play().catch(() => undefined);
    }
  }, [muted, src]);

  if (!src) return null;

  return (
    <div className={cn("relative h-full w-full", className)}>
      <video
        ref={videoRef}
        key={`${index}-${src}`}
        className="h-full w-full object-cover"
        src={src}
        autoPlay
        loop={urls.length <= 1}
        muted={muted}
        playsInline
        preload="metadata"
        onEnded={() => {
          if (urls.length > 1) setIndex((i) => (i + 1) % urls.length);
        }}
      />
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="absolute bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white shadow-lg backdrop-blur-md transition hover:bg-black/70 hover:scale-105"
        aria-label={muted ? "Unmute video" : "Mute video"}
        aria-pressed={!muted}
      >
        {muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  );
}
