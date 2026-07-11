"use client";

import { useEffect, useRef, useState } from "react";

import {
  ensureYoutubeIframeApi,
  safeDestroyYtPlayer,
  safeStopYtPlayer,
  type YtPlayer
} from "@/lib/youtube/iframeApi";
import { cn } from "@/lib/utils";

function applyMute(player: YtPlayer, muted: boolean) {
  try {
    if (muted) player.mute();
    else player.unMute();
  } catch {
    /* player not ready */
  }
}

function concealHost(el: HTMLDivElement | null) {
  if (!el) return;
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.style.opacity = "0";
}

function revealHost(el: HTMLDivElement | null) {
  if (!el) return;
  el.style.visibility = "";
  el.style.pointerEvents = "";
  el.style.opacity = "";
}

type Props = {
  videoId: string | null;
  playing: boolean;
  muted: boolean;
  className?: string;
  onEnded?: () => void;
};

/**
 * Long-lived YT embed for mixed spotlight playlists.
 * Stays mounted between clips; hidden + stopped when native video plays.
 */
export function SpotlightYoutubePlayer({ videoId, playing, muted, className, onEnded }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const readyRef = useRef(false);
  const endedLatchRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  const mutedRef = useRef(muted);
  const playingRef = useRef(playing);
  const videoIdRef = useRef(videoId);
  const [concealed, setConcealed] = useState(false);

  onEndedRef.current = onEnded;
  mutedRef.current = muted;
  playingRef.current = playing;
  videoIdRef.current = videoId;

  function loadClip(id: string) {
    const player = playerRef.current;
    if (!player || !readyRef.current || !id) return;
    endedLatchRef.current = false;
    setConcealed(false);
    revealHost(hostRef.current);
    try {
      player.loadVideoById({ videoId: id, startSeconds: 0 });
      applyMute(player, mutedRef.current);
    } catch {
      /* ignore */
    }
  }

  function stopAndConceal() {
    endedLatchRef.current = true;
    setConcealed(true);
    concealHost(hostRef.current);
    safeStopYtPlayer(playerRef.current);
  }

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    void ensureYoutubeIframeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT) return;

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const initialId = videoIdRef.current ?? undefined;

      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId: initialId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: playingRef.current && initialId ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 0,
          controls: 0,
          disablekb: 1,
          mute: mutedRef.current ? 1 : 0,
          ...(origin ? { origin } : {})
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            readyRef.current = true;
            if (playingRef.current && videoIdRef.current) {
              loadClip(videoIdRef.current);
            } else {
              stopAndConceal();
            }
          },
          onStateChange: (event) => {
            if (cancelled || !playingRef.current) return;
            if (event.data !== window.YT!.PlayerState.ENDED) return;
            if (endedLatchRef.current) return;

            stopAndConceal();
            onEndedRef.current?.();
          }
        }
      });
    });

    return () => {
      cancelled = true;
      readyRef.current = false;
      const player = playerRef.current;
      playerRef.current = null;
      window.setTimeout(() => safeDestroyYtPlayer(player), 0);
    };
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    if (!playing || !videoId) {
      stopAndConceal();
      return;
    }
    loadClip(videoId);
  }, [playing, videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current || !playing) return;
    applyMute(player, muted);
  }, [muted, playing]);

  return (
    <div
      ref={hostRef}
      className={cn(
        "h-full w-full [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full",
        (concealed || !playing) && "pointer-events-none",
        className
      )}
      aria-hidden={concealed || !playing}
    />
  );
}
