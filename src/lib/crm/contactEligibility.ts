import { z } from "zod";

import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";
import { isZoomSyntheticAnonEmail } from "@/lib/zoom/anonRosterName";

const emailSchema = z.string().email();

/** Real inbox addresses only — excludes Zoom walk-in synthetic emails. */
export function isCrmEligibleEmail(raw: string | null | undefined): boolean {
  const e = (raw ?? "").trim().toLowerCase();
  if (!e) return false;
  if (isZoomSyntheticAnonEmail(e)) return false;
  if (e.endsWith("@external.eventflow")) return false;
  return emailSchema.safeParse(e).success;
}

/** CRM sync and “invite from CRM” require a deliverable address and E.164 mobile (SMS / identity). */
export function isCrmInviteableProfile(email: string | null | undefined, phone: string | null | undefined): boolean {
  if (!isCrmEligibleEmail(email)) return false;
  const p = phone?.trim();
  if (!p || !isValidE164(p)) return false;
  return true;
}
