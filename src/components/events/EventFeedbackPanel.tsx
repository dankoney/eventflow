"use client";

import { useMemo, useState } from "react";
import { Download, Send } from "lucide-react";
import { useRouter } from "next/navigation";

import { EventFeedbackBlastDialog } from "@/components/events/EventFeedbackBlastDialog";
import { EventFeedbackChart } from "@/components/charts/EventFeedbackChart";
import { EventFeedbackQuestionsEditor } from "@/components/events/EventFeedbackQuestionsEditor";
import { EventFeedbackShareCard } from "@/components/events/EventFeedbackShareCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  exportEventFeedbackReportCsv,
  exportEventFeedbackReportPdf
} from "@/lib/actions/eventFeedback.actions";
import type { EventFeedbackAnalytics } from "@/lib/db/eventFeedback";
import {
  collectFeedbackAnswerColumns,
  formatFeedbackAnswerForExport,
  responseHasWrittenContent
} from "@/lib/event-feedback/feedbackResponseContent";
import {
  feedbackPendingResponseMetricHint,
  feedbackPendingResponseMetricLabel
} from "@/lib/event-feedback/feedbackMetrics";
import { cn, formatDate } from "@/lib/utils";

type EventFeedbackPanelProps = {
  eventId: string;
  eventName: string;
  orgName: string;
  eventDateLabel: string;
  accentColor?: string;
  logoUrl?: string | null;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  feedbackQuestionsLocked: boolean;
  feedbackBlastOpen: boolean;
  analytics: EventFeedbackAnalytics;
  feedbackPortalUrl: string | null;
  feedbackShortCode: string | null;
  eventGuestGroups?: Array<{ id: string; name: string }>;
  contactCategories?: string[];
};

type DashboardTab = "insights" | "setup" | "share";

