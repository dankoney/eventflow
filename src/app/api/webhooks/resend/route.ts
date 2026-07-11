import { NextResponse } from "next/server";

import { processResendWebhook, type ResendWebhookEnvelope } from "@/lib/email/processResendWebhook";
import { readResendWebhookHeaders, verifyResendWebhookPayload } from "@/lib/email/resendWebhookVerify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resend marketing + delivery webhooks (Svix-signed).
 *
 * Register in Resend dashboard:
 *   https://eventflow.cosabonita.tech/api/webhooks/resend
 * (or your NEXTAUTH_URL / PUBLIC_APP_URL origin + `/api/webhooks/resend`)
 *
 * Required env: RESEND_WEBHOOK_SECRET (whsec_… from the webhook details page)
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "RESEND_WEBHOOK_SECRET is not configured." },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const svixHeaders = readResendWebhookHeaders(request.headers);

  let verified: unknown;
  try {
    verified = verifyResendWebhookPayload(rawBody, svixHeaders, webhookSecret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid webhook signature.";
    console.warn("[resend-webhook] verification failed:", message);
    return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 400 });
  }

  const envelope = verified as ResendWebhookEnvelope;
  if (!envelope?.type || typeof envelope.type !== "string") {
    return NextResponse.json({ ok: false, error: "Malformed webhook payload." }, { status: 400 });
  }

  try {
    const result = await processResendWebhook(envelope);
    return NextResponse.json({
      ok: true,
      type: envelope.type,
      loggedEventId: result.loggedEventId,
      contactUnsubscribed: result.contactUnsubscribed,
      recipientUpdated: result.recipientUpdated
    });
  } catch (e) {
    console.error("[resend-webhook] processing failed", e);
    return NextResponse.json({ ok: false, error: "Webhook processing failed." }, { status: 500 });
  }
}
