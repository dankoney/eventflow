"use server";

import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { checkMnotifySenderStatus } from "@/lib/mnotify";
import { prisma } from "@/lib/prisma";
import { getZoomAccessToken, getZoomWebinarHostUserId } from "@/lib/zoom";
import type { ActionResult } from "@/types";

export type IntegrationHealth = "healthy" | "action_required";

export async function testZoomIntegration(): Promise<
  ActionResult<{ status: IntegrationHealth; detail?: string }>
> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const token = await getZoomAccessToken(session.user.orgId);
    const hostId = getZoomWebinarHostUserId();
    const res = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(hostId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const t = await res.text();
      return {
        success: true,
        data: {
          status: "action_required",
          detail: `Zoom API ${res.status} for webinar host "${hostId}": ${t.slice(0, 280)}. Check ZOOM_HOST_USER_ID on the server (licensed webinar user) and scopes (e.g. webinar:write:webinar:admin).`
        }
      };
    }
    const data = (await res.json()) as { id?: string; email?: string };
    const hostLabel = data.email ?? data.id ?? hostId;
    return {
      success: true,
      data: {
        status: "healthy",
        detail:
          hostId === "me"
            ? `Host ${hostLabel} (me). If webinar creation still fails, add ZOOM_HOST_USER_ID to a user with a Webinar add-on.`
            : `Webinar host ${hostLabel} (${hostId}).`
      }
    };
  } catch (e) {
    return {
      success: true,
      data: {
        status: "action_required",
        detail: e instanceof Error ? e.message : "Could not reach Zoom"
      }
    };
  }
}

export async function testResendIntegration(): Promise<
  ActionResult<{ status: IntegrationHealth; detail?: string }>
> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: { resendApiKey: true }
  });
  const apiKey = org?.resendApiKey?.trim() || process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: true, data: { status: "action_required", detail: "No Resend API key (org or env)." } };
  }

  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) {
      const t = await res.text();
      return {
        success: true,
        data: { status: "action_required", detail: `Resend: ${res.status} ${t.slice(0, 160)}` }
      };
    }
    const data = (await res.json()) as { data?: Array<{ name: string; status: string }> };
    const domains = data.data ?? [];
    const verified = domains.filter((d) => d.status === "verified");
    const from = process.env.RESEND_FROM?.trim() ?? "";
    const usingSandboxFrom =
      !from || from.includes("onboarding@resend.dev") || /@resend\.dev/i.test(from);

    if (verified.length > 0) {
      const fromHint =
        from && !usingSandboxFrom
          ? ` RESEND_FROM is set; ensure that sender domain is verified (current: ${from.split("<").pop()?.trim().replace(">", "") ?? "see server env"}).`
          : usingSandboxFrom
            ? " Set RESEND_FROM on the server to e.g. Eventflow <noreply@yourdomain.com> after DNS verification."
            : "";
      return {
        success: true,
        data: {
          status: "healthy" as const,
          detail: `${verified.length} verified domain(s).${fromHint}`
        }
      };
    }

    const sandboxExplain = usingSandboxFrom
      ? " The default sender onboarding@resend.dev only delivers to your Resend account email—invites and guest mail to anyone else will fail until you fix this."
      : "";
    return {
      success: true,
      data: {
        status: "action_required" as const,
        detail: `API key works, but no verified sending domain was found in Resend. Add a domain under Resend → Domains, complete DNS, then set RESEND_FROM on this server to an address on that domain (e.g. Eventflow <noreply@example.com>).${sandboxExplain}`
      }
    };
  } catch (e) {
    return {
      success: true,
      data: {
        status: "action_required",
        detail: e instanceof Error ? e.message : "Resend request failed"
      }
    };
  }
}

export async function testMnotifyIntegration(): Promise<
  ActionResult<{ status: IntegrationHealth; detail?: string }>
> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: { mnotifyApiKey: true, mnotifySenderId: true }
  });
  const apiKey = org?.mnotifyApiKey?.trim() || process.env.MNOTIFY_API_KEY?.trim() || "";
  const sender = org?.mnotifySenderId?.trim() ?? "";
  if (!apiKey) {
    return {
      success: true,
      data: { status: "action_required", detail: "Add an mNotify API key (organization or MNOTIFY_API_KEY on server)." }
    };
  }
  if (!sender) {
    return {
      success: true,
      data: { status: "action_required", detail: "Add your registered sender ID (max 11 characters)." }
    };
  }

  try {
    const r = await checkMnotifySenderStatus(apiKey, sender);
    if (!r.ok) {
      return { success: true, data: { status: "action_required", detail: r.detail } };
    }
    return { success: true, data: { status: "healthy", detail: r.detail } };
  } catch (e) {
    return {
      success: true,
      data: {
        status: "action_required",
        detail: e instanceof Error ? e.message : "mNotify request failed"
      }
    };
  }
}

export async function testWhatsappIntegration(): Promise<
  ActionResult<{ status: IntegrationHealth; detail?: string }>
> {
  const session = await auth();
  if (!session?.user?.orgId || session.user.role !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: { whatsappAccessToken: true, whatsappPhoneNumberId: true }
  });
  if (!org?.whatsappAccessToken || !org.whatsappPhoneNumberId) {
    return {
      success: true,
      data: { status: "action_required", detail: "Configure access token and Phone number ID." }
    };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(org.whatsappPhoneNumberId)}?fields=display_phone_number,verified_name`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${org.whatsappAccessToken}` }
    });
    if (!res.ok) {
      const t = await res.text();
      return {
        success: true,
        data: { status: "action_required", detail: `Meta: ${res.status} ${t.slice(0, 160)}` }
      };
    }
    const data = (await res.json()) as { display_phone_number?: string; verified_name?: string };
    return {
      success: true,
      data: {
        status: "healthy",
        detail: data.display_phone_number ?? data.verified_name ?? "Phone ID valid"
      }
    };
  } catch (e) {
    return {
      success: true,
      data: {
        status: "action_required",
        detail: e instanceof Error ? e.message : "Meta request failed"
      }
    };
  }
}
