"use client";

import {
  Check,
  Copy,
  Download,
  EyeOff,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  Share2,
  ShieldAlert
} from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import {
  publishPollResults,
  unpublishPollResults,
  type PublishPollResultsResult
} from "@/lib/actions/poll.actions";

type PollResultsCardProps = {
  eventId: string;
  resultsUrl: string | null;
  resultsPublishedAt: string | null;
  resultsSummary: string | null;
  ballotsCast: number;
  totalGuests: number;
  windowState: "open" | "not_started" | "ended" | "inactive" | "missing";
  guestEmailCount: number;
  guestPhoneCount: number;
};

/**
 * Admin "Publish & notify" command center.
 *
 * Behavior:
 *   - Lets the admin pick the broadcast channels (email + SMS) and an optional note,
 *     then triggers {@link publishPollResults}. The action stamps `resultsPublishedAt`
 *     so the public `/events/[id]/poll/results` page becomes live.
 *   - After publishing, exposes the shareable URL + WhatsApp / SMS / email quick-share
 *     buttons, plus a CSV export button.
 *   - "Hide results" unsets `resultsPublishedAt` for amendments before a re-broadcast.
 */
export function PollResultsCard({
  eventId,
  resultsUrl,
  resultsPublishedAt,
  resultsSummary,
  ballotsCast,
  totalGuests,
  windowState,
  guestEmailCount,
  guestPhoneCount
}: PollResultsCardProps) {
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [customMessage, setCustomMessage] = useState(resultsSummary ?? "");
  const [outcome, setOutcome] = useState<PublishPollResultsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [hidePending, startHide] = useTransition();

  const isPublished = Boolean(resultsPublishedAt);
  const exportUrl = `/api/events/${encodeURIComponent(eventId)}/poll/results.csv`;
  const canBroadcast = sendEmail || sendSms;
  const lowTurnoutWarning = isPublished
    ? null
    : ballotsCast === 0
      ? "No ballots have been cast yet."
      : windowState === "open"
        ? "The voting window is still open — publishing now will lock in partial results."
        : null;

  const shareLinks = (() => {
    const url = resultsUrl;
    if (!url) return null;
    const text = `Results for our recent ballot are now published. View: ${url}`;
    return {
      url,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
      mail: `mailto:?subject=${encodeURIComponent("Election results")}&body=${encodeURIComponent(text)}`,
      sms: `sms:?&body=${encodeURIComponent(text)}`
    };
  })();

  function runPublish() {
    if (!canBroadcast && !isPublished) {
      setError("Pick at least one notification channel, or hide results first.");
      return;
    }
    setError(null);
    setOutcome(null);
    startTransition(async () => {
      const res = await publishPollResults({
        eventId,
        channels: [sendEmail ? "email" : null, sendSms ? "sms" : null].filter(
          (v): v is "email" | "sms" => v != null
        ),
        customMessage: customMessage.trim() || null,
        rebroadcast: isPublished
      });
      if (!res.success || !res.data) {
        setError(res.error ?? "Could not publish results.");
        return;
      }
      setOutcome(res.data);
    });
  }

  function runHide() {
    setError(null);
    setOutcome(null);
    if (!window.confirm("Hide the public results page? You can re-publish later.")) return;
    startHide(async () => {
      const res = await unpublishPollResults({ eventId });
      if (!res.success) {
        setError(res.error ?? "Could not hide the results page.");
      }
    });
  }

  async function copyShareLink() {
    if (!resultsUrl) return;
    try {
      await navigator.clipboard.writeText(resultsUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-900">Publish results & notify guests</h3>
            <Badge
              className={
                isPublished
                  ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
                  : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
              }
            >
              {isPublished ? "Published" : "Draft"}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Broadcast the official tally to every guest by email and SMS, generate a shareable
            results URL, and download a CSV for archival.
          </p>
        </div>
        <div className="text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {isPublished && resultsPublishedAt ? (
            <>Published {formatStamp(resultsPublishedAt)}</>
          ) : (
            <>
              {ballotsCast.toLocaleString()} / {totalGuests.toLocaleString()} ballots
            </>
          )}
        </div>
      </header>

      {lowTurnoutWarning ? (
        <WorkspaceNotice variant="info">
          <ShieldAlert className="-mt-0.5 mr-1 inline h-4 w-4" aria-hidden /> {lowTurnoutWarning}
        </WorkspaceNotice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-700">
            Notification channels
          </p>
          <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
                <Mail className="h-3.5 w-3.5" aria-hidden /> Email all guests
              </span>
              <span className="mt-0.5 block text-xs text-zinc-600">
                {guestEmailCount.toLocaleString()} guest{guestEmailCount === 1 ? "" : "s"} with email on file.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
            <input
              type="checkbox"
              checked={sendSms}
              onChange={(e) => setSendSms(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden /> SMS (mNotify)
              </span>
              <span className="mt-0.5 block text-xs text-zinc-600">
                {guestPhoneCount.toLocaleString()} guest{guestPhoneCount === 1 ? "" : "s"} with phone on file.
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-700">
            Note for voters{" "}
            <span className="font-medium normal-case tracking-normal text-zinc-500">
              (optional · shown on the public results page and in the email body)
            </span>
          </p>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Thanks for participating. Final results below…"
            rows={6}
            maxLength={2000}
            className="w-full rounded-md border border-slate-400/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-400/25"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={runPublish}
          disabled={pending || (!canBroadcast && !isPublished)}
          className="inline-flex items-center gap-2"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          {isPublished
            ? canBroadcast
              ? "Re-broadcast notifications"
              : "Save note"
            : "Publish & notify"}
        </Button>
        <a
          href={exportUrl}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </a>
        {isPublished ? (
          <button
            type="button"
            onClick={runHide}
            disabled={hidePending}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {hidePending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
            )}
            Hide public page
          </button>
        ) : null}
      </div>

      {isPublished && shareLinks ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-900">
            <Share2 className="h-3.5 w-3.5" aria-hidden /> Shareable results URL
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-emerald-900">
              {shareLinks.url}
            </code>
            <button
              type="button"
              onClick={copyShareLink}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={shareLinks.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#25d366] px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
            >
              WhatsApp
            </a>
            <a
              href={shareLinks.mail}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden /> Email link
            </a>
            <a
              href={shareLinks.sms}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden /> SMS link
            </a>
            <a
              href={shareLinks.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              Preview public page
            </a>
          </div>
        </div>
      ) : null}

      {error ? <WorkspaceNotice variant="error">{error}</WorkspaceNotice> : null}

      {outcome ? (
        <WorkspaceNotice variant="success">
          <div className="space-y-1 text-sm">
            <p className="font-semibold">Broadcast complete</p>
            <p className="text-xs">
              Email sent: <strong>{outcome.emailsSent}</strong> of {outcome.emailsAttempted} attempted
              {outcome.emailsSkipped > 0 ? ` · ${outcome.emailsSkipped} skipped (no email)` : ""}
              {" · "}
              SMS sent: <strong>{outcome.smsSent}</strong> of {outcome.smsAttempted} attempted
              {outcome.smsSkipped > 0 ? ` · ${outcome.smsSkipped} skipped (no phone)` : ""}
              {"."}
            </p>
            {outcome.errors.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-rose-700">
                {outcome.errors.slice(0, 6).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {outcome.errors.length > 6 ? (
                  <li>… {outcome.errors.length - 6} more issue{outcome.errors.length - 6 === 1 ? "" : "s"}.</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </WorkspaceNotice>
      ) : null}
    </section>
  );
}

function formatStamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}
