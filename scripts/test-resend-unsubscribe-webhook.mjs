#!/usr/bin/env node
/**
 * Integration fixture: signs a Resend `contact.updated` (unsubscribed) webhook with Svix
 * and POSTs it to `/api/webhooks/resend`, then asserts the EmailContact row unsubscribed.
 *
 * Usage:
 *   RESEND_WEBHOOK_SECRET=whsec_... npm run dev   # separate terminal
 *   RESEND_WEBHOOK_SECRET=whsec_... node scripts/test-resend-unsubscribe-webhook.mjs
 *
 * Options:
 *   --base-url https://eventflow.cosabonita.tech
 *   --email-contact-id <cuid>   (default: picks latest subscribed contact or seeds one)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, EmailUnsubscribeSource } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

function parseArgs(argv) {
  const args = { baseUrl: null, emailContactId: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base-url") args.baseUrl = argv[++i] ?? null;
    else if (a === "--email-contact-id") args.emailContactId = argv[++i] ?? null;
  }
  return args;
}

function signSvixPayload(secret, msgId, timestamp, payload) {
  const keyPart = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = Buffer.from(keyPart, "base64");
  const signed = `${msgId}.${timestamp}.${payload}`;
  const digest = crypto.createHmac("sha256", key).update(signed, "utf8").digest("base64");
  return `v1,${digest}`;
}

function buildUnsubscribeEnvelope(contact) {
  const now = new Date().toISOString();
  return {
    type: "contact.updated",
    created_at: now,
    data: {
      id: contact.resendContactId ?? `test-contact-${contact.id}`,
      email: contact.email,
      first_name: "Test",
      last_name: "Fixture",
      unsubscribed: true,
      created_at: now,
      updated_at: now
    }
  };
}

async function ensureSubscribedContact(prisma, emailContactId) {
  if (emailContactId) {
    const row = await prisma.emailContact.findUnique({ where: { id: emailContactId } });
    if (!row) throw new Error(`EmailContact ${emailContactId} not found`);
    await prisma.emailContact.update({
      where: { id: row.id },
      data: {
        isSubscribed: true,
        consentRecordedAt: row.consentRecordedAt ?? new Date(),
        unsubscribedAt: null,
        unsubscribeSource: null,
        resendContactId: row.resendContactId ?? `fixture-${row.id}`
      }
    });
    return prisma.emailContact.findUniqueOrThrow({ where: { id: row.id } });
  }

  let row = await prisma.emailContact.findFirst({
    where: { isSubscribed: true },
    orderBy: { updatedAt: "desc" }
  });
  if (row) {
    await prisma.emailContact.update({
      where: { id: row.id },
      data: {
        unsubscribedAt: null,
        unsubscribeSource: null,
        resendContactId: row.resendContactId ?? `fixture-${row.id}`
      }
    });
    return prisma.emailContact.findUniqueOrThrow({ where: { id: row.id } });
  }

  const guest = await prisma.guest.findFirst({
    where: { email: { not: null } },
    orderBy: { createdAt: "desc" }
  });
  if (!guest?.email) {
    throw new Error(
      "No EmailContact or Guest with email in DB. Pass --email-contact-id or create a contact first."
    );
  }

  row = await prisma.emailContact.upsert({
    where: { guestId: guest.id },
    create: {
      guestId: guest.id,
      email: guest.email.trim().toLowerCase(),
      isSubscribed: true,
      consentRecordedAt: new Date(),
      resendContactId: `fixture-${guest.id}`
    },
    update: {
      isSubscribed: true,
      consentRecordedAt: new Date(),
      unsubscribedAt: null,
      unsubscribeSource: null,
      resendContactId: `fixture-${guest.id}`
    }
  });
  return row;
}

async function postWebhook(baseUrl, secret, envelope) {
  const payload = JSON.stringify(envelope);
  const msgId = `msg_fixture_${Date.now()}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signSvixPayload(secret, msgId, timestamp, payload);

  const url = `${baseUrl.replace(/\/$/, "")}/api/webhooks/resend`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": msgId,
      "svix-timestamp": timestamp,
      "svix-signature": signature
    },
    body: payload
  });
  const body = await res.text();
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    json = { raw: body };
  }
  return { status: res.status, json, url };
}

async function main() {
  const args = parseArgs(process.argv);
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("RESEND_WEBHOOK_SECRET is required (whsec_… from Resend webhook details).");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const contact = await ensureSubscribedContact(prisma, args.emailContactId);
    console.log(`Using EmailContact ${contact.id} (${contact.email}), subscribed=${contact.isSubscribed}`);

    const envelope = buildUnsubscribeEnvelope(contact);

    const baseUrl =
      args.baseUrl ??
      process.env.PUBLIC_APP_URL ??
      process.env.NEXTAUTH_URL ??
      "http://127.0.0.1:3000";
    console.log(`Mode: HTTP POST → ${baseUrl}/api/webhooks/resend`);
    const { status, json, url } = await postWebhook(baseUrl, secret, envelope);
    console.log(`POST ${url} → ${status}`, json);
    if (status !== 200 || !json?.ok) {
      throw new Error(`Webhook endpoint returned ${status}`);
    }

    const after = await prisma.emailContact.findUniqueOrThrow({ where: { id: contact.id } });
    const lastEvent = await prisma.emailEvent.findFirst({
      where: { eventType: "contact.updated" },
      orderBy: { receivedAt: "desc" }
    });

    const ok =
      after.isSubscribed === false &&
      after.unsubscribedAt instanceof Date &&
      after.unsubscribeSource === EmailUnsubscribeSource.EMAIL_LINK;

    if (!ok) {
      console.error("ASSERTION FAILED — contact after webhook:", after);
      process.exit(1);
    }

    if (!lastEvent) {
      console.error("ASSERTION FAILED — no EmailEvent row logged");
      process.exit(1);
    }

    console.log("OK — contact unsubscribed and EmailEvent logged.");
    console.log({
      emailContactId: after.id,
      isSubscribed: after.isSubscribed,
      unsubscribedAt: after.unsubscribedAt,
      unsubscribeSource: after.unsubscribeSource,
      emailEventId: lastEvent.id
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
