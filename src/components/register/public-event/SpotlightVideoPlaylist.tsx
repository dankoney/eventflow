"use client";

import { Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SpotlightPlaylistItem } from "@/lib/public-event/spotlightPlaylist";
import { cn } from "@/lib/utils";

import { SpotlightYoutubePlayer } from "./SpotlightYoutubePlayer";

type Props = {
  playlist: SpotlightPlaylistItem[];
  autoplay: boolean;
  className?: string;
  startActive?: boolean;
  onActiveChange?: (active: boolean) => void;
};

function MuteToggle({
  muted,
  onToggle,
  className
}: {
  muted: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black/70",
        className
      )}
      aria-label={muted ? "Unmute video" : "Mute video"}
      aria-pressed={!muted}
    >
      {muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
    </button>
  );
}

export function SpotlightVideoPlaylist({
  playlist,
  autoplay,
  className,
  startActive,
  onActiveChange
}: Props) {
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(autoplay && playlist.length > 0);
  const [muted, setMuted] = useState(autoplay);
  const videoRef = useRef<HTMLVideoElement>(null);
  const advancingRef = useRef(false);
  const playlistLenRef = useRef(playlist.length);

  playlistLenRef.current = playlist.length;

  const hasYoutube = useMemo(() => playlist.some((p) => p.type === "youtube"), [playlist]);
  const item = playlist[index] ?? null;
  const showingYoutube = item?.type === "youtube";
  const showingDirect = item?.type === "direct";

  const advance = useCallback(() => {
    if (playlistLenRef.current <= 1 || advancingRef.current) return;
    advancingRef.current = true;
    setIndex((i) => (i + 1) % playlistLenRef.current);
    advancingRef.current = false;
  }, []);

  useEffect(() => {
    setIndex(0);
    setActive(autoplay && playlist.length > 0);
    setMuted(autoplay);
    advancingRef.current = false;
  }, [playlist, autoplay]);

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  useEffect(() => {
    if (startActive) {
      setActive(true);
      if (!autoplay) setMuted(false);
    }
  }, [startActive, autoplay]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !showingDirect) return;
    el.muted = muted;
    void el.play().catch(() => undefined);
  }, [muted, showingDirect, item]);

  if (playlist.length === 0) return null;

  if (!active) {
    return (
      <div className={cn("relative flex h-full w-full items-center justify-center bg-black", className)}>
        <button
          type="button"
          onClick={() => {
            setActive(true);
            if (!autoplay) setMuted(false);
          }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--pe-primary)] text-[color:var(--pe-on-primary)] shadow-lg transition hover:scale-105 sm:h-20 sm:w-20"
          aria-label="Play spotlight video"
        >
          <Play className="h-8 w-8 fill-current sm:h-10 sm:w-10" aria-hidden />
        </button>
      </div>
    );
  }

  const youtubeId = item?.type === "youtube" ? item.id : null;

  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      {hasYoutube ? (
        <SpotlightYoutubePlayer
          videoId={youtubeId}
          playing={showingYoutube}
          muted={muted}
          className="absolute inset-0 z-[1] h-full w-full object-cover"
          onEnded={playlist.length > 1 ? advance : undefined}
        />
      ) : null}

      {showingDirect && item?.type === "direct" ? (
        <video
          ref={videoRef}
          key={item.url}
          className="absolute inset-0 z-[2] h-full w-full object-cover"
          src={item.url}
          autoPlay
          loop={playlist.length <= 1}
          muted={muted}
          playsInline
          preload="metadata"
          onEnded={advance}
        />
      ) : null}

      {showingYoutube || showingDirect ? (
        <MuteToggle
          muted={muted}
          onToggle={() => setMuted((m) => !m)}
          className="absolute bottom-4 right-4 z-[60]"
        />
      ) : null}
    </div>
  );
}
