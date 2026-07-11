"use client";

import { EventStatus } from "@prisma/client";
import { Check, Copy, ExternalLink, Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { publishEvent, unpublishEvent } from "@/lib/actions/event.actions";
import { cn } from "@/lib/utils";

type RegistrationLinkSectionProps = {
  eventId: string;
  status: EventStatus;
  registrationUrl: string;
  canPublish: boolean;
  /** Sticky rail layout for the overview split column. */
  layout?: "default" | "rail";
};

export function RegistrationLinkSection({
  eventId,
  status,
  registrationUrl,
  canPublish,
  layout = "default"
}: RegistrationLinkSectionProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registrationLive = status === EventStatus.PUBLISHED || status === EventStatus.LIVE;

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  async function onPublish() {
    setError(null);
    setPublishing(true);
    const res = await publishEvent({ eventId });
    setPublishing(false);
    if (!res.success) {
      setError(res.error ?? "Failed to publish");
      return;
    }
    router.refresh();
  }

  async function onUnpublish() {
    setError(null);
    setUnpublishing(true);
    const res = await unpublishEvent({ eventId });
    setUnpublishing(false);
    if (!res.success) {
      setError(res.error ?? "Failed to unpublish");
      return;
    }
    router.refresh();
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
          <Megaphone className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              "font-semibold text-slate-900",
              layout === "rail" ? "text-sm uppercase tracking-[0.18em] text-zinc-500" : "text-base"
            )}
          >
            {layout === "rail" ? "Registration URL" : "Public registration"}
          </h2>
          <p
            className={cn(
              "leading-relaxed text-slate-600",
              layout === "rail" ? "mt-2 text-xs text-zinc-600" : "mt-1 text-sm"
            )}
          >
            Share this link so attendees can register themselves. It stays the same for the life of the event.
          </p>

          <div
            className={cn(
              "flex flex-col gap-2",
              layout === "rail" ? "mt-4" : "mt-4 sm:flex-row sm:items-center"
            )}
          >
            <code
              className={cn(
                "block min-w-0 font-mono shadow-inner",
                layout === "rail"
                  ? "flex-1 whitespace-pre-wrap break-all rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-[11px] leading-relaxed text-emerald-400/95 ring-1 ring-black/40"
                  : "flex-1 truncate rounded-lg border px-3 py-2.5 text-sm",
                layout !== "rail" &&
                  (registrationLive
                    ? "border-slate-200/90 bg-white text-slate-800 ring-1 ring-slate-200/60"
                    : "border-amber-200/90 bg-amber-50/80 text-amber-950 ring-1 ring-amber-100")
              )}
              title={registrationUrl}
            >
              {registrationUrl}
            </code>
            <div
              className={cn(
                "flex flex-col gap-2",
                layout === "rail" ? "" : "sm:flex-row sm:flex-wrap"
              )}
            >
              <Button
                type="button"
                variant="secondary"
                className={cn(
                  "shrink-0",
                  layout === "rail"
                    ? "w-full justify-center border-zinc-300 bg-white font-semibold hover:bg-zinc-50"
                    : "shadow-sm"
                )}
                onClick={() => window.open(registrationUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="mr-2 inline h-4 w-4" />
                Open URL
              </Button>
              <Button
                type="button"
                variant="secondary"
                className={cn(
                  "shrink-0",
                  layout === "rail"
                    ? "w-full justify-center border-zinc-300 bg-white font-semibold hover:bg-zinc-50"
                    : "shadow-sm"
                )}
                onClick={copy}
              >
                {copied ? (
                  <>
                    <Check className="mr-2 inline h-4 w-4 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 inline h-4 w-4" />
                    Copy link
                  </>
                )}
              </Button>
            </div>
          </div>

          {status === EventStatus.DRAFT ? (
            <p className={cn("text-sm text-amber-800", layout === "rail" ? "mt-3" : "mt-3")}>
              Registration pages are only available after the event is published.{" "}
              {canPublish ? "Use Publish below when you are ready." : "Ask an admin or marketing user to publish."}
            </p>
          ) : null}

          {status === EventStatus.COMPLETED || status === EventStatus.CANCELLED ? (
            <p className="mt-3 text-sm text-slate-600">
              This event is no longer accepting new registrations via the public link.
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {canPublish && status === EventStatus.DRAFT ? (
            <div className="mt-4">
              <Button
                type="button"
                disabled={publishing}
                className={cn(
                  "w-full justify-center font-semibold sm:w-auto",
                  layout === "rail"
                    ? "bg-amber-500 text-zinc-950 hover:bg-amber-400"
                    : "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800"
                )}
                onClick={onPublish}
              >
                {publishing ? "Publishing…" : "Publish event"}
              </Button>
            </div>
          ) : null}

          {canPublish && (status === EventStatus.PUBLISHED || status === EventStatus.LIVE) ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={unpublishing} onClick={() => void onUnpublish()}>
                {unpublishing ? "Unpublishing…" : "Unpublish (back to draft)"}
              </Button>
              <p className="w-full text-xs text-slate-600">
                Moves the event to <strong>Draft</strong> so you can edit details. The public registration link stops
                working until you publish again.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  if (layout === "rail") {
    return (
      <aside className="lg:sticky lg:top-6">
        <Card className="border-2 border-zinc-900 bg-white p-5 shadow-[8px_8px_0_0_rgb(24_24_27)]">{body}</Card>
      </aside>
    );
  }

  return (
    <Card className="border-slate-200/80 bg-gradient-to-br from-white to-slate-50/40 p-5 shadow-md shadow-slate-900/[0.04]">
      {body}
    </Card>
  );
}
