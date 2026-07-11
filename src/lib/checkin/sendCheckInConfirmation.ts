import { AttendMode } from "@prisma/client";

import { sendUnifiedRsvpConfirmationEmail } from "@/lib/email";
import { guestHasDeliverableEmail } from "@/lib/guest/contactRequirements";
import { resolveGuestSmsPortalUrl } from "@/lib/guest/joinLinks";
import { phoneToMnotifyRecipient, sendOrgMnotifyQuickSms } from "@/lib/mnotify";
import { logMnotifySmsDelivery } from "@/lib/delivery/providerDelivery";
import { logGuestNotificationDelivery } from "@/lib/notifications/guestNotificationDispatch";
import { prisma } from "@/lib/prisma";
import { guestQrToPngBase64 } from "@/lib/qr";
import { formatDate, formatLocationLine } from "@/lib/utils";

/**
 * Sends post check-in confirmation email + SMS to the guest (non-blocking for callers).
 */
export async function sendCheckInConfirmationNotifications(guestId: string): Promise<void> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      mode: true,
      qrCode: true,
      zoomLink: true,
      notificationsSuppressedAt: true,
      checkIns: {
        orderBy: { checkedInAt: "desc" },
        take: 1,
        select: { checkedInAt: true }
      },
      event: {
        select: {
          id: true,
          name: true,
          date: true,
          endDate: true,
          description: true,
          blueprintTemplate: true,
          brandLogoUrl: true,
          brandPrimaryColor: true,
          location: { select: { name: true, address: true } },
          org: {
            select: {
              id: true,
              name: true,
              logo: true,
              defaultEventBrandLogoUrl: true,
              resendApiKey: true,
              mnotifyEnabled: true
            }
          }
        }
      }
    }
  });

  if (!guest || guest.notificationsSuppressedAt) return;

  const event = guest.event;
  const resendKey = event.org.resendApiKey?.trim() || undefined;
  const locationLine = formatLocationLine(event.location);
  const checkedInAt = guest.checkIns[0]?.checkedInAt ?? new Date();
  const checkInTimeLabel = formatDate(checkedInAt);
  const attendanceMode =
    guest.mode === AttendMode.VIRTUAL ? ("VIRTUAL" as const) : ("IN_PERSON" as const);
  const hasEmail = guestHasDeliverableEmail(guest.email);
  const portalUrl = await resolveGuestSmsPortalUrl(guest.id);

  const directionsUrl = event.location?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${event.location.name} ${event.location.address}`
      )}`
    : null;

  if (hasEmail && guest.email) {
    try {
      const qrPng = guest.qrCode ? await guestQrToPngBase64(guest.qrCode) : null;

      await sendUnifiedRsvpConfirmationEmail({
        to: guest.email,
        guestName: guest.name,
        eventName: event.name,
        eventDate: checkInTimeLabel,
        locationLine,
        attendanceMode,
        tone: "receipt",
        postCheckIn: true,
        qrPngBase64: qrPng,
        zoomJoinUrl: null,
        joinPageUrl: null,
        directionsUrl,
        brandLogoUrl: event.brandLogoUrl,
        orgLogoUrl: event.org.logo,
        orgDefaultBrandLogoUrl: event.org.defaultEventBrandLogoUrl,
        brandPrimaryColor: event.brandPrimaryColor,
        orgName: event.org.name,
        resendApiKeyOverride: resendKey
      });
      void logGuestNotificationDelivery({
        guestId: guest.id,
        eventId: event.id,
        kind: "checkin_confirm",
        channel: "EMAIL",
        status: "SENT",
        recipient: guest.email,
        detail: "email"
      });
    } catch (e) {
      console.error("[check-in] confirmation email failed", guestId, e);
      void logGuestNotificationDelivery({
        guestId: guest.id,
        eventId: event.id,
        kind: "checkin_confirm",
        channel: "EMAIL",
        status: "FAILED",
        recipient: guest.email,
        detail: e instanceof Error ? e.message : String(e)
      });
    }
  } else {
    void logGuestNotificationDelivery({
      guestId: guest.id,
      eventId: event.id,
      kind: "checkin_confirm",
      channel: "EMAIL",
      status: "SKIPPED",
      detail: "no deliverable email"
    });
  }

  if (!event.org.mnotifyEnabled) {
    if (guest.phone?.trim()) {
      void logGuestNotificationDelivery({
        guestId: guest.id,
        eventId: event.id,
        kind: "checkin_confirm",
        channel: "SMS_ONLY",
        status: "SKIPPED",
        detail: "SMS provider not enabled"
      });
    }
    return;
  }

  const to = phoneToMnotifyRecipient(guest.phone);
  if (!to) {
    void logGuestNotificationDelivery({
      guestId: guest.id,
      eventId: event.id,
      kind: "checkin_confirm",
      channel: "SMS_ONLY",
      status: "SKIPPED",
      recipient: guest.phone,
      detail: "Invalid phone for SMS."
    });
    return;
  }

  const first = guest.name.trim().split(/\s+/)[0] ?? "there";
  let smsBody = `Hi ${first}, you're checked in for ${event.name} at ${checkInTimeLabel}.`;
  if (!hasEmail && portalUrl) {
    smsBody = `${smsBody} Details: ${portalUrl}`;
  }
  smsBody = smsBody.slice(0, 300);

  try {
    const smsRes = await sendOrgMnotifyQuickSms(event.org.id, [to], smsBody);
    await logMnotifySmsDelivery({
      orgId: event.org.id,
      guestId: guest.id,
      eventId: event.id,
      kind: "checkin_confirm",
      recipient: guest.phone,
      messageBody: smsBody,
      smsRes
    });
  } catch (e) {
    console.error("[check-in] confirmation sms failed", guestId, e);
    void logGuestNotificationDelivery({
      guestId: guest.id,
      eventId: event.id,
      kind: "checkin_confirm",
      channel: "SMS_ONLY",
      status: "FAILED",
      recipient: guest.phone,
      detail: e instanceof Error ? e.message : String(e)
    });
  }
}
