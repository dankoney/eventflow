"use server";

import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { z } from "zod";

import { sendSignInOtpEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address")
});

export async function requestLoginOtp(
  input: z.input<typeof emailSchema>
): Promise<ActionResult<{ sent: true }>> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const email = parsed.data.email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      return { success: true, data: { sent: true } };
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const token = await bcrypt.hash(code, 10);
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires
      }
    });

    await sendSignInOtpEmail({ to: email, code });
    return { success: true, data: { sent: true } };
  } catch {
    return {
      success: false,
      error: "Could not send sign-in email. Check RESEND_API_KEY and try again."
    };
  }
}
