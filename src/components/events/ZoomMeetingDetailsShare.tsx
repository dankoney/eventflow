"use client";

import { Copy, Share2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type ZoomMeetingDetailsShareProps = {
  eventName: string;
  sessionLabel: string;
  meetingId: string | null;
  passcode: string | null;
  joinUrl: string;
};

function buildDetailsText(params: ZoomMeetingDetailsShareProps): string {
  const lines = [
    params.eventName,
    `Zoom ${params.sessionLabel}`,
    params.meetingId ? `Meeting ID: ${params.meetingId}` : null,
    params.passcode ? `Passcode: ${params.passcode}` : null,
    `Join URL: ${params.joinUrl}`
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

export function ZoomMeetingDetailsShare({
  eventName,
  sessionLabel,
  meetingId,
  passcode,
  joinUrl
}: ZoomMeetingDetailsShareProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailsText = useMemo(
    () => buildDetailsText({ eventName, sessionLabel, meetingId, passcode, joinUrl }),
    [eventName, sessionLabel, meetingId, passcode, joinUrl]
  );

  const copyDetails = useCallback(async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(detailsText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, [detailsText]);

  const shareDetails = useCallback(async () => {
    setError(null);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: eventName,
          text: detailsText,
          url: joinUrl
        });
      } catch (e) {
        const err = e as { name?: string };
        if (err?.name === "AbortError") return;
        await copyDetails();
      }
    } else {
      await copyDetails();
    }
  }, [copyDetails, detailsText, eventName, joinUrl]);

  const iconBtn =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={joinUrl}
          target="_blank"
          rel="noreferrer"
          className="break-all text-sky-700 underline"
        >
          Open join link
        </a>
        <button
          type="button"
          className={cn(iconBtn)}
          onClick={() => void copyDetails()}
          aria-label="Copy meeting details including link"
          title="Copy meeting details"
        >
          <Copy className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          className={cn(iconBtn)}
          onClick={() => void shareDetails()}
          aria-label="Share meeting details including link"
          title="Share meeting details"
        >
          <Share2 className="h-4 w-4" aria-hidden />
        </button>
        {copied ? <span className="text-xs font-medium text-emerald-700">Copied</span> : null}
      </div>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
