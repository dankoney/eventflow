"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { ZoomPasscodeRefreshModal } from "@/components/events/ZoomPasscodeRefreshModal";
import { cn } from "@/lib/utils";

type Props = {
  eventId: string;
  canManage: boolean;
  className?: string;
};

/** Opens a modal to choose default vs custom passcode before refreshing Zoom credentials. */
export function EventZoomPasscodeRefreshButton({ eventId, canManage, className }: Props) {
  const [open, setOpen] = useState(false);

  if (!canManage) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Refresh Zoom passcode and join details"
        aria-label="Refresh Zoom passcode"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200/90 bg-white text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900",
          className
        )}
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
      </button>
      <ZoomPasscodeRefreshModal eventId={eventId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
