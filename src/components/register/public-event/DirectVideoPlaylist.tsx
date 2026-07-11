"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  urls: string[];
  active: boolean;
  className?: string;
  controls?: boolean;
};

/** Sequential .mp4 / .webm playback with loop-all when the list ends. */
export function DirectVideoPlaylist({ urls, active, className, controls = true }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) setIndex(0);
  }, [active, urls.join("\n")]);

  if (!active || urls.length === 0) return null;

  const src = urls[index] ?? urls[0];
  if (!src) return null;

  return (
    <video
      key={`${index}-${src}`}
      className={cn("h-full w-full object-contain", className)}
      src={src}
      autoPlay
      playsInline
      controls={controls}
      muted={!controls}
      preload="metadata"
      onEnded={() => setIndex((i) => (i + 1) % urls.length)}
    />
  );
}
