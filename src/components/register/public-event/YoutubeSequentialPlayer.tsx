"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  ensureYoutubeIframeApi,
  safeDestroyYtPlayer,
  type YtPlayer
} from "@/lib/youtube/iframeApi";
import { cn } from "@/lib/utils";

type Props = {
  videoIds: string[];
  active: boolean;
  className?: string;
  muted?: boolean;
  onVideoEnd?: () => void;
};

/**
 * Plays YouTube videos in order; when the last ends, starts again from the first.
 */
export function YoutubeSequentialPlayer({
  videoIds,
  active,
  className,
  muted = false,
  onVideoEnd
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const indexRef = useRef(0);
  const onVideoEndRef = useRef(onVideoEnd);
  const mutedRef = useRef(muted);

  onVideoEndRef.current = onVideoEnd;
  mutedRef.current = muted;

  const playAt = useCallback((index: number) => {
    const id = videoIds[index];
    const player = playerRef.current;
    if (!id || !player) return;
    try {
      player.loadVideoById({ videoId: id, startSeconds: 0 });
    } catch {
      /* ignore */
    }
  }, [videoIds]);

  useEffect(() => {
    if (!active || videoIds.length === 0) return;

    let cancelled = false;
    const hostEl = hostRef.current;

    void ensureYoutubeIframeApi().then(() => {
      if (cancelled || !hostEl || !window.YT) return;

      safeDestroyYtPlayer(playerRef.current);
      playerRef.current = null;
      indexRef.current = 0;

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const firstId = videoIds[0]!;
      const loopSingle = mutedRef.current && videoIds.length === 1;

      playerRef.current = new window.YT.Player(hostEl, {
        videoId: firstId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          fs: mutedRef.current ? 0 : 1,
          controls: mutedRef.current ? 0 : 1,
          disablekb: mutedRef.current ? 1 : 0,
          mute: mutedRef.current ? 1 : 0,
          loop: loopSingle ? 1 : 0,
          ...(loopSingle ? { playlist: firstId } : {}),
          ...(origin ? { origin } : {})
        },
        events: {
          onStateChange: (event) => {
            if (cancelled || event.data !== window.YT!.PlayerState.ENDED) return;
            if (videoIds.length === 1) {
              if (onVideoEndRef.current) {
                window.setTimeout(() => onVideoEndRef.current?.(), 0);
                return;
              }
              try {
                playerRef.current?.seekTo(0, true);
                playerRef.current?.playVideo();
              } catch {
                /* ignore */
              }
              return;
            }
            const next = (indexRef.current + 1) % videoIds.length;
            indexRef.current = next;
            playAt(next);
          }
        }
      });
    });

    return () => {
      cancelled = true;
      safeDestroyYtPlayer(playerRef.current);
      playerRef.current = null;
    };
  }, [active, playAt, videoIds]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !active) return;
    try {
      if (muted) player.mute();
      else player.unMute();
    } catch {
      /* ignore */
    }
  }, [active, muted]);

  if (!active || videoIds.length === 0) return null;

  return <div ref={hostRef} className={cn("h-full w-full", className)} />;
}
