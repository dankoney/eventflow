/**
 * In-process webhook processor test (no HTTP server). Run:
 *   RESEND_WEBHOOK_SECRET=whsec_test npm run test:resend-webhook:direct
 */
import { PrismaClient, EmailUnsubscribeSource } from "@prisma/client";

import { processResendWebhook } from "../src/lib/email/processResendWebhook";

const prisma = new PrismaClient();

async function main() {
  const guest = await prisma.guest.findFirst({
    where: { email: { not: null } },
    orderBy: { createdAt: "desc" }
  });
  if (!guest?.email) throw new Error("Need a guest with email in the database.");

  const contact = await prisma.emailContact.upsert({
    where: { guestId: guest.id },
    create: {
      guestId: guest.id,
      email: guest.email.trim().toLowerCase(),
      isSubscribed: true,
      consentRecordedAt: new Date(),
      resendContactId: `fixture-direct-${guest.id}`
    },
    update: {
      isSubscribed: true,
      consentRecordedAt: new Date(),
      unsubscribedAt: null,
      unsubscribeSource: null,
      resendContactId: `fixture-direct-${guest.id}`
    }
  });

  const now = new Date().toISOString();
  const envelope = {
    type: "contact.updated",
    created_at: now,
    data: {
      id: contact.resendContactId,
      email: contact.email,
      unsubscribed: true,
      updated_at: now
    }
  };

  const result = await processResendWebhook(envelope);
  const after = await prisma.emailContact.findUniqueOrThrow({ where: { id: contact.id } });

  if (
    !after.isSubscribed &&
    after.unsubscribeSource === EmailUnsubscribeSource.EMAIL_LINK &&
    after.unsubscribedAt
  ) {
    console.log("OK — direct processor test passed", { result, after });
  } else {
    console.error("FAILED", { after, result });
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
