"use client";

import { Check, Copy, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

type WalkInCheckInBoothCardProps = {
  boothUrl: string | null;
  allowFlashEntry: boolean;
  boothOpen: boolean;
  boothStatusMessage: string;
  isOnsiteEvent: boolean;
};

export function WalkInCheckInBoothCard({
  boothUrl,
  allowFlashEntry,
  boothOpen,
  boothStatusMessage,
  isOnsiteEvent
}: WalkInCheckInBoothCardProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOnsiteEvent) return null;

  async function copy() {
    if (!boothUrl) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(boothUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-xs font-black text-white">
          IN
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Walk-in check-in booth</h2>
            {boothUrl ? (
              boothOpen ? (
                <Link
                  href={boothUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                  title="Open kiosk in a new tab"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  Open booth
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 shadow-sm">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  Booth opens soon
                </span>
              )
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Open this on a tablet at the venue for guests who arrive without pre-registering. They enter an email,
            get checked in immediately, and the screen resets for the next person.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {boothOpen ? (
              <>
                <span className="font-medium text-emerald-800">Booth is open</span> — {boothStatusMessage} Walk-ins{" "}
                {allowFlashEntry ? "allowed" : "disabled"}.
              </>
            ) : (
              <>
                <span className="font-medium text-amber-900">Booth not open yet</span> — {boothStatusMessage}
              </>
            )}
          </p>
          {boothUrl ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code
                className="block min-w-0 flex-1 truncate rounded-lg border border-emerald-200/80 bg-white px-3 py-2.5 font-mono text-sm text-slate-800"
                title={boothUrl}
              >
                {boothUrl}
              </code>
              <Button type="button" variant="secondary" className="shrink-0" onClick={() => void copy()}>
                {copied ? (
                  <>
                    <Check className="mr-1.5 inline h-4 w-4" aria-hidden />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 inline h-4 w-4" aria-hidden />
                    Copy booth URL
                  </>
                )}
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-amber-800">
              Set <span className="font-mono">NEXTAUTH_URL</span> or <span className="font-mono">PUBLIC_APP_URL</span> to
              generate the booth link.
            </p>
          )}
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
