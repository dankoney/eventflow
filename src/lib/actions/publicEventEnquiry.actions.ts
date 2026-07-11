"use server";

import { EventStatus } from "@prisma/client";
import { z } from "zod";

import { sendTransactionalEmail, formatResendErrorForClient } from "@/lib/email";
import { parsePublicEventExperience } from "@/lib/public-event/experience";
import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/types";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const enquirySchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().email("Enter a valid email."),
  message: z.string().trim().min(10, "Please write at least a few sentences.").max(4000)
});

function formatZodError(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join(" | ");
}

export async function submitPublicEventEnquiry(
  input: z.input<typeof enquirySchema>
): Promise<ActionResult<{ ok: true }>> {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await prisma.event.findFirst({
    where: {
      id: parsed.data.eventId,
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] }
    },
    select: {
      id: true,
      name: true,
      publicExperience: true,
      org: { select: { name: true, resendApiKey: true } }
    }
  });
  if (!event) {
    return { success: false, error: "This event is not open for enquiries." };
  }

  const experience = parsePublicEventExperience(event.publicExperience);
  const to = experience.contact?.email?.trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return {
      success: false,
      error: "The organizer has not published a contact email for this event yet."
    };
  }

  const resendKey = event.org.resendApiKey?.trim() || undefined;
  const subject = `Event enquiry: ${event.name}`;
  const html = `
    <p><strong>${escapeHtml(event.org.name)}</strong> — public page enquiry for <strong>${escapeHtml(event.name)}</strong></p>
    <p><strong>From:</strong> ${escapeHtml(parsed.data.name)} &lt;${escapeHtml(parsed.data.email)}&gt;</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
    <p style="white-space:pre-wrap">${escapeHtml(parsed.data.message)}</p>
    <p style="color:#64748b;font-size:13px;margin-top:24px">Reply directly to this person at ${escapeHtml(parsed.data.email)}.</p>
  `;

  try {
    await sendTransactionalEmail({
      to,
      subject,
      html,
      replyTo: parsed.data.email,
      resendApiKeyOverride: resendKey
    });
    return { success: true, data: { ok: true } };
  } catch (e) {
    return { success: false, error: formatResendErrorForClient(e) };
  }
}
