import { classifyDeliveryError } from "@/lib/delivery/errorCodes";
import {
  fetchMnotifyCampaignReport,
  fetchMnotifyMessageStatus,
  findMnotifyReportForRecipient,
  getOrgMnotifyApiKey,
  mapMnotifyDeliveryStatus,
  mnotifyStatusDetail,
  resolveMnotifyRecipientDelivery,
  type MnotifyReportEntry
} from "@/lib/mnotify/deliveryReport";
import { logGuestNotificationDelivery } from "@/lib/notifications/guestNotificationDispatch";
import { prisma } from "@/lib/prisma";

type ResendEmailRecord = {
  id?: string;
  last_event?: string;
  subject?: string;
  text?: string;
  html?: string;
};

export function mapResendLastEvent(lastEvent: string | null | undefined): "SENT" | "FAILED" {
  const e = (lastEvent ?? "").toLowerCase();
  if (e === "bounced" || e === "complained" || e === "canceled") return "FAILED";
  return "SENT";
}

export function resendStatusDetail(lastEvent: string | null | undefined): string {
  const e = (lastEvent ?? "sent").toLowerCase();
  if (e === "delivered") return "email (delivered)";
  if (e === "bounced") return "email bounced";
  if (e === "complained") return "email marked as spam";
  if (e === "delivery_delayed") return "email (delivery delayed)";
  return `email (${e})`;
}

export async function fetchResendEmailStatus(
  apiKey: string,
  messageId: string
): Promise<{ ok: boolean; record: ResendEmailRecord | null; error?: string }> {
  const key = apiKey.trim();
  const id = messageId.trim();
  if (!key || !id) return { ok: false, record: null, error: "Missing API key or message id." };

  const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, record: null, error: text.slice(0, 300) || `Resend HTTP ${res.status}` };
  }

  const record = (await res.json()) as ResendEmailRecord;
  return { ok: true, record };
}

async function getOrgResendApiKey(orgId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { resendApiKey: true }
  });
  const fromOrg = org?.resendApiKey?.trim() ?? "";
  if (fromOrg.length > 0) return fromOrg;
  const fromEnv = process.env.RESEND_API_KEY?.trim() ?? "";
  return fromEnv.length > 0 ? fromEnv : null;
}

async function loadMnotifyEntryForLog(
  apiKey: string,
  providerRef: string,
  recipient: string | null
): Promise<MnotifyReportEntry | null> {
  const ref = providerRef.trim();
  if (!ref) return null;

  if (/^\d+$/.test(ref)) {
    const byId = await fetchMnotifyMessageStatus(apiKey, ref);
    if (byId.ok && byId.report) return byId.report;
  }

  const campaign = await fetchMnotifyCampaignReport(apiKey, ref);
  if (!campaign.ok) return null;
  return findMnotifyReportForRecipient(campaign.report, recipient);
}

/** Log SMS after send, verifying per-recipient status with mNotify when possible. */
export async function logMnotifySmsDelivery(opts: {
  orgId: string;
  guestId: string;
  eventId: string;
  kind: string;
  recipient: string | null;
  messageBody: string;
  smsRes: { ok: boolean; error?: string; campaignId?: string };
}): Promise<void> {
  if (!opts.smsRes.ok) {
    void logGuestNotificationDelivery({
      guestId: opts.guestId,
      eventId: opts.eventId,
      kind: opts.kind,
      deliveryChannel: "SMS",
      status: "FAILED",
      recipient: opts.recipient,
      detail: opts.smsRes.error ?? "SMS could not be sent."
    });
    return;
  }

  const apiKey = await getOrgMnotifyApiKey(opts.orgId);
  let status: "SENT" | "FAILED" = "SENT";
  let detail = "sms";
  let messagePreview = opts.messageBody;
  let providerRef = opts.smsRes.campaignId ?? null;

  if (apiKey && opts.smsRes.campaignId) {
    const verified = await resolveMnotifyRecipientDelivery(
      apiKey,
      opts.smsRes.campaignId,
      opts.recipient,
      opts.messageBody
    );
    status = verified.status;
    detail = verified.detail;
    messagePreview = verified.message;
    providerRef = verified.providerRef;
  }

  void logGuestNotificationDelivery({
    guestId: opts.guestId,
    eventId: opts.eventId,
    kind: opts.kind,
    deliveryChannel: "SMS",
    status,
    recipient: opts.recipient,
    detail,
    messagePreview,
    providerRef,
    errorCode:
      status === "FAILED" ? classifyDeliveryError(detail, "SMS") : null
  });
}

