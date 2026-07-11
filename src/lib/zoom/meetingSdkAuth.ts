import { createHmac } from "crypto";

import { prisma } from "@/lib/prisma";

export type MeetingSdkCredentialSet = {
  sdkKey: string;
  sdkSecret: string;
};

function base64Url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

/** Meeting SDK JWT (role 0 = participant, 1 = host). */
export function createMeetingSdkJwt(params: {
  sdkKey: string;
  sdkSecret: string;
  meetingNumber: string;
  role: 0 | 1;
}): string {
  const iat = Math.floor(Date.now() / 1000) - 30;
  /** Zoom requires exp/tokenExp at least 1800s after iat. */
  const exp = iat + 60 * 60 * 2;
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    appKey: params.sdkKey,
    /** Required by Zoom sample JWTs (same value as appKey / Client ID). */
    sdkKey: params.sdkKey,
    mn: params.meetingNumber.replace(/\D/g, ""),
    role: params.role,
    iat,
    exp,
    tokenExp: exp,
    video_webrtc_mode: 1
  };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", params.sdkSecret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function envMeetingSdkCredentials(): MeetingSdkCredentialSet | null {
  const sdkKey =
    process.env.ZOOM_MEETING_SDK_KEY?.trim() ||
    process.env.ZOOM_SDK_KEY?.trim() ||
    process.env.NEXT_PUBLIC_ZOOM_MEETING_SDK_KEY?.trim() ||
    process.env.NEXT_PUBLIC_ZOOM_SDK_KEY?.trim();
  const sdkSecret =
    process.env.ZOOM_MEETING_SDK_SECRET?.trim() || process.env.ZOOM_SDK_SECRET?.trim();
  if (sdkKey && sdkSecret) {
    return { sdkKey, sdkSecret };
  }
  return null;
}

/** Org-stored Meeting SDK credentials, then server environment fallback. */
export async function resolveMeetingSdkCredentialsForOrg(
  orgId: string
): Promise<MeetingSdkCredentialSet | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { zoomMeetingSdkKey: true, zoomMeetingSdkSecret: true }
  });
  const key = org?.zoomMeetingSdkKey?.trim();
  const secret = org?.zoomMeetingSdkSecret?.trim();
  if (key && secret) {
    return { sdkKey: key, sdkSecret: secret };
  }
  return envMeetingSdkCredentials();
}

export async function getPublicMeetingSdkKeyForOrg(orgId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { zoomMeetingSdkKey: true }
  });
  const key = org?.zoomMeetingSdkKey?.trim();
  if (key) return key;
  return envMeetingSdkCredentials()?.sdkKey ?? null;
}

/** Environment-only Meeting SDK credentials (no org row). */
export function resolveMeetingSdkCredentialsStrict(): MeetingSdkCredentialSet | null {
  return envMeetingSdkCredentials();
}

/** @deprecated Use {@link resolveMeetingSdkCredentialsForOrg}. */
export async function resolveMeetingSdkCredentials(orgId: string): Promise<MeetingSdkCredentialSet | null> {
  return resolveMeetingSdkCredentialsForOrg(orgId);
}

export function getPublicMeetingSdkKey(): string | null {
  return resolveMeetingSdkCredentialsStrict()?.sdkKey ?? null;
}
