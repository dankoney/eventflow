import { Webhook } from "svix";

export type ResendWebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export function readResendWebhookHeaders(headers: Headers): ResendWebhookHeaders {
  return {
    id: headers.get("svix-id"),
    timestamp: headers.get("svix-timestamp"),
    signature: headers.get("svix-signature")
  };
}

export function verifyResendWebhookPayload(
  rawBody: string,
  headerValues: ResendWebhookHeaders,
  webhookSecret: string
): unknown {
  const { id, timestamp, signature } = headerValues;
  if (!id || !timestamp || !signature) {
    throw new Error("Missing Svix webhook headers (svix-id, svix-timestamp, svix-signature).");
  }

  const wh = new Webhook(webhookSecret);
  return wh.verify(rawBody, {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": signature
  });
}
