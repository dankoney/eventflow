"use client";

import { Check, Copy, ExternalLink, Vote } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type PollDirectLinkCardProps = {
  pollUrl: string | null;
  isActive: boolean;
};

/**
 * Compact share card for the public voting URL. Identical surface used on both the
 * admin Poll tab and the Publish tab (re-rendered there as `PollDirectLinkCard` so
 * the wording stays consistent).
 */
export function PollDirectLinkCard({ pollUrl, isActive }: PollDirectLinkCardProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!pollUrl) return;
    try {
      await navigator.clipboard.writeText(pollUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard write rejected — fail silently, button just doesn't toggle */
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        <Vote className="h-3.5 w-3.5" aria-hidden />
        Poll direct link
      </div>
      <h3 className="mt-2 text-base font-semibold text-zinc-900">Share the ballot</h3>
      <p className="mt-1 text-sm text-zinc-600">
        Send this address to staff / members. Each visitor verifies their identity by email + SMS
        before the ballot loads.
      </p>

      {pollUrl ? (
        <code
          className={cn(
            "mt-4 block w-full min-w-0 break-all rounded-lg border px-3 py-2.5 font-mono text-xs",
            isActive
              ? "border-zinc-200 bg-zinc-50 text-zinc-800"
              : "border-amber-200 bg-amber-50 text-amber-950"
          )}
          title={pollUrl}
        >
          {pollUrl}
        </code>
      ) : (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          A public URL is unavailable — set <code>NEXTAUTH_URL</code> or <code>PUBLIC_APP_URL</code> in
          this workspace's environment so the share link can resolve.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!pollUrl}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copied ? "Copied" : "Copy link"}
        </button>
        {pollUrl ? (
          <a
            href={pollUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open
          </a>
        ) : null}
      </div>

      {pollUrl && !isActive ? (
        <p className="mt-3 text-[11px] uppercase tracking-wider text-amber-700">
          Voting is currently paused — visitors see a "closed" notice until you flip the master switch.
        </p>
      ) : null}
    </div>
  );
}
