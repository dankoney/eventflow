import { classifyDeliveryError } from "@/lib/delivery/errorCodes";
import { resolveStoredDeliveryChannel } from "@/lib/delivery/deliveryChannel";
import { guestHasDeliverableEmail } from "@/lib/guest/contactRequirements";
import { prisma } from "@/lib/prisma";

export type NotificationChannel = "EMAIL" | "SMS" | "SMS_ONLY" | "BOTH" | "NONE";

export type ResolvedGuestChannels = {
  email: boolean;
  sms: boolean;
  channel: NotificationChannel;
};

export function resolveGuestNotificationChannels(guest: {
  email: string | null | undefined;
  phone: string | null | undefined;
}): ResolvedGuestChannels {
  const email = guestHasDeliverableEmail(guest.email);
  const sms = Boolean(guest.phone?.trim());
  let channel: NotificationChannel = "NONE";
  if (email && sms) channel = "BOTH";
  else if (email) channel = "EMAIL";
  else if (sms) channel = "SMS_ONLY";
  return { email, sms, channel };
}

export async function logGuestNotificationDelivery(opts: {
  guestId: string;
  eventId: string;
  kind: string;
  /** @deprecated Prefer deliveryChannel — legacy BOTH conflates separate email/SMS attempts. */
  channel?: NotificationChannel;
  /** Actual channel for this single delivery attempt. */
  deliveryChannel?: "EMAIL" | "SMS";
  status: "SENT" | "SKIPPED" | "FAILED";
  detail?: string | null;
  recipient?: string | null;
  errorCode?: string | null;
  providerRef?: string | null;
  messagePreview?: string | null;
}): Promise<void> {
  const storedChannel =
    opts.deliveryChannel ??
    resolveStoredDeliveryChannel(opts.channel ?? "EMAIL", opts.detail);

  const errorCode =
    opts.errorCode ??
    (opts.status === "FAILED" || opts.status === "SKIPPED"
      ? classifyDeliveryError(opts.detail, storedChannel)
      : null);

  try {
    await prisma.guestNotificationLog.create({
      data: {
        guestId: opts.guestId,
        eventId: opts.eventId,
        kind: opts.kind,
        channel: storedChannel,
        status: opts.status,
        detail: opts.detail?.trim() || null,
        recipient: opts.recipient?.trim() || null,
        errorCode,
        providerRef: opts.providerRef?.trim() || null,
        messagePreview: opts.messagePreview?.trim() || null
      }
    });
  } catch (e) {
    console.error("[notification] log write failed", e);
  }
}
