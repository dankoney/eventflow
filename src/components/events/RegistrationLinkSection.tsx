"use client";

import { EventStatus } from "@prisma/client";
import { Check, Copy, Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { publishEvent } from "@/lib/actions/event.actions";
import { cn } from "@/lib/utils";

type RegistrationLinkSectionProps = {
  eventId: string;
  status: EventStatus;
  registrationUrl: string;
  canPublish: boolean;
};

export function RegistrationLinkSection({
  eventId,
  status,
  registrationUrl,
  canPublish
}: RegistrationLinkSectionProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
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

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Megaphone className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">Public registration</h2>
          <p className="mt-1 text-sm text-slate-600">
            Share this link so attendees can register themselves. It stays the same for the life of the event.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code
              className={cn(
                "block min-w-0 flex-1 truncate rounded-md border px-3 py-2 font-mono text-sm",
                registrationLive ? "border-slate-200 bg-slate-50" : "border-amber-200 bg-amber-50 text-slate-700"
              )}
              title={registrationUrl}
            >
              {registrationUrl}
            </code>
            <Button type="button" variant="secondary" className="shrink-0" onClick={copy}>
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

          {status === EventStatus.DRAFT ? (
            <p className="mt-3 text-sm text-amber-800">
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
              <Button type="button" disabled={publishing} onClick={onPublish}>
                {publishing ? "Publishing…" : "Publish event"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