function windowStatusLabel(analytics: EventFeedbackAnalytics): string {
  switch (analytics.window.phase) {
    case "open":
      return `Open until ${formatDate(analytics.window.closesAt)}`;
    case "closed":
      return `Closed ${formatDate(analytics.window.closesAt)}`;
    case "not_yet_open":
      return `Opens ${formatDate(analytics.window.opensAt)}`;
    default:
      return "Unavailable";
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function EventFeedbackPanel({
  eventId,
  eventName,
  orgName,
  eventDateLabel,
  accentColor,
  logoUrl,
  brandLogoUrl,
  orgLogoUrl,
  orgDefaultBrandLogoUrl,
  feedbackQuestionsLocked,
  feedbackBlastOpen,
  analytics,
  feedbackPortalUrl,
  feedbackShortCode,
  eventGuestGroups = [],
  contactCategories = []
}: EventFeedbackPanelProps) {
  const [tab, setTab] = useState<DashboardTab>(
    analytics.responseCount > 0 ? "insights" : "setup"
  );
  const [feedbackBlastDialogOpen, setFeedbackBlastDialogOpen] = useState(false);
  const router = useRouter();
  const [exportCsvBusy, setExportCsvBusy] = useState(false);
  const [exportPdfBusy, setExportPdfBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [showWrittenOnly, setShowWrittenOnly] = useState(false);

  const blastAudience = analytics.blastAudience;
  const requestFeedbackCount =
    blastAudience?.pendingResponseCount ?? analytics.pendingResponseCount;
  const scopedPendingCount =
    blastAudience?.pendingResponseCount ?? analytics.pendingResponseCount;
  const scopedInvitedCount = blastAudience?.invitedCount ?? analytics.requestedCount;
  const scopedResponseCount = blastAudience?.responseCount ?? analytics.responseCount;

  const answerColumns = useMemo(
    () => collectFeedbackAnswerColumns(analytics.feedbackQuestions, analytics.responses),
    [analytics.feedbackQuestions, analytics.responses]
  );

  const visibleResponses = useMemo(() => {
    if (!showWrittenOnly) return analytics.responses;
    return analytics.responses.filter((r) =>
      responseHasWrittenContent({ comment: r.comment, answers: r.answers })
    );
  }, [analytics.responses, showWrittenOnly]);

  async function downloadCsv() {
    setExportCsvBusy(true);
    const res = await exportEventFeedbackReportCsv({ eventId });
    setExportCsvBusy(false);
    if (!res.success || !res.data) {
      setNotice({ ok: false, text: res.error ?? "Could not export report." });
      return;
    }
    downloadBlob(new Blob(["\uFEFF" + res.data.csv], { type: "text/csv;charset=utf-8" }), res.data.filename);
  }

  async function downloadPdf() {
    setExportPdfBusy(true);
    const res = await exportEventFeedbackReportPdf({ eventId });
    setExportPdfBusy(false);
    if (!res.success || !res.data) {
      setNotice({ ok: false, text: res.error ?? "Could not export PDF." });
      return;
    }
    const binary = atob(res.data.pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), res.data.filename);
  }

  const exportBusy = exportCsvBusy || exportPdfBusy;
  const canExport = analytics.responseCount > 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("insights")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              tab === "insights"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            )}
          >
            Insights
            {analytics.responseCount > 0 ? (
              <span className="ml-1.5 tabular-nums opacity-80">({analytics.responseCount})</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab("setup")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              tab === "setup"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            )}
          >
            Form setup
          </button>
          <button
            type="button"
            onClick={() => setTab("share")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              tab === "share"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            )}
          >
            Link &amp; QR
          </button>
        </div>
        <span className="inline-flex w-fit rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
          {windowStatusLabel(analytics)}
        </span>
      </div>

      {analytics.feedbackAnonymous ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Anonymous mode is on.</strong> Names and emails are hidden in the table and exports.
        </p>
      ) : null}

      {notice ? (
        <p
          className={`text-sm font-medium ${notice.ok ? "text-emerald-800" : "text-red-700"}`}
          role="status"
        >
          {notice.text}
        </p>
      ) : null}

      {tab === "setup" ? (
        <EventFeedbackQuestionsEditor
          embedded
          eventId={eventId}
          eventName={eventName}
          locked={feedbackQuestionsLocked}
          initialQuestions={analytics.feedbackQuestions}
          initialFeedbackAnonymous={analytics.feedbackAnonymous}
        />
      ) : null}

      {tab === "share" ? (
        <EventFeedbackShareCard
          portalUrl={feedbackPortalUrl}
          shortCode={feedbackShortCode}
          windowPhase={analytics.window.phase}
          windowLabel={windowStatusLabel(analytics)}
          eventName={eventName}
          orgName={orgName}
          eventDateLabel={eventDateLabel}
          accentColor={accentColor}
          logoUrl={logoUrl}
          brandLogoUrl={brandLogoUrl}
          orgLogoUrl={orgLogoUrl}
          orgDefaultBrandLogoUrl={orgDefaultBrandLogoUrl}
        />
      ) : null}

      {tab === "insights" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Results &amp; exports</h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-600">
                Review emoji ratings, comments, and optional question answers. Exports include all
                stored answers, including from previous form versions.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={exportBusy || !canExport}
                  onClick={() => void downloadCsv()}
                >
                  <Download className="mr-2 inline h-4 w-4" aria-hidden />
                  {exportCsvBusy ? "Exporting…" : "CSV"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={exportBusy || !canExport}
                  onClick={() => void downloadPdf()}
                >
                  <Download className="mr-2 inline h-4 w-4" aria-hidden />
                  {exportPdfBusy ? "Exporting…" : "PDF"}
                </Button>
                {feedbackBlastOpen ? (
                  <Button
                    type="button"
                    disabled={requestFeedbackCount === 0}
                    onClick={() => setFeedbackBlastDialogOpen(true)}
                  >
                    <Send className="mr-2 inline h-4 w-4" aria-hidden />
                    Request feedback ({requestFeedbackCount})
                  </Button>
                ) : null}
              </div>
              {canExport ? (
                <p className="max-w-sm text-right text-xs text-zinc-500">
                  CSV/PDF: rating, comment, and every question column (archived columns kept).
                </p>
              ) : null}
            </div>
          </div>

          {!feedbackBlastOpen && analytics.window.phase === "closed" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              The guest feedback window has closed. You can still view responses and export; new
              invitations cannot be sent.
            </p>
          ) : !feedbackBlastOpen ? (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              Request feedback becomes available once the event has started.
            </p>
          ) : null}

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Card className="min-w-0 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Attended</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{analytics.eligibleCount}</p>
              {blastAudience ? (
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                  Last blast: {blastAudience.size} guests
                </p>
              ) : null}
            </Card>
            <Card className="min-w-0 p-4">
              <p className="break-words text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {feedbackPendingResponseMetricLabel(analytics.window)}
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{scopedPendingCount}</p>
              {feedbackPendingResponseMetricHint(analytics.window) || blastAudience ? (
                <p
                  className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-500"
                  title={
                    blastAudience
                      ? "In last blast audience, not submitted yet"
                      : feedbackPendingResponseMetricHint(analytics.window)
                  }
                >
                  {blastAudience
                    ? "In last blast audience, not submitted yet"
                    : feedbackPendingResponseMetricHint(analytics.window)}
                </p>
              ) : null}
            </Card>
            <Card className="min-w-0 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Invited</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{scopedInvitedCount}</p>
              {blastAudience ? (
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">Last blast audience</p>
              ) : null}
            </Card>
            <Card className="min-w-0 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Responses</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{scopedResponseCount}</p>
              {blastAudience ? (
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">From last blast audience</p>
              ) : null}
            </Card>
            <Card className="min-w-0 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Avg. score</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {analytics.averageScore != null ? `${analytics.averageScore} / 5` : "—"}
              </p>
            </Card>
            <Card className="min-w-0 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Written answers
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{analytics.writtenContentCount}</p>
            </Card>
          </div>

          <Card className="space-y-6 p-4">
            <h3 className="text-lg font-semibold text-slate-900">Satisfaction breakdown</h3>
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <EventFeedbackChart data={analytics.distribution} title="Responses by rating" embedded />
              <ul className="space-y-3 text-sm">
                {analytics.distribution.map((d) => (
                  <li key={d.rating}>
                    <div className="mb-1 flex justify-between gap-2 text-zinc-700">
                      <span>
                        {d.emoji} {d.label}
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-zinc-900">
                        {d.count} ({d.percent}%)
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-zinc-800"
                        style={{ width: `${d.percent}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
              <h3 className="text-lg font-semibold text-slate-900">All responses</h3>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300"
                  checked={showWrittenOnly}
                  onChange={(e) => setShowWrittenOnly(e.target.checked)}
                />
                With comment or question answers ({analytics.writtenContentCount})
              </label>
            </div>
            {visibleResponses.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                {showWrittenOnly
                  ? "No responses with written content yet."
                  : "No responses yet."}
              </p>
            ) : (
              <div className="max-h-[32rem] overflow-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    <tr>
                      <th className="px-4 py-2">
                        {analytics.feedbackAnonymous ? "Respondent" : "Guest"}
                      </th>
                      <th className="px-4 py-2">Rating</th>
                      <th className="px-4 py-2">Details</th>
                      <th className="px-4 py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {visibleResponses.map((r) => (
                      <tr key={r.id} className="align-top hover:bg-zinc-50/80">
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900">{r.guestName}</p>
                          {!analytics.feedbackAnonymous ? (
                            <p className="text-xs text-zinc-500">{r.guestEmail}</p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-800">
                          {r.emoji} {r.label}
                          <span className="ml-1 text-xs text-zinc-400">({r.score}/5)</span>
                        </td>
                        <td className="min-w-[16rem] max-w-xl px-4 py-3 text-zinc-700">
                          {r.comment ? (
                            <p className="whitespace-pre-wrap break-words text-sm">{r.comment}</p>
                          ) : null}
                          {answerColumns.length > 0 ? (
                            <dl className="mt-2 space-y-3 text-xs">
                              {answerColumns.map((col) => {
                                const raw = r.answers?.[col.key]?.trim();
                                const display = raw
                                  ? formatFeedbackAnswerForExport(col.question, raw)
                                  : "";
                                if (!display && !col.archived) return null;
                                return (
                                  <div key={col.key}>
                                    <dt
                                      className={cn(
                                        "font-medium leading-snug",
                                        col.archived ? "text-amber-800" : "text-zinc-600"
                                      )}
                                    >
                                      {col.label}
                                      {col.archived ? " (archived)" : ""}
                                    </dt>
                                    <dd className="mt-0.5 break-words text-sm text-zinc-800">
                                      {display ? (
                                        display
                                      ) : (
                                        <span className="text-zinc-400">—</span>
                                      )}
                                    </dd>
                                  </div>
                                );
                              })}
                            </dl>
                          ) : !r.comment ? (
                            <span className="text-zinc-400">—</span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                          {formatDate(r.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {analytics.lastCampaignAt ? (
              <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
                Last feedback blast: {formatDate(analytics.lastCampaignAt)}
              </p>
            ) : null}
          </Card>

          {analytics.responseCount === 0 ? (
            <p className="text-center text-sm text-zinc-600">
              No responses yet.{" "}
              <button
                type="button"
                className="font-semibold text-zinc-900 underline"
                onClick={() => setTab("share")}
              >
                Get the guest link &amp; QR
              </button>{" "}
              before sending requests.
            </p>
          ) : null}
        </div>
      ) : null}

      {feedbackBlastOpen ? (
        <EventFeedbackBlastDialog
          eventId={eventId}
          open={feedbackBlastDialogOpen}
          onOpenChange={setFeedbackBlastDialogOpen}
          lastBlastAudienceGuestIds={analytics.lastBlastAudienceGuestIds}
          pickerOptions={{
            eventGuestGroups,
            contactCategories
          }}
          onSent={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}
