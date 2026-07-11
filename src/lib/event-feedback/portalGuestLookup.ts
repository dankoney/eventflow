import { ATTENDED_GUEST_STATUSES } from "@/lib/db/eventFeedback";
import type { NormalizedCredential } from "@/lib/phone/credentialLookup";
import { prisma } from "@/lib/prisma";

export async function findAttendedGuestForFeedback(
  eventId: string,
  credential: Extract<NormalizedCredential, { ok: true }>
) {
  if (credential.kind === "email") {
    return prisma.guest.findFirst({
      where: {
        eventId,
        email: { equals: credential.value, mode: "insensitive" },
        status: { in: ATTENDED_GUEST_STATUSES }
      },
      select: { id: true, feedbackToken: true, feedbackSmsCode: true }
    });
  }

  return prisma.guest.findFirst({
    where: {
      eventId,
      phone: credential.value,
      status: { in: ATTENDED_GUEST_STATUSES }
    },
    select: { id: true, feedbackToken: true, feedbackSmsCode: true }
  });
}
