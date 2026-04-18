import { prisma } from "@/lib/prisma";

/** Sends a simple text via Cloud API when org is configured (recipient must allow sandbox in dev). */
export async function sendOrgWhatsAppText(
  orgId: string,
  toE164: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      whatsappEnabled: true,
      whatsappAccessToken: true,
      whatsappPhoneNumberId: true
    }
  });
  if (!org?.whatsappEnabled || !org.whatsappAccessToken || !org.whatsappPhoneNumberId) {
    return { ok: false, error: "WhatsApp not configured" };
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(org.whatsappPhoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${org.whatsappAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164.replace(/\D/g, ""),
        type: "text",
        text: { body: body.slice(0, 4096) }
      })
    }
  );

  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: t.slice(0, 200) };
  }
  return { ok: true };
}
