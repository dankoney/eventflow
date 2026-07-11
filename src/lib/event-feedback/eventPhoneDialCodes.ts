import { parseStoredPhoneToForm } from "@/lib/phone/publicRegistrationPhone";
import {
  DEFAULT_PHONE_DIAL,
  PHONE_DIAL_OPTIONS,
  type PhoneDialOption
} from "@/lib/register/phoneDialOptions";
import { prisma } from "@/lib/prisma";

/** Dial codes present on registered guests for this event (for feedback phone lookup). */
export async function getEventFeedbackPhoneDialOptions(eventId: string): Promise<PhoneDialOption[]> {
  const guests = await prisma.guest.findMany({
    where: { eventId, phone: { not: null } },
    select: { phone: true }
  });

  const dialCodes = new Set<string>();
  for (const guest of guests) {
    const { dial } = parseStoredPhoneToForm(guest.phone);
    if (dial) dialCodes.add(dial);
  }

  if (dialCodes.size === 0) {
    const fallback = PHONE_DIAL_OPTIONS.find((o) => o.value === DEFAULT_PHONE_DIAL);
    return fallback ? [fallback] : [{ value: DEFAULT_PHONE_DIAL, country: "Ghana" }];
  }

  const options = PHONE_DIAL_OPTIONS.filter((o) => dialCodes.has(o.value));

  if (options.length === 0) {
    const fallback = PHONE_DIAL_OPTIONS.find((o) => o.value === DEFAULT_PHONE_DIAL);
    return fallback ? [fallback] : [{ value: DEFAULT_PHONE_DIAL, country: "Ghana" }];
  }

  return options.sort((a, b) => a.country.localeCompare(b.country));
}
