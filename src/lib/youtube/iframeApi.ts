export type YtPlayer = {
  destroy: () => void;
  loadVideoById: (args: { videoId: string; startSeconds?: number }) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted?: () => boolean;
};

export type YtApi = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YtPlayer }) => void;
        onStateChange?: (e: { data: number }) => void;
      };
    }
  ) => YtPlayer;
  PlayerState: { ENDED: number };
};

declare global {
  interface Window {
    YT?: YtApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<void> | null = null;

export function ensureYoutubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (!apiReady) {
    apiReady = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }
  return apiReady;
}

export function safeDestroyYtPlayer(player: YtPlayer | null) {
  if (!player) return;
  try {
    player.stopVideo();
  } catch {
    /* ignore */
  }
  try {
    player.destroy();
  } catch {
    /* already destroyed */
  }
}

export function safeStopYtPlayer(player: YtPlayer | null) {
  if (!player) return;
  try {
    player.stopVideo();
  } catch {
    /* ignore */
  }
}
