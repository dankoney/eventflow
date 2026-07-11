"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type CommandCenterUrlCardProps = {
  /** Absolute URL or null when site base URL is not configured. */
  commandCenterUrl: string | null;
  orgSlug: string;
  allowFlashEntry: boolean;
  layout?: "default" | "rail";
};

export function CommandCenterUrlCard({
  commandCenterUrl,
  orgSlug,
  allowFlashEntry,
  layout = "default"
}: CommandCenterUrlCardProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    if (!commandCenterUrl) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(commandCenterUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  const body = (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl ring-1",
            layout === "rail"
              ? "h-11 w-11 bg-zinc-900 text-amber-300 ring-zinc-800"
              : "h-10 w-10 bg-zinc-100 text-zinc-800 ring-zinc-200"
          )}
        >
          <span className="text-xs font-black tracking-tight" aria-hidden>
            CC
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              "font-semibold text-slate-900",
              layout === "rail" ? "text-sm uppercase tracking-[0.18em] text-zinc-500" : "text-base"
            )}
          >
            {layout === "rail" ? "Command Center" : "Org Command Center"}
          </h2>
          <p
            className={cn(
              "leading-relaxed text-slate-600",
              layout === "rail" ? "mt-2 text-xs text-zinc-600" : "mt-1 text-sm"
            )}
          >
            Published and live programs appear here. Attendees enter with their work email; walk-ins are{" "}
            <span className="font-medium text-slate-800">{allowFlashEntry ? "allowed" : "off"}</span> for this event.
          </p>
          {commandCenterUrl ? (
            <div className={cn("flex flex-col gap-2", layout === "rail" ? "mt-4" : "mt-4 sm:flex-row sm:items-center")}>
              <code
                className={cn(
                  "block min-w-0 font-mono shadow-inner",
                  layout === "rail"
                    ? "flex-1 whitespace-pre-wrap break-all rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-[11px] leading-relaxed text-amber-200/95 ring-1 ring-black/40"
                    : "flex-1 truncate rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200/60"
                )}
                title={commandCenterUrl}
              >
                {commandCenterUrl}
              </code>
              <Button
                type="button"
                variant="secondary"
                className={cn("shrink-0", layout === "rail" && "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800")}
                onClick={() => void copy()}
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 inline h-4 w-4" aria-hidden />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 inline h-4 w-4" aria-hidden />
                    Copy
                  </>
                )}
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-amber-800">
              Set <span className="font-mono">NEXTAUTH_URL</span> (or <span className="font-mono">PUBLIC_APP_URL</span>) so
              absolute links can be generated. Slug for this workspace:{" "}
              <span className="font-mono font-semibold">{orgSlug}</span>
            </p>
          )}
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        </div>
      </div>
    </>
  );

  if (layout === "rail") {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 p-4 text-zinc-100 shadow-lg shadow-black/30 sm:p-5">
        {body}
      </section>
    );
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{body}</section>;
}
