import "server-only";

import {
  ResendMarketingApiError,
  resendRequest
} from "@/lib/email/resendMarketingClient";

export { ResendMarketingApiError };

type ResendIdObject = { id?: string; object?: string };

/** Per-recipient merge tags synced as Resend contact properties. */
export const BROADCAST_CONTACT_PROPERTY_KEYS = [
  "first_name",
  "guest_name",
  "guest_email",
  "event_name",
  "event_date",
  "event_url",
  "guest_category",
  "company"
] as const;

export async function ensureBroadcastContactProperties(apiKey: string): Promise<void> {
  for (const key of BROADCAST_CONTACT_PROPERTY_KEYS) {
    try {
      await resendRequest(apiKey, "/contact-properties", {
        method: "POST",
        body: JSON.stringify({
          key,
          type: "string",
          fallback_value: key === "first_name" ? "there" : ""
        })
      });
    } catch (e) {
      if (e instanceof ResendMarketingApiError && (e.status === 409 || e.status === 422)) {
        continue;
      }
      throw e;
    }
  }
}

export async function createResendSegment(
  apiKey: string,
  name: string
): Promise<string> {
  const created = await resendRequest<ResendIdObject>(apiKey, "/segments", {
    method: "POST",
    body: JSON.stringify({ name })
  });
  if (!created.id) {
    throw new Error("Resend create segment response missing id");
  }
  return created.id;
}

export async function addContactToResendSegment(
  apiKey: string,
  contactId: string,
  segmentId: string
): Promise<void> {
  await resendRequest(
    apiKey,
    `/contacts/${encodeURIComponent(contactId)}/segments/${encodeURIComponent(segmentId)}`,
    { method: "POST" }
  );
}

export type CreateResendBroadcastInput = {
  apiKey: string;
  segmentId: string;
  from: string;
  subject: string;
  html: string;
  name?: string;
  send?: boolean;
  scheduledAt?: string;
};

export async function createResendBroadcast(
  input: CreateResendBroadcastInput
): Promise<string> {
  const body: Record<string, unknown> = {
    segment_id: input.segmentId,
    from: input.from,
    subject: input.subject,
    html: input.html,
    send: input.send ?? false
  };
  if (input.name) body.name = input.name;

  // Resend docs: scheduled_at requires send:true; when scheduled_at is set the broadcast
  // is queued for later — it does not send immediately.
  if (input.scheduledAt) {
    if (!input.send) {
      throw new Error("Resend scheduled_at requires send: true.");
    }
    body.scheduled_at = input.scheduledAt;
    body.send = true;
  } else if (input.send) {
    body.send = true;
  }

  const created = await resendRequest<ResendIdObject>(input.apiKey, "/broadcasts", {
    method: "POST",
    body: JSON.stringify(body)
  });
  if (!created.id) {
    throw new Error("Resend create broadcast response missing id");
  }
  return created.id;
}
