"use server";

import { Role, ZoomSessionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createMeetingSdkJwt,
  resolveMeetingSdkCredentialsForOrg
} from "@/lib/zoom/meetingSdkAuth";
import { validateZoomPasscode, zoomPasscodeForApi } from "@/lib/zoom/passcode";
import {
  createZoomVirtualSession,
  getZoomHostZakToken,
  refreshZoomVirtualSessionCredentials,
  type ZoomSessionCredentials
} from "@/lib/zoom";
import { ActionResult } from "@/types";

function canManageZoomSessions(role: Role): boolean {
  return role === Role.ADMIN || role === Role.MARKETING;
}

function canHostZoomSession(role: Role): boolean {
  return role === Role.ADMIN;
}

const regenerateSchema = z
  .object({
    eventId: z.string().min(1),
    passcodeMode: z.enum(["default", "custom"]),
    customPasscode: z.string().max(10).optional()
  })
  .superRefine((data, ctx) => {
    if (data.passcodeMode === "custom") {
      const v = validateZoomPasscode(data.customPasscode ?? "");
      if (!v.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: v.message,
          path: ["customPasscode"]
        });
      }
    }
  });

export async function regenerateEventZoomCredentials(
  input: z.input<typeof regenerateSchema>
): Promise<ActionResult<ZoomSessionCredentials>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canManageZoomSessions(session.user.role)) {
    return { success: false, error: "You do not have permission to manage Zoom sessions." };
  }

  const parsed = regenerateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: {
      id: true,
      zoomMeetingId: true,
      zoomSessionKind: true,
      virtualCapacity: true
    }
  });
  if (!event) return { success: false, error: "Event not found" };
  if (!event.zoomMeetingId || event.virtualCapacity <= 0) {
    return { success: false, error: "This event has no provisioned Zoom room to refresh." };
  }

  const password = zoomPasscodeForApi(parsed.data.passcodeMode, parsed.data.customPasscode);

  try {
    const creds = await refreshZoomVirtualSessionCredentials(
      event.zoomSessionKind,
      event.zoomMeetingId,
      session.user.orgId,
      { password }
    );
    await prisma.event.update({
      where: { id: event.id },
      data: {
        zoomJoinUrl: creds.zoomJoinUrl,
        zoomStartUrl: creds.zoomStartUrl,
        zoomPasscode: creds.zoomPasscode
      }
    });
    revalidatePath(`/events/${event.id}`);
    revalidatePath(`/events/${event.id}/edit`);
    revalidatePath(`/events/${event.id}/settings`);
    return { success: true, data: creds };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not refresh Zoom credentials"
    };
  }
}

const hostLaunchSchema = z.object({
  eventId: z.string().min(1)
});

export type ZoomHostLaunchPayload = {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  password: string;
  userName: string;
  userEmail: string;
  zak: string;
  zoomSessionKind: ZoomSessionKind;
  oauthClientId: string | null;
  /** Shown when OAuth Client ID ≠ Meeting SDK Client ID (common join failure). */
  credentialMismatchWarning: string | null;
  /** Native Zoom client host URL — never share with guests. */
  startUrl: string | null;
  joinUrl: string;
};

