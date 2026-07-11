"use server";

import { notFound } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { notificationKindLabel } from "@/lib/delivery/errorCodes";
import {
  buildCustomMessagePreview,
  buildSystemNotificationPreview,
  type DeliveryMessageDetail
} from "@/lib/delivery/messagePreview";
import { getEventForUser } from "@/lib/db/events";
import { reconcileGuestNotificationLog } from "@/lib/delivery/providerDelivery";
import { guardModuleAction } from "@/lib/features/moduleGuards";
import { canManageEventGuests } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/types";

const detailSchema = z.object({
  rowId: z.string().min(1),
  eventId: z.string().min(1)
});

export async function getDeliveryMessageDetail(
  input: z.input<typeof detailSchema>
): Promise<ActionResult<DeliveryMessageDetail>> {
  const blocked = guardModuleAction("deliveries");
  if (blocked) return blocked;

  const session = await auth();
  if (!session?.user?.orgId || !canManageEventGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = detailSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  if (
    !(await getEventForUser(
      parsed.data.eventId,
      session.user.orgId,
      session.user.id,
      session.user.role
    ))
  ) {
    notFound();
  }

  const { rowId, eventId } = parsed.data;

  if (rowId.startsWith("sys:")) {
    const logId = rowId.slice(4);
    const log = await prisma.guestNotificationLog.findFirst({
      where: { id: logId, eventId, guest: { event: { orgId: session.user.orgId } } },
      select: {
        id: true,
        guestId: true,
        eventId: true,
        kind: true,
        channel: true,
        status: true,
        detail: true,
        recipient: true,
        providerRef: true,
        messagePreview: true,
        createdAt: true,
        guest: { select: { name: true, event: { select: { name: true } } } }
      }
    });
    if (!log) return { success: false, error: "Delivery record not found." };

    await reconcileGuestNotificationLog(log.id);

    const refreshed = await prisma.guestNotificationLog.findFirst({
      where: { id: logId, eventId },
      select: {
        id: true,
        guestId: true,
        eventId: true,
        kind: true,
        channel: true,
        status: true,
        detail: true,
        recipient: true,
        providerRef: true,
        messagePreview: true,
        createdAt: true,
        guest: { select: { name: true, event: { select: { name: true } } } }
      }
    });
    if (!refreshed) return { success: false, error: "Delivery record not found." };

    const detail = await buildSystemNotificationPreview({
      logId: refreshed.id,
      guestId: refreshed.guestId,
      eventId: refreshed.eventId,
      kind: refreshed.kind,
      storedChannel: refreshed.channel,
      detail: refreshed.detail,
      messagePreview: refreshed.messagePreview,
      status: refreshed.status,
      recipient: refreshed.recipient,
      providerRef: refreshed.providerRef,
      createdAt: refreshed.createdAt,
      guestName: refreshed.guest.name,
      eventName: refreshed.guest.event.name
    });
    return {
      success: true,
      data: { ...detail, kindLabel: notificationKindLabel(refreshed.kind) }
    };
  }

  if (rowId.startsWith("msg:")) {
    const deliveryId = rowId.slice(4);
    const delivery = await prisma.guestMessageDelivery.findFirst({
      where: {
        id: deliveryId,
        campaign: { eventId, event: { orgId: session.user.orgId } }
      },
      select: { id: true }
    });
    if (!delivery) return { success: false, error: "Delivery record not found." };

    const detail = await buildCustomMessagePreview(deliveryId);
    if (!detail) return { success: false, error: "Delivery record not found." };
    return {
      success: true,
      data: { ...detail, kindLabel: notificationKindLabel("custom_message") }
    };
  }

  return { success: false, error: "Invalid delivery reference." };
}
