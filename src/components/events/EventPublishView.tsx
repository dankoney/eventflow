"use client";

import { EventStatus } from "@prisma/client";
import { Check, Copy, ExternalLink, Megaphone, Vote } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EventLiveOpsPanel } from "@/components/events/EventLiveOpsPanel";
import { Button } from "@/components/ui/Button";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { publishEvent } from "@/lib/actions/event.actions";
import { cn } from "@/lib/utils";

type EventPublishViewProps = {
  eventId: string;
  name: string;
  status: EventStatus;
  registrationUrl: string;
  canPublish: boolean;
  isInternalStaff?: boolean;
  /**
   * Election & polling add-on. When set, the publish page renders a "Poll Direct
   * Link" card below the registration card so organizers can copy both addresses
   * in one place.
   */
  pollUrl?: string | null;
  pollIsActive?: boolean;
  commandCenterUrl: string | null;
  checkInBoothUrl: string | null;
  orgSlug: string;
  allowFlashEntry: boolean;
  eventIsLive: boolean;
  boothOpen: boolean;
  boothStatusMessage: string;
  isOnsiteEvent: boolean;
  canHostZoom: boolean;
  hasZoomRoom: boolean;
  zoomStartUrl: string | null;
  zoomJoinUrl: string | null;
};

export function EventPublishView({
  eventId,
  name,
  status,
  registrationUrl,
  canPublish,
  isInternalStaff = false,
  pollUrl,
  pollIsActive,
  commandCenterUrl,
  checkInBoothUrl,
  orgSlug,
  allowFlashEntry,
  eventIsLive,
  boothOpen,
  boothStatusMessage,
  isOnsiteEvent,
  canHostZoom,
  hasZoomRoom,
  zoomStartUrl,
  zoomJoinUrl
}: EventPublishViewProps) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pollCopied, setPollCopied] = useState(false);

  const isDraft = status === EventStatus.DRAFT;
  const isLive = status === EventStatus.PUBLISHED || status === EventStatus.LIVE;

  async function onPublish() {
    setError(null);
    setPublishing(true);
    const res = await publishEvent({ eventId });
    setPublishing(false);
    if (!res.success) {
      setError(res.error ?? "Failed to publish");
      return;
    }
    router.push(`/events/${eventId}`);
    router.refresh();
  }

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

  async function copyPollUrl() {
    if (!pollUrl) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(pollUrl);
      setPollCopied(true);
      setTimeout(() => setPollCopied(false), 2000);
    } catch {
      setError("Could not copy the poll link.");
    }
  }

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Event"
      title={isInternalStaff ? "Publish & notify staff" : "Publish & registration"}
      description={
        isDraft
          ? isInternalStaff
            ? "Draft programmes are not live. Publish to send mandatory-attendance notices (memo email + SMS) to everyone on the roster."
            : "Draft programs are not public. When you are ready, publish to open the registration page at the link below."
          : isLive
            ? isInternalStaff
              ? "This programme is published. Staff notices were sent to the roster; share the check-in link if needed."
              : "This program is public. The registration link is available for guests."
            : "Publication options for this program."
      }
    >
      <div className="max-w-2xl space-y-6">
        <div className="flex gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/95 p-4 shadow-sm ring-1 ring-slate-200/20">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-amber-300 ring-1 ring-zinc-800">
            <Megaphone className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            <p className="mt-0.5 text-xs text-slate-500">Status: {status}</p>
          </div>
        </div>

        {isLive ? (
          <p className="text-sm text-slate-600">
            <Link href={`/events/${eventId}`} className="font-medium text-slate-900 underline">
              Open overview
            </Link>{" "}
            for full lifecycle and unpublish, or share the link below.
          </p>
        ) : null}

        {isDraft ? (
          <p className="text-sm text-slate-600">
            Publishing is separate from the blueprint builder: finish setup in{" "}
            <Link href={`/events/${eventId}/edit`} className="font-medium text-slate-900 underline">
              Edit
            </Link>{" "}
            any time, then return here to go live.
          </p>
        ) : null}

        <div>
          <p className="text-sm font-medium text-slate-800">Public registration link</p>
          <p className="mt-1 text-sm text-slate-600">Guests use this address to self-register (when published).</p>
          <code
            className={cn(
              "mt-3 block w-full min-w-0 break-all rounded-lg border px-3 py-2.5 font-mono text-sm",
              isLive
                ? "border-slate-200/90 bg-white text-slate-800 ring-1 ring-slate-200/60"
                : "border-amber-200/90 bg-amber-50/80 text-amber-950 ring-1 ring-amber-100"
            )}
            title={registrationUrl}
          >
            {registrationUrl}
          </code>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="text-sm" onClick={() => void copy()}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <a
              href={registrationUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" />
              Open
            </a>
          </div>
        </div>

        {isDraft && canPublish ? (
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-900">
              {isInternalStaff ? "Publish & notify staff" : "Go live"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {isInternalStaff ? (
                <>
                  Sets the programme to <strong>Published</strong> and sends memo-style notices (email + SMS) to
                  everyone on the staff roster.
                </>
              ) : (
                <>
                  Sets the program to <strong>Published</strong> so the registration form accepts guests.
                </>
              )}
            </p>
            <div className="mt-3">
              <Button type="button" onClick={() => void onPublish()} disabled={publishing} className="w-full sm:w-auto">
                {publishing
                  ? "Publishing…"
                  : isInternalStaff
                    ? "Publish & notify staff"
                    : "Publish program"}
              </Button>
            </div>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </div>
        ) : null}

        {pollUrl ? (
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-amber-300 ring-1 ring-zinc-800">
                <Vote className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Poll direct link</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Share this address so guests can open the OTP-gated ballot.
                </p>
              </div>
            </div>
            <code
              className={cn(
                "mt-3 block w-full min-w-0 break-all rounded-lg border px-3 py-2.5 font-mono text-sm",
                pollIsActive
                  ? "border-slate-200/90 bg-white text-slate-800 ring-1 ring-slate-200/60"
                  : "border-amber-200/90 bg-amber-50/80 text-amber-950 ring-1 ring-amber-100"
              )}
              title={pollUrl}
            >
              {pollUrl}
            </code>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="text-sm" onClick={() => void copyPollUrl()}>
                {pollCopied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                {pollCopied ? "Copied" : "Copy poll link"}
              </Button>
              <a
                href={pollUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
              <Link
                href={`/events/${eventId}/election`}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline"
              >
                Manage ballot →
              </Link>
            </div>
            {!pollIsActive ? (
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-amber-700">
                Voting is paused — visitors see a "closed" notice until the master switch is on.
              </p>
            ) : null}
          </div>
        ) : null}

        <EventLiveOpsPanel
          eventId={eventId}
          commandCenterUrl={commandCenterUrl}
          checkInBoothUrl={checkInBoothUrl}
          orgSlug={orgSlug}
          allowFlashEntry={allowFlashEntry}
          eventIsLive={eventIsLive}
          boothOpen={boothOpen}
          boothStatusMessage={boothStatusMessage}
          isOnsiteEvent={isOnsiteEvent}
          canHostZoom={canHostZoom}
          hasZoomRoom={hasZoomRoom}
          zoomStartUrl={zoomStartUrl}
          zoomJoinUrl={zoomJoinUrl}
          layout="publish"
        />
      </div>
    </WorkspacePageShell>
  );
}
