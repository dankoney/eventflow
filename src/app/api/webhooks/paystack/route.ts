import { NextResponse } from "next/server";

import { processPaystackWebhook, type PaystackWebhookEnvelope } from "@/lib/billing/processPaystackWebhook";
import { verifyPaystackWebhookPayload } from "@/lib/billing/paystackWebhookVerify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paystack subscription + invoice webhooks.
 *
 * Register in Paystack dashboard:
 *   https://YOUR_HOST/api/webhooks/paystack
 *
 * Required env: PAYSTACK_SECRET_KEY (and optionally PAYSTACK_WEBHOOK_SECRET)
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  try {
    verifyPaystackWebhookPayload(rawBody, signature);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature.";
    console.warn("[paystack-webhook] verification failed:", message);
    return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 400 });
  }

  let envelope: PaystackWebhookEnvelope;
  try {
    envelope = JSON.parse(rawBody) as PaystackWebhookEnvelope;
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed webhook payload." }, { status: 400 });
  }

  if (!envelope?.event || typeof envelope.event !== "string") {
    return NextResponse.json({ ok: false, error: "Malformed webhook payload." }, { status: 400 });
  }

  try {
    const result = await processPaystackWebhook(envelope);
    return NextResponse.json({
      ok: true,
      event: envelope.event,
      loggedEventId: result.loggedEventId,
      duplicate: result.duplicate,
      orgId: result.orgId,
      handled: result.handled,
      orgUnresolved: result.orgUnresolved
    });
  } catch (error) {
    console.error("[paystack-webhook] processing failed", error);
    return NextResponse.json({ ok: false, error: "Webhook processing failed." }, { status: 500 });
  }
}
