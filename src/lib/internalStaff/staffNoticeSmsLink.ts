import { InternalStaffCheckInMode } from "@prisma/client";

import { mintFeedbackSmsCode } from "@/lib/event-feedback/feedbackLinks";
import { prisma } from "@/lib/prisma";
import {
  getEventRegistrationAbsoluteUrl,
  getInternalStaffMagicCheckInUrl,
  getStaffNoticeSmsAbsoluteUrl
} from "@/lib/url";

type StaffNoticeSmsGuestRow = {
  id: string;
  staffNoticeSmsCode: string | null;
};

/** Ensures a guest has a short SMS code for `/s/[code]` → staff check-in URL. */
export async function ensureStaffNoticeSmsCode(
  guest: StaffNoticeSmsGuestRow | string
): Promise<string | null> {
  const guestId = typeof guest === "string" ? guest : guest.id;
  let code = typeof guest === "string" ? null : guest.staffNoticeSmsCode;

  if (!code) {
    const row = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { staffNoticeSmsCode: true }
    });
    code = row?.staffNoticeSmsCode ?? null;
  }
  if (code) return code;

  for (let attempt = 0; attempt < 8; attempt++) {
    const next = mintFeedbackSmsCode();
    try {
      const updated = await prisma.guest.update({
        where: { id: guestId },
        data: { staffNoticeSmsCode: next },
        select: { staffNoticeSmsCode: true }
      });
      if (updated.staffNoticeSmsCode) return updated.staffNoticeSmsCode;
    } catch {
      const refreshed = await prisma.guest.findUnique({
        where: { id: guestId },
        select: { staffNoticeSmsCode: true }
      });
      if (refreshed?.staffNoticeSmsCode) return refreshed.staffNoticeSmsCode;
    }
  }

  return null;
}

/**
 * Compact `/s/[code]` URL for staff notice SMS; falls back to the full check-in URL.
 */
export async function resolveStaffNoticeSmsUrl(params: {
  guestId: string;
  eventId: string;
  internalCheckInMode: InternalStaffCheckInMode;
  internalCheckInToken: string | null;
}): Promise<string | null> {
  const personalMode = params.internalCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK;
  const fullUrl =
    personalMode && params.internalCheckInToken
      ? getInternalStaffMagicCheckInUrl(params.eventId, params.internalCheckInToken)
      : getEventRegistrationAbsoluteUrl(params.eventId);

  const code = await ensureStaffNoticeSmsCode(params.guestId);
  if (code) {
    return getStaffNoticeSmsAbsoluteUrl(code);
  }
  return fullUrl;
}
