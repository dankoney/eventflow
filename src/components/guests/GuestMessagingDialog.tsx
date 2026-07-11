"use client";

import { GuestStatus } from "@prisma/client";
import { Mail, MessageSquare, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  getEventMessagingContext,
  getGuestMessageCampaignDetailAction,
  listGuestMessageCampaignsAction,
  previewCustomGuestMessage,
  sendCustomGuestMessageBlast,
  sendCustomMessageToGuest
} from "@/lib/actions/guestMessage.actions";
import type { GuestMessageCampaignListRow, GuestMessageDeliveryRow } from "@/lib/db/guestMessages";
import type { GuestWithRep } from "@/lib/db/guests";
import {
  GUEST_DIRECT_SMS_MAX,
  GUEST_MESSAGE_MERGE_TAGS,
  sendCustomGuestBlastSchema,
  sendCustomGuestEmailSchema,
  sendCustomGuestSmsSchema
} from "@/lib/guests/customGuestMessage";
import { cn, formatDate } from "@/lib/utils";

type GuestMessagingDialogProps = {
  eventId: string;
  open: boolean;
  onClose: () => void;
  guest?: GuestWithRep | null;
  /** When true, default to blasting all eligible guests (admin / marketing). */
  blastMode?: boolean;
  canBlast?: boolean;
};

type Channel = "sms" | "email";
type Panel = "compose" | "deliveries";

