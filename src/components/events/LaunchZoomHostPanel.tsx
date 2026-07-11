"use client";

import { ExternalLink, Video } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

type Props = {
  zoomStartUrl: string | null;
  zoomJoinUrl: string | null;
  canHost: boolean;
  hasZoomRoom: boolean;
  variant?: "inline" | "rail" | "card";
};

export function LaunchZoomHostPanel({
  zoomStartUrl,
  zoomJoinUrl,
  canHost,
  hasZoomRoom,
  variant = "inline"
}: Props) {
  const [error, setError] = useState<string | null>(null);

  if (!canHost || !hasZoomRoom) return null;

  const shellClass =
    variant === "rail"
      ? "rounded-2xl border border-violet-900/40 bg-gradient-to-b from-violet-950 to-zinc-950 p-4 text-violet-50 shadow-lg shadow-black/30 sm:p-5"
      : variant === "card"
        ? "rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-sm"
        : "mt-6 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-sm";

  const titleClass =
    variant === "rail" ? "text-sm font-bold text-violet-100" : "text-sm font-bold text-violet-950";
  const subClass =
    variant === "rail" ? "mt-0.5 text-xs text-violet-200/80" : "mt-0.5 text-xs text-violet-900/75";

  function startMeeting() {
    const url = zoomStartUrl?.trim() || zoomJoinUrl?.trim();
    if (!url) {
      setError("No Zoom host link is available for this event. Refresh Zoom credentials on the event page.");
      return;
    }
    setError(null);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={shellClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-violet-700" aria-hidden />
          <div>
            <h4 className={titleClass}>Start the meeting</h4>
            <p className={subClass}>
              Opens Zoom as host using the link provisioned for this event.
            </p>
          </div>
        </div>
        <Button type="button" onClick={() => startMeeting()}>
          <ExternalLink className="h-4 w-4" aria-hidden />
          Start in Zoom
        </Button>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