/** Log email after Resend accept; stores message id for later reconciliation. */
export async function logResendEmailDelivery(opts: {
  orgId: string;
  guestId: string;
  eventId: string;
  kind: string;
  recipient: string | null;
  detail?: string;
  messagePreview?: string | null;
  resendMessageId?: string | null;
  sendFailed?: boolean;
  sendError?: string;
}): Promise<void> {
  if (opts.sendFailed) {
    void logGuestNotificationDelivery({
      guestId: opts.guestId,
      eventId: opts.eventId,
      kind: opts.kind,
      deliveryChannel: "EMAIL",
      status: "FAILED",
      recipient: opts.recipient,
      detail: opts.sendError ?? "Email could not be sent."
    });
    return;
  }

  let status: "SENT" | "FAILED" = "SENT";
  let detail = opts.detail ?? "email";
  const messageId = opts.resendMessageId?.trim() || null;

  if (messageId) {
    const apiKey = await getOrgResendApiKey(opts.orgId);
    if (apiKey) {
      const fetched = await fetchResendEmailStatus(apiKey, messageId);
      if (fetched.ok && fetched.record?.last_event) {
        status = mapResendLastEvent(fetched.record.last_event);
        detail = resendStatusDetail(fetched.record.last_event);
      }
    }
  }

  void logGuestNotificationDelivery({
    guestId: opts.guestId,
    eventId: opts.eventId,
    kind: opts.kind,
    deliveryChannel: "EMAIL",
    status,
    recipient: opts.recipient,
    detail,
    messagePreview: opts.messagePreview ?? null,
    providerRef: messageId,
    errorCode: status === "FAILED" ? classifyDeliveryError(detail, "EMAIL") : null
  });
}

/**
 * Refresh a stored log row from mNotify / Resend before showing in the UI.
 * Updates the database when provider status differs from what we recorded.
 */
export async function reconcileGuestNotificationLog(logId: string): Promise<void> {
  const log = await prisma.guestNotificationLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      channel: true,
      status: true,
      detail: true,
      recipient: true,
      providerRef: true,
      messagePreview: true,
      guest: { select: { event: { select: { orgId: true } } } }
    }
  });
  if (!log?.providerRef?.trim()) return;

  const orgId = log.guest.event.orgId;
  const channel = log.channel === "SMS" || log.detail === "sms" ? "SMS" : "EMAIL";

  if (channel === "SMS") {
    const apiKey = await getOrgMnotifyApiKey(orgId);
    if (!apiKey) return;

    const entry = await loadMnotifyEntryForLog(apiKey, log.providerRef, log.recipient);
    if (!entry) return;

    const nextStatus = mapMnotifyDeliveryStatus(entry.status);
    const nextDetail = mnotifyStatusDetail(entry);
    const nextMessage = entry.message?.trim() || log.messagePreview;
    const nextRef = entry._id != null ? String(entry._id) : log.providerRef;

    if (
      nextStatus === log.status &&
      nextDetail === log.detail &&
      nextMessage === log.messagePreview &&
      nextRef === log.providerRef
    ) {
      return;
    }

    await prisma.guestNotificationLog.update({
      where: { id: log.id },
      data: {
        status: nextStatus,
        detail: nextDetail,
        messagePreview: nextMessage,
        providerRef: nextRef,
        errorCode:
          nextStatus === "FAILED" ? classifyDeliveryError(nextDetail, "SMS") : null
      }
    });
    return;
  }

  const apiKey = await getOrgResendApiKey(orgId);
  if (!apiKey) return;

  const fetched = await fetchResendEmailStatus(apiKey, log.providerRef);
  if (!fetched.ok || !fetched.record?.last_event) return;

  const nextStatus = mapResendLastEvent(fetched.record.last_event);
  const nextDetail = resendStatusDetail(fetched.record.last_event);

  if (nextStatus === log.status && nextDetail === log.detail) return;

  await prisma.guestNotificationLog.update({
    where: { id: log.id },
    data: {
      status: nextStatus,
      detail: nextDetail,
      errorCode:
        nextStatus === "FAILED" ? classifyDeliveryError(nextDetail, "EMAIL") : null
    }
  });
}