export async function getZoomHostLaunchPayload(
  input: z.input<typeof hostLaunchSchema>
): Promise<ActionResult<ZoomHostLaunchPayload>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canHostZoomSession(session.user.role)) {
    return { success: false, error: "Only workspace administrators can launch as host." };
  }

  const parsed = hostLaunchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid request" };
  }

  const [event, org] = await Promise.all([
    prisma.event.findFirst({
      where: { id: parsed.data.eventId, orgId: session.user.orgId },
      select: {
        zoomMeetingId: true,
        zoomJoinUrl: true,
        zoomStartUrl: true,
        zoomPasscode: true,
        virtualCapacity: true,
        zoomSessionKind: true
      }
    }),
    prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: { zoomClientId: true, zoomMeetingSdkKey: true }
    })
  ]);
  if (!event?.zoomMeetingId || !event.zoomJoinUrl || event.virtualCapacity <= 0) {
    return { success: false, error: "No Zoom session is provisioned for this event." };
  }

  const sdkCreds = await resolveMeetingSdkCredentialsForOrg(session.user.orgId);
  if (!sdkCreds?.sdkKey || !sdkCreds.sdkSecret) {
    return {
      success: false,
      error:
        "Meeting SDK is not configured. Add Client ID and Client Secret under Settings → Integrations → Zoom (Meeting SDK section), or set ZOOM_MEETING_SDK_KEY and ZOOM_MEETING_SDK_SECRET on the server."
    };
  }

  const oauthClientId = org?.zoomClientId?.trim() || process.env.ZOOM_CLIENT_ID?.trim() || null;
  const meetingSdkClientId = org?.zoomMeetingSdkKey?.trim() || sdkCreds.sdkKey;
  const credentialMismatchWarning =
    oauthClientId && meetingSdkClientId && oauthClientId !== meetingSdkClientId
      ? "Server-to-Server OAuth Client ID and Meeting SDK Client ID are different. Host launch may fail unless both apps belong to the same Zoom account and are configured for host ZAK + JWT."
      : null;

  try {
    const zak = await getZoomHostZakToken(session.user.orgId);
    const signature = createMeetingSdkJwt({
      sdkKey: sdkCreds.sdkKey,
      sdkSecret: sdkCreds.sdkSecret,
      meetingNumber: event.zoomMeetingId,
      role: 1
    });
    return {
      success: true,
      data: {
        sdkKey: sdkCreds.sdkKey,
        signature,
        meetingNumber: event.zoomMeetingId.replace(/\D/g, ""),
        password: event.zoomPasscode ?? "",
        userName: session.user.name?.trim() || "Host",
        userEmail: session.user.email?.trim() || "",
        zak,
        zoomSessionKind: event.zoomSessionKind,
        oauthClientId,
        credentialMismatchWarning,
        startUrl: event.zoomStartUrl,
        joinUrl: event.zoomJoinUrl
      }
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not prepare host launch"
    };
  }
}

const provisionWithPasscodeSchema = z.object({
  eventId: z.string().min(1),
  passcodeMode: z.enum(["default", "custom"]),
  customPasscode: z.string().max(10).optional()
});

/** Provision Zoom for an event that has virtual capacity but no meeting yet. */
export async function provisionEventZoomRoom(
  input: z.input<typeof provisionWithPasscodeSchema>
): Promise<ActionResult<ZoomSessionCredentials>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };
  if (!canManageZoomSessions(session.user.role)) {
    return { success: false, error: "You do not have permission to provision Zoom." };
  }

  const parsed = provisionWithPasscodeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId }
  });
  if (!event) return { success: false, error: "Event not found" };
  if (event.zoomMeetingId) {
    return { success: false, error: "Zoom is already provisioned for this event." };
  }
  if (event.virtualCapacity <= 0) {
    return { success: false, error: "Enable virtual capacity before provisioning Zoom." };
  }

  const password =
    parsed.data.passcodeMode === "custom" ? parsed.data.customPasscode?.trim() || null : null;

  try {
    const creds = await createZoomVirtualSession(
      event.zoomSessionKind,
      {
        topic: event.name,
        startTime: event.date,
        endDate: event.endDate,
        description: event.description,
        password
      },
      session.user.orgId
    );
    await prisma.event.update({
      where: { id: event.id },
      data: {
        zoomMeetingId: creds.zoomMeetingId,
        zoomJoinUrl: creds.zoomJoinUrl,
        zoomStartUrl: creds.zoomStartUrl,
        zoomPasscode: creds.zoomPasscode
      }
    });
    revalidatePath(`/events/${event.id}`);
    return { success: true, data: creds };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not provision Zoom room"
    };
  }
}
