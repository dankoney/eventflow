import { prisma } from "@/lib/prisma";
import { mintFeedbackSmsCode } from "@/lib/event-feedback/feedbackLinks";
import { getGuestJoinSmsAbsoluteUrl, getJoinPageAbsoluteUrl } from "@/lib/url";

type GuestJoinLinkRow = {
  id: string;
  joinSmsCode: string | null;
};

/** Ensures a guest has a short SMS code for `/j/[code]` → `/join/[guestId]`. */
export async function ensureGuestJoinSmsCode(
  guest: GuestJoinLinkRow | string
): Promise<string | null> {
  const guestId = typeof guest === "string" ? guest : guest.id;
  let code = typeof guest === "string" ? null : guest.joinSmsCode;

  if (!code) {
    const row = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { joinSmsCode: true }
    });
    code = row?.joinSmsCode ?? null;
  }
  if (code) return code;

  for (let attempt = 0; attempt < 8; attempt++) {
    const next = mintFeedbackSmsCode();
    try {
      const updated = await prisma.guest.update({
        where: { id: guestId },
        data: { joinSmsCode: next },
        select: { joinSmsCode: true }
      });
      if (updated.joinSmsCode) return updated.joinSmsCode;
    } catch {
      const refreshed = await prisma.guest.findUnique({
        where: { id: guestId },
        select: { joinSmsCode: true }
      });
      if (refreshed?.joinSmsCode) return refreshed.joinSmsCode;
    }
  }

  return null;
}

/** Short `/j/[code]` URL for SMS; falls back to full join page if code mint fails. */
export async function resolveGuestSmsPortalUrl(guestId: string): Promise<string | null> {
  const code = await ensureGuestJoinSmsCode(guestId);
  if (code) {
    return getGuestJoinSmsAbsoluteUrl(code);
  }
  return getJoinPageAbsoluteUrl(guestId);
}
