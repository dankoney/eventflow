"use client";

import { EmailCampaignStatus } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  Rocket,
  Send
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getCampaignSendProgressAction,
  previewEmailCampaignAction,
  sendCampaignAction,
  testSendEmailCampaignAction,
  type CampaignPreviewData
} from "@/lib/actions/emailCampaign.actions";
import { cn, formatDate } from "@/lib/utils";

type CampaignWorkflowProps = {
  campaignId: string;
  initialName: string;
  initialSubject: string;
  initialStatus: EmailCampaignStatus;
  templateName: string;
  liveSendEnabled: boolean;
};

type Step = "draft" | "preview" | "send" | "status";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  DELIVERED: "Delivered",
  OPENED: "Opened",
  CLICKED: "Clicked",
  BOUNCED: "Bounced",
  COMPLAINED: "Complained",
  SKIPPED_UNSUBSCRIBED: "Skipped (unsubscribed)"
};

export function EmailCampaignWorkflow({
  campaignId,
  initialName,
  initialSubject,
  initialStatus,
  templateName,
  liveSendEnabled
}: CampaignWorkflowProps) {
  const isDraft = initialStatus === EmailCampaignStatus.DRAFT;
  const showStatus =
    initialStatus === EmailCampaignStatus.PREPARING ||
    initialStatus === EmailCampaignStatus.SENDING ||
    initialStatus === EmailCampaignStatus.SENT ||
    initialStatus === EmailCampaignStatus.SCHEDULED ||
    initialStatus === EmailCampaignStatus.FAILED;

  const [step, setStep] = useState<Step>(showStatus ? "status" : "draft");
  const [preview, setPreview] = useState<CampaignPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [liveSending, setLiveSending] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [confirmLive, setConfirmLive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    status: EmailCampaignStatus;
    counts: Record<string, number>;
    total: number;
  } | null>(null);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    setError(null);
    const res = await previewEmailCampaignAction(campaignId);
    setPreviewLoading(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Preview failed.");
      return;
    }
    setPreview(res.data);
    setStep("preview");
  }, [campaignId]);

  const loadProgress = useCallback(async () => {
    const res = await getCampaignSendProgressAction(campaignId);
    if (res.success && res.data) setProgress(res.data);
  }, [campaignId]);

  useEffect(() => {
    if (showStatus) void loadProgress();
  }, [showStatus, loadProgress]);

  useEffect(() => {
    if (step !== "status") return;
    const id = window.setInterval(() => void loadProgress(), 8000);
    return () => window.clearInterval(id);
  }, [step, loadProgress]);

  async function handleTestSend() {
    setTestSending(true);
    setError(null);
    setMessage(null);
    const res = await testSendEmailCampaignAction(campaignId);
    setTestSending(false);
    if (!res.success) {
      setError(res.error ?? "Preview failed.");
      return;
    }
    setMessage("Test email sent to your account address.");
    setStep("send");
  }

  async function handleLiveSend(schedule: boolean) {
    if (!confirmLive) {
      setError("Check the box to confirm you have reviewed the Resend API sequence.");
      return;
    }
    setLiveSending(true);
    setError(null);
    setMessage(null);
    const res = await sendCampaignAction({
      campaignId,
      confirmLiveSend: true,
      scheduledAt: schedule && scheduledAt ? new Date(scheduledAt).toISOString() : null
    });
    setLiveSending(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Campaign send failed.");
      return;
    }
    if (res.data.mode === "preparing") {
      setMessage(
        `Preparing send: synced ${res.data.syncedCount} of ${res.data.recipientCount} contacts to Resend. Background worker will continue — refresh status shortly.`
      );
      setStep("status");
      void loadProgress();
      return;
    }
    setMessage(
      res.data.scheduled
        ? `Campaign scheduled via Resend (broadcast ${res.data.resendBroadcastId}).`
        : `Campaign submitted to Resend (${res.data.recipientCount} recipients, broadcast ${res.data.resendBroadcastId}).`
    );
    setStep("status");
    void loadProgress();
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3 text-sm">
        {(
          [
            ["draft", "Draft"],
            ["preview", "Preview"],
            ["send", "Test & send"],
            ...(showStatus || step === "status" ? [["status", "Status"]] : [])
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={id !== "status" && !isDraft && id !== "status"}
            onClick={() => {
              if (id === "preview") void loadPreview();
              else if (id === "status") {
                setStep("status");
                void loadProgress();
              } else setStep(id as Step);
            }}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition",
              step === id
                ? "bg-indigo-100 text-indigo-900"
                : "text-zinc-600 hover:bg-zinc-100",
              id !== "status" && !isDraft && "cursor-not-allowed opacity-50"
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {message ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}

      {step === "draft" && (
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5">
          <h2 className="text-lg font-semibold text-zinc-900">{initialName}</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Subject: <span className="font-medium text-zinc-800">{initialSubject}</span>
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Template: <span className="font-medium text-zinc-800">{templateName}</span>
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Status: {initialStatus}. Segment filters are resolved at send time so the latest
            subscribe state is used.
          </p>
          {isDraft ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" onClick={() => void loadPreview()}>
                Continue to preview
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-600">This campaign can no longer be edited.</p>
          )}
        </section>
      )}

      {step === "preview" && (
        <section className="space-y-4">
          {previewLoading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading preview…
            </div>
          ) : preview ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <p className="text-xs font-medium uppercase text-zinc-500">Recipients</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-900">
                    {preview.recipientCount}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {preview.matchedGuestCount} matched · {preview.excluded.totalExcluded} excluded
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:col-span-2">
                  <p className="text-xs font-medium uppercase text-zinc-500">Send validation</p>
                  {preview.sendValidation.valid ? (
                    <p className="mt-1 flex items-center gap-1 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Ready (unsubscribe tag present, no banner placeholder)
                    </p>
                  ) : (
                    <ul className="mt-1 list-inside list-disc text-sm text-amber-800">
                      {preview.sendValidation.errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="border-b border-zinc-100 px-4 py-2 text-xs text-zinc-500">
                  Email preview (sample merge data)
                </div>
                <iframe
                  title="Campaign preview"
                  srcDoc={preview.compiledHtml}
                  className="h-[32rem] w-full bg-white"
                  sandbox="allow-same-origin"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={() => setStep("draft")}>
                  Back
                </Button>
                <Button type="button" onClick={() => void handleTestSend()} disabled={testSending}>
                  {testSending ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Sending test…
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 inline h-4 w-4" />
                      Send test to my email
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <Button type="button" onClick={() => void loadPreview()}>
              Load preview
            </Button>
          )}
        </section>
      )}

      {step === "send" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Before Send Now goes live</p>
            <p className="mt-1">
              Live sends call Resend Segments + Broadcasts APIs (documented below). Test send above
              uses transactional <code className="text-xs">POST /emails</code> only — your inbox,
              not the segment.
            </p>
            {!liveSendEnabled ? (
              <p className="mt-2 font-medium text-amber-900">
                Server flag <code>BROADCAST_LIVE_SEND_ENABLED=true</code> is not set — Send Now is
                blocked until you enable it after API sanity checks.
              </p>
            ) : null}
          </div>

          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={confirmLive}
              onChange={(e) => setConfirmLive(e.target.checked)}
              className="mt-1"
            />
            <span>
              I reviewed the Resend API sequence for this send and want to submit this campaign to
              Resend.
            </span>
          </label>

          <div className="max-w-sm">
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Schedule (optional — ISO datetime-local)
            </label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Leave empty for immediate send. Resend accepts ISO 8601 via{" "}
              <code>scheduled_at</code>.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep("preview")}>
              Back to preview
            </Button>
            <Button
              type="button"
              disabled={liveSending || !liveSendEnabled}
              onClick={() => void handleLiveSend(false)}
            >
              {liveSending ? (
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="mr-2 inline h-4 w-4" />
              )}
              Send now
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={liveSending || !scheduledAt || !liveSendEnabled}
              onClick={() => void handleLiveSend(true)}
            >
              <Send className="mr-2 inline h-4 w-4" />
              Schedule send
            </Button>
          </div>
        </section>
      )}

      {step === "status" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">Send progress</h2>
            <Button type="button" variant="secondary" onClick={() => void loadProgress()}>
              Refresh
            </Button>
          </div>
          {progress ? (
            <>
              <p className="text-sm text-zinc-600">
                Campaign status: <span className="font-medium">{progress.status}</span> ·{" "}
                {progress.total} recipient rows
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(progress.counts).map(([status, count]) => (
                  <div
                    key={status}
                    className="rounded-lg border border-zinc-200 bg-white px-4 py-3"
                  >
                    <p className="text-xs text-zinc-500">{STATUS_LABELS[status] ?? status}</p>
                    <p className="text-xl font-semibold text-zinc-900">{count}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Loading progress…</p>
          )}
          <Link href="/broadcasts/campaigns" className="text-sm font-medium text-indigo-700 hover:underline">
            ← All campaigns
          </Link>
        </section>
      )}
    </div>
  );
}
