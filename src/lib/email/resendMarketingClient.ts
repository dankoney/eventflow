import "server-only";

const RESEND_API_BASE = "https://api.resend.com";

export class ResendMarketingApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Resend API error (${status})`);
    this.name = "ResendMarketingApiError";
    this.status = status;
    this.body = body;
  }
}

type ResendContactObject = {
  object?: string;
  id?: string;
  unsubscribed?: boolean;
};

export async function resendRequest<T>(
  apiKey: string,
  path: string,
  init: RequestInit
): Promise<T> {
  const res = await fetch(`${RESEND_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : undefined;
    throw new ResendMarketingApiError(res.status, body, msg);
  }

  return body as T;
}

export function splitDisplayName(name: string): { firstName?: string; lastName?: string } {
  const trimmed = name.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export type UpsertResendMarketingContactInput = {
  apiKey: string;
  email: string;
  firstName?: string;
  lastName?: string;
  /** Used only when creating a new Resend contact. */
  isSubscribed: boolean;
  /** Known Resend contact id from a prior sync — used for idempotent updates. */
  existingResendContactId?: string | null;
  /** Custom contact properties for broadcast personalization. */
  properties?: Record<string, string>;
};

export type UpsertResendMarketingContactResult = {
  resendContactId: string;
  created: boolean;
  /** True when Resend reports the contact as unsubscribed (never forced back to subscribed on PATCH). */
  resendUnsubscribed: boolean;
};

export async function getResendMarketingContact(
  apiKey: string,
  contactIdOrEmail: string
): Promise<ResendContactObject | null> {
  try {
    return await resendRequest<ResendContactObject>(
      apiKey,
      `/contacts/${encodeURIComponent(contactIdOrEmail)}`,
      { method: "GET" }
    );
  } catch (e) {
    if (e instanceof ResendMarketingApiError && e.status === 404) return null;
    throw e;
  }
}

function buildCreatePayload(input: UpsertResendMarketingContactInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
    unsubscribed: !input.isSubscribed
  };
  if (input.properties && Object.keys(input.properties).length > 0) {
    payload.properties = input.properties;
  }
  return payload;
}

/**
 * PATCH body for existing contacts: never send `unsubscribed: false`.
 * We may set `unsubscribed: true` when local state says not subscribed.
 */
function buildPatchPayload(input: UpsertResendMarketingContactInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    first_name: input.firstName,
    last_name: input.lastName
  };
  if (input.properties && Object.keys(input.properties).length > 0) {
    payload.properties = input.properties;
  }
  if (!input.isSubscribed) {
    payload.unsubscribed = true;
  }
  return payload;
}

/**
 * Creates or updates a global Resend Contact. Uses stored id when present;
 * falls back to email-based update on conflict.
 *
 * Subscription rule: PATCH never forces `unsubscribed: false` — Resend is authoritative
 * for re-subscribe; stale local rows cannot un-suppress someone who unsubscribed on Resend.
 */
export async function upsertResendMarketingContact(
  input: UpsertResendMarketingContactInput
): Promise<UpsertResendMarketingContactResult> {
  if (input.existingResendContactId) {
    try {
      await resendRequest<ResendContactObject>(input.apiKey, `/contacts/${input.existingResendContactId}`, {
        method: "PATCH",
        body: JSON.stringify(buildPatchPayload(input))
      });
      const fetched = await getResendMarketingContact(input.apiKey, input.existingResendContactId);
      return {
        resendContactId: input.existingResendContactId,
        created: false,
        resendUnsubscribed: fetched?.unsubscribed === true
      };
    } catch (e) {
      if (!(e instanceof ResendMarketingApiError) || e.status !== 404) {
        throw e;
      }
    }
  }

  try {
    const created = await resendRequest<ResendContactObject>(input.apiKey, "/contacts", {
      method: "POST",
      body: JSON.stringify(buildCreatePayload(input))
    });
    const id = created.id;
    if (!id) {
      throw new Error("Resend create contact response missing id");
    }
    return {
      resendContactId: id,
      created: true,
      resendUnsubscribed: created.unsubscribed === true
    };
  } catch (e) {
    if (!(e instanceof ResendMarketingApiError)) throw e;
    if (e.status !== 409 && e.status !== 422) throw e;
  }

  await resendRequest<ResendContactObject>(input.apiKey, `/contacts/${encodeURIComponent(input.email)}`, {
    method: "PATCH",
    body: JSON.stringify(buildPatchPayload(input))
  });

  const fetched = await getResendMarketingContact(input.apiKey, input.email);
  const id = fetched?.id;
  if (!id) {
    throw new Error(`Resend contact exists for ${input.email} but id could not be resolved`);
  }
  return {
    resendContactId: id,
    created: false,
    resendUnsubscribed: fetched.unsubscribed === true
  };
}
