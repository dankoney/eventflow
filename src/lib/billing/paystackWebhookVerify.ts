import { createHmac, timingSafeEqual } from "crypto";

function getPaystackWebhookSecret(): string {
  const dedicated = process.env.PAYSTACK_WEBHOOK_SECRET?.trim();
  if (dedicated) return dedicated;
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (secretKey) return secretKey;
  throw new Error("PAYSTACK_WEBHOOK_SECRET or PAYSTACK_SECRET_KEY must be configured.");
}

/**
 * Verify Paystack `x-paystack-signature` (HMAC SHA512 of raw body).
 */
export function verifyPaystackWebhookPayload(rawBody: string, signatureHeader: string | null): void {
  if (!signatureHeader?.trim()) {
    throw new Error("Missing x-paystack-signature header.");
  }

  const digest = createHmac("sha512", getPaystackWebhookSecret()).update(rawBody).digest("hex");
  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(signatureHeader.trim(), "utf8");

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("Invalid Paystack webhook signature.");
  }
}