export function GuestMessagingDialog({
  eventId,
  open,
  onClose,
  guest = null,
  blastMode = false,
  canBlast = false
}: GuestMessagingDialogProps) {
  const [panel, setPanel] = useState<Panel>("compose");
  const [scope, setScope] = useState<"single" | "blast">(blastMode ? "blast" : "single");
  const [channel, setChannel] = useState<Channel>("email");
  const [smsMessage, setSmsMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHeadline, setEmailHeadline] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [previewName, setPreviewName] = useState("Alex Morgan");
  const [previewSms, setPreviewSms] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<GuestMessageCampaignListRow[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [deliveryRows, setDeliveryRows] = useState<GuestMessageDeliveryRow[]>([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  const isSingle = scope === "single" && guest != null;
  const canSendSms =
    isSingle && Boolean(guest?.phone?.trim()) && guest?.status !== GuestStatus.DECLINED;

  const resetCompose = useCallback(() => {
    setChannel("email");
    setSmsMessage("");
    setEmailSubject("");
    setEmailHeadline("");
    setEmailMessage("");
    setBusy(false);
    setFeedback(null);
    setPreviewSms(null);
    setPreviewHtml(null);
  }, []);

  const loadContext = useCallback(async () => {
    setContextLoading(true);
    const res = await getEventMessagingContext(eventId);
    setContextLoading(false);
    if (res.success && res.data) {
      setEligibleCount(res.data.eligibleGuestCount);
      if (!guest && res.data.previewGuest) {
        setPreviewName(res.data.previewGuest.name);
      } else if (guest) {
        setPreviewName(guest.name);
      }
    }
  }, [eventId, guest]);

  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    const res = await listGuestMessageCampaignsAction(eventId);
    setCampaignsLoading(false);
    if (res.success && res.data) setCampaigns(res.data);
  }, [eventId]);

  useEffect(() => {
    if (!open) return;
    setPanel("compose");
    setScope(blastMode && !guest ? "blast" : "single");
    resetCompose();
    void loadContext();
    void loadCampaigns();
  }, [open, blastMode, guest, resetCompose, loadContext, loadCampaigns]);

  useEffect(() => {
    if (guest) setPreviewName(guest.name);
  }, [guest?.id, guest?.name]);

  const previewPayload = useMemo(() => {
    if (channel === "sms") {
      if (!smsMessage.trim()) return null;
      return scope === "blast" || !guest
        ? { channel: "sms" as const, eventId, message: smsMessage }
        : { channel: "sms" as const, eventId, guestId: guest.id, message: smsMessage };
    }
    if (!emailSubject.trim() || !emailHeadline.trim() || emailMessage.trim().length < 10) return null;
    return scope === "blast" || !guest
      ? {
          channel: "email" as const,
          eventId,
          subject: emailSubject,
          headline: emailHeadline,
          message: emailMessage
        }
      : {
          channel: "email" as const,
          eventId,
          guestId: guest.id,
          subject: emailSubject,
          headline: emailHeadline,
          message: emailMessage
        };
  }, [channel, smsMessage, emailSubject, emailHeadline, emailMessage, eventId, guest, scope]);

  useEffect(() => {
    if (!open || !previewPayload) {
      setPreviewSms(null);
      setPreviewHtml(null);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setPreviewLoading(true);
        const res = await previewCustomGuestMessage(previewPayload);
        setPreviewLoading(false);
        if (!res.success || !res.data) {
          setPreviewSms(null);
          setPreviewHtml(null);
          return;
        }
        setPreviewName(res.data.sampleName);
        setPreviewSms(res.data.smsText ?? null);
        setPreviewHtml(res.data.emailHtml ?? null);
      })();
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, previewPayload]);

  async function expandCampaign(campaignId: string) {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      setDeliveryRows([]);
      return;
    }
    setExpandedCampaignId(campaignId);
    setDeliveryLoading(true);
    const res = await getGuestMessageCampaignDetailAction(eventId, campaignId);
    setDeliveryLoading(false);
    if (res.success && res.data) {
      setDeliveryRows(res.data.deliveries);
    } else {
      setDeliveryRows([]);
    }
  }

  function insertTag(tag: string) {
    const field =
      channel === "sms"
        ? "sms"
        : document.activeElement?.getAttribute("data-merge-field") === "headline"
          ? "headline"
          : document.activeElement?.getAttribute("data-merge-field") === "subject"
            ? "subject"
            : "message";
    if (field === "sms") setSmsMessage((v) => `${v}${tag}`);
    else if (field === "headline") setEmailHeadline((v) => `${v}${tag}`);
    else if (field === "subject") setEmailSubject((v) => `${v}${tag}`);
    else setEmailMessage((v) => `${v}${tag}`);
  }

  async function handleSend() {
    setFeedback(null);
    setBusy(true);

    if (scope === "blast") {
      const parsed =
        channel === "sms"
          ? sendCustomGuestBlastSchema.safeParse({ channel: "sms", eventId, message: smsMessage })
          : sendCustomGuestBlastSchema.safeParse({
              channel: "email",
              eventId,
              subject: emailSubject,
              headline: emailHeadline,
              message: emailMessage
            });
      if (!parsed.success) {
        setBusy(false);
        setFeedback({ ok: false, text: parsed.error.issues[0]?.message ?? "Invalid message." });
        return;
      }
      const res = await sendCustomGuestMessageBlast(parsed.data);
      setBusy(false);
      if (!res.success || !res.data) {
        setFeedback({ ok: false, text: res.error ?? "Blast could not be sent." });
        return;
      }
      setFeedback({
        ok: true,
        text: `Blast complete: ${res.data.sent} sent, ${res.data.failed} failed, ${res.data.skipped} skipped (${res.data.recipientCount} recipients).`
      });
      void loadCampaigns();
      return;
    }

    if (!guest) {
      setBusy(false);
      setFeedback({ ok: false, text: "Select a guest to message." });
      return;
    }

    const parsed =
      channel === "sms"
        ? sendCustomGuestSmsSchema.safeParse({ channel: "sms", eventId, guestId: guest.id, message: smsMessage })
        : sendCustomGuestEmailSchema.safeParse({
            channel: "email",
            eventId,
            guestId: guest.id,
            subject: emailSubject,
            headline: emailHeadline,
            message: emailMessage
          });
    if (!parsed.success) {
      setBusy(false);
      setFeedback({ ok: false, text: parsed.error.issues[0]?.message ?? "Invalid message." });
      return;
    }
    const res = await sendCustomMessageToGuest(parsed.data);
    setBusy(false);
    if (!res.success) {
      setFeedback({ ok: false, text: res.error ?? "Could not send." });
      return;
    }
    setFeedback({
      ok: true,
      text: channel === "sms" ? `SMS sent to ${guest.phone}.` : `Email sent to ${guest.email}.`
    });
    void loadCampaigns();
  }

  const title = scope === "blast" ? "Message all registered guests" : guest ? `Message ${guest.name}` : "Message guest";
  const smsRemaining = GUEST_DIRECT_SMS_MAX - smsMessage.length;

  return (
    <Modal
      open={open}
      title={title}
      subtitle={
        scope === "blast"
          ? `${eligibleCount} eligible guest(s). Merge tags personalize each delivery.`
          : guest
            ? `Preview before sending to ${guest.email}.`
            : undefined
      }
      onClose={onClose}
      size="xl"
      headerTone="dark"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 border-b border-zinc-100 pb-3">
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
              panel === "compose" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
            )}
            onClick={() => setPanel("compose")}
          >
            Compose
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
              panel === "deliveries" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
            )}
            onClick={() => {
              setPanel("deliveries");
              void loadCampaigns();
            }}
          >
            Delivery log
          </button>
          {canBlast ? (
            <button
              type="button"
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
                scope === "blast" ? "bg-indigo-600 text-white" : "border border-zinc-200 text-zinc-700"
              )}
              onClick={() => setScope((s) => (s === "blast" ? "single" : "blast"))}
            >
              <Users className="h-3.5 w-3.5" aria-hidden />
              {scope === "blast" ? "Blast mode" : "Single guest"}
            </button>
          ) : null}
        </div>

        {panel === "deliveries" ? (
          <div className="space-y-3">
            {campaignsLoading ? (
              <p className="text-sm text-zinc-500">Loading delivery history…</p>
            ) : campaigns.length === 0 ? (
              <p className="text-sm text-zinc-600">No custom messages sent for this event yet.</p>
            ) : (
              <ul className="space-y-2">
                {campaigns.map((c) => (
                  <li key={c.id} className="rounded-xl border border-zinc-200 bg-zinc-50/80">
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
                      onClick={() => void expandCampaign(c.id)}
                    >
                      <span className="font-semibold text-zinc-900">
                        {c.channel} · {c.scope === "BLAST" ? "Blast" : "Single"}
                        {c.templateSubject ? ` — ${c.templateSubject}` : c.templateHeadline ? ` — ${c.templateHeadline}` : ""}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {formatDate(c.createdAt)} · {c.sentCount}/{c.recipientCount} sent
                        {c.failedCount > 0 ? ` · ${c.failedCount} failed` : ""}
                        {c.skippedCount > 0 ? ` · ${c.skippedCount} skipped` : ""}
                      </span>
                    </button>
                    {expandedCampaignId === c.id ? (
                      <div className="border-t border-zinc-200 px-3 py-2">
                        {deliveryLoading ? (
                          <p className="text-xs text-zinc-500">Loading recipients…</p>
                        ) : (
                          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                            {deliveryRows.map((d) => (
                              <li
                                key={d.id}
                                className="flex flex-wrap justify-between gap-2 rounded-md bg-white px-2 py-1"
                              >
                                <span className="font-medium text-zinc-800">{d.guestName}</span>
                                <span
                                  className={cn(
                                    "font-semibold uppercase",
                                    d.status === "SENT"
                                      ? "text-emerald-700"
                                      : d.status === "SKIPPED"
                                        ? "text-amber-700"
                                        : "text-red-700"
                                  )}
                                >
                                  {d.status}
                                </span>
                                {d.error ? (
                                  <span className="w-full text-zinc-500">{d.error}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              <button
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition",
                  channel === "email" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
                )}
                onClick={() => setChannel("email")}
              >
                <Mail className="h-4 w-4" aria-hidden />
                Email
              </button>
              <button
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition",
                  channel === "sms" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
                )}
                onClick={() => setChannel("sms")}
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
                SMS
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="w-full text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                Personalization
              </span>
              {GUEST_MESSAGE_MERGE_TAGS.map(({ tag, label }) => (
                <button
                  key={tag}
                  type="button"
                  className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-mono text-xs text-indigo-800 hover:bg-indigo-50"
                  title={label}
                  onClick={() => insertTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                {channel === "email" ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Subject</span>
                      <Input
                        data-merge-field="subject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Hi [first_name], update on [event]"
                        maxLength={120}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Headline</span>
                      <Input
                        data-merge-field="headline"
                        value={emailHeadline}
                        onChange={(e) => setEmailHeadline(e.target.value)}
                        placeholder="Important update"
                        maxLength={120}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Message</span>
                      <textarea
                        data-merge-field="message"
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        rows={5}
                        maxLength={4000}
                        placeholder="Hi [name], …"
                        className="w-full rounded-md border border-slate-400/70 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                  </>
                ) : (
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">SMS</span>
                    <textarea
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value.slice(0, GUEST_DIRECT_SMS_MAX))}
                      rows={4}
                      maxLength={GUEST_DIRECT_SMS_MAX}
                      disabled={isSingle && !canSendSms}
                      placeholder="Hi [first_name], reminder for [event]…"
                      className="w-full rounded-md border border-slate-400/70 bg-white px-3 py-2 text-sm disabled:opacity-60"
                    />
                    <p className={cn("text-right text-xs", smsRemaining < 20 ? "text-amber-700" : "text-zinc-500")}>
                      {smsMessage.length} / {GUEST_DIRECT_SMS_MAX}
                      <span className="ml-2 text-zinc-400">(per guest after tags expand)</span>
                    </p>
                  </label>
                )}
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  Preview · sample: {previewName}
                </p>
                {contextLoading || previewLoading ? (
                  <p className="mt-4 text-sm text-zinc-500">Building preview…</p>
                ) : channel === "sms" ? (
                  previewSms ? (
                    <div className="mt-3 rounded-2xl border border-zinc-300 bg-white p-3 shadow-inner">
                      <p className="text-[10px] font-medium text-zinc-400">SMS</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-900">{previewSms}</p>
                      <p className="mt-2 text-right text-[10px] text-zinc-400">{previewSms.length} chars</p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-zinc-500">Enter a message to preview.</p>
                  )
                ) : previewHtml ? (
                  <div className="mt-3 max-h-[320px] overflow-hidden rounded-lg border border-zinc-300 bg-black">
                    <iframe
                      title="Email preview"
                      srcDoc={previewHtml}
                      className="h-[300px] w-full border-0 bg-white"
                      sandbox=""
                    />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-zinc-500">Fill subject, headline, and message to preview.</p>
                )}
              </div>
            </div>

            {feedback ? (
              <p
                className={cn("text-sm font-medium", feedback.ok ? "text-emerald-800" : "text-red-700")}
                role="status"
              >
                {feedback.text}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4">
              <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
                {feedback?.ok ? "Close" : "Cancel"}
              </Button>
              {!feedback?.ok ? (
                <Button
                  type="button"
                  disabled={
                    busy ||
                    contextLoading ||
                    (scope === "blast" && eligibleCount === 0) ||
                    (channel === "sms" && (!smsMessage.trim() || (isSingle && !canSendSms))) ||
                    (channel === "email" &&
                      (!emailSubject.trim() || !emailHeadline.trim() || emailMessage.trim().length < 10))
                  }
                  onClick={() => void handleSend()}
                >
                  {busy
                    ? "Sending…"
                    : scope === "blast"
                      ? `Send blast (${eligibleCount})`
                      : channel === "sms"
                        ? "Send SMS"
                        : "Send email"}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
