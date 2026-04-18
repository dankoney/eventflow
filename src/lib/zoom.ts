import { ZoomSessionKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const ZOOM_API_BASE = "https://api.zoom.us/v2";

/** Zoom caps scheduled meeting/webinar duration (minutes); longer spans return 400. */
const MAX_ZOOM_SESSION_DURATION_MINUTES = 30 * 24 * 60;

type ZoomTokenResponse = {
  access_token: string;
  expires_in: number;
};

export type ZoomCredentialSet = {
  clientId: string;
  clientSecret: string;
  accountId: string;
};

/** User ID or email for `POST /users/{userId}/webinars` (Server-to-Server). Defaults to `me`. */
export function getZoomWebinarHostUserId(): string {
  const raw = process.env.ZOOM_HOST_USER_ID?.trim();
  return raw && raw.length > 0 ? raw : "me";
}

async function resolveZoomCredentials(orgId: string | null | undefined): Promise<ZoomCredentialSet> {
  if (orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { zoomClientId: true, zoomClientSecret: true, zoomAccountId: true }
    });
    if (org?.zoomClientId && org.zoomClientSecret && org.zoomAccountId) {
      return {
        clientId: org.zoomClientId,
        clientSecret: org.zoomClientSecret,
        accountId: org.zoomAccountId
      };
    }
  }

  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const accountId = process.env.ZOOM_ACCOUNT_ID;

  if (!clientId || !clientSecret || !accountId) {
    throw new Error("Missing Zoom credentials (configure org integrations or environment variables)");
  }

  return { clientId, clientSecret, accountId };
}

export async function getZoomAccessToken(orgId?: string | null) {
  const { clientId, clientSecret, accountId } = await resolveZoomCredentials(orgId);

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`
      }
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(summarizeZoomErrorResponse(response.status, body));
  }

  const data = (await response.json()) as ZoomTokenResponse;
  return data.access_token;
}

function summarizeZoomErrorResponse(status: number, body: string): string {
  const trimmed = body.trim().slice(0, 800);
  try {
    const j = JSON.parse(body) as { code?: number | string; message?: string; reason?: string };
    const parts: string[] = [`HTTP ${status}`];
    if (j.code !== undefined && j.code !== "") parts.push(`code ${j.code}`);
    if (j.reason) parts.push(String(j.reason));
    if (j.message) parts.push(j.message);
    if (parts.length > 1) return parts.join(" — ");
  } catch {
    /* use trimmed */
  }
  return trimmed ? `HTTP ${status}: ${trimmed}` : `HTTP ${status}`;
}

export async function zoomFetch<T>(path: string, orgId: string | null | undefined, init?: RequestInit): Promise<T> {
  const token = await getZoomAccessToken(orgId);
  const response = await fetch(`${ZOOM_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zoom API ${summarizeZoomErrorResponse(response.status, body)}`);
  }

  return (await response.json()) as T;
}

/** Create a Zoom webinar and return IDs/URLs for the Event record. Uses `ZOOM_HOST_USER_ID` (default `me`). */
export async function createZoomWebinar(
  params: {
    topic: string;
    startTime: Date;
    endDate: Date;
    description?: string | null;
  },
  orgId: string
): Promise<{
  zoomMeetingId: string;
  zoomJoinUrl: string;
  zoomPasscode: string | null;
}> {
  const userId = getZoomWebinarHostUserId();
  const rawMinutes = Math.max(
    15,
    Math.round((params.endDate.getTime() - params.startTime.getTime()) / 60000)
  );
  const durationMinutes = Math.min(rawMinutes, MAX_ZOOM_SESSION_DURATION_MINUTES);

  const token = await getZoomAccessToken(orgId);
  const response = await fetch(
    `${ZOOM_API_BASE}/users/${encodeURIComponent(userId)}/webinars`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        topic: params.topic,
        type: 5,
        start_time: params.startTime.toISOString().replace(/\.\d{3}Z$/, "Z"),
        duration: durationMinutes,
        agenda: params.description?.slice(0, 2000) ?? "",
        timezone: "UTC",
        settings: {
          /**
           * Auto-approve registrants so Eventflow can add attendees via the registrants API
           * (personal join URLs + first/last name as shown in Zoom).
           */
          approval_type: 0
        }
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zoom webinar create failed — ${summarizeZoomErrorResponse(response.status, body)}`);
  }

  const data = (await response.json()) as {
    id: number;
    join_url: string;
    password?: string;
  };

  return {
    zoomMeetingId: String(data.id),
    zoomJoinUrl: data.join_url,
    zoomPasscode: data.password ?? null
  };
}

/** Register an attendee for a webinar; returns personal join URL. */
export async function registerWebinarRegistrant(
  webinarId: string,
  params: { email: string; firstName: string; lastName: string },
  orgId: string
): Promise<string> {
  const data = await zoomFetch<{ join_url: string }>(
    `/webinars/${encodeURIComponent(webinarId)}/registrants`,
    orgId,
    {
      method: "POST",
      body: JSON.stringify({
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName
      })
    }
  );
  return data.join_url;
}

function zoomSessionDurationMinutes(startTime: Date, endDate: Date): number {
  const rawMinutes = Math.max(15, Math.round((endDate.getTime() - startTime.getTime()) / 60000));
  return Math.min(rawMinutes, MAX_ZOOM_SESSION_DURATION_MINUTES);
}

/**
 * Scheduled meeting (type 2); no Zoom registration (`approval_type: 2`) — everyone uses the shared `join_url`.
 * Participant names in Zoom come from each attendee’s Zoom client / profile, not Eventflow.
 */
export async function createZoomMeeting(
  params: {
    topic: string;
    startTime: Date;
    endDate: Date;
    description?: string | null;
  },
  orgId: string
): Promise<{
  zoomMeetingId: string;
  zoomJoinUrl: string;
  zoomPasscode: string | null;
}> {
  const userId = getZoomWebinarHostUserId();
  const durationMinutes = zoomSessionDurationMinutes(params.startTime, params.endDate);

  const token = await getZoomAccessToken(orgId);
  const response = await fetch(`${ZOOM_API_BASE}/users/${encodeURIComponent(userId)}/meetings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      topic: params.topic,
      type: 2,
      start_time: params.startTime.toISOString().replace(/\.\d{3}Z$/, "Z"),
      duration: durationMinutes,
      agenda: params.description?.slice(0, 2000) ?? "",
      timezone: "UTC",
      settings: {
        /** No Zoom registration page — join URL is a direct link for all attendees. */
        approval_type: 2
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zoom meeting create failed — ${summarizeZoomErrorResponse(response.status, body)}`);
  }

  const data = (await response.json()) as {
    id?: number;
    join_url?: string;
    password?: string;
  };

  if (data.id == null || !data.join_url) {
    throw new Error("Zoom meeting create returned an unexpected response.");
  }

  return {
    zoomMeetingId: String(data.id),
    zoomJoinUrl: data.join_url,
    zoomPasscode: data.password ?? null
  };
}

export async function registerMeetingRegistrant(
  meetingId: string,
  params: { email: string; firstName: string; lastName: string },
  orgId: string
): Promise<string> {
  const data = await zoomFetch<{ join_url: string }>(
    `/meetings/${encodeURIComponent(meetingId)}/registrants`,
    orgId,
    {
      method: "POST",
      body: JSON.stringify({
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName
      })
    }
  );
  return data.join_url;
}

export async function createZoomVirtualSession(
  kind: ZoomSessionKind,
  params: {
    topic: string;
    startTime: Date;
    endDate: Date;
    description?: string | null;
  },
  orgId: string
): Promise<{
  zoomMeetingId: string;
  zoomJoinUrl: string;
  zoomPasscode: string | null;
}> {
  if (kind === ZoomSessionKind.MEETING) {
    return createZoomMeeting(params, orgId);
  }
  return createZoomWebinar(params, orgId);
}

/**
 * Webinar registrant display in Zoom: `first_name` = guest display name, `last_name` = " (Your Org)".
 * Org label is the company the guest entered on the published registration form when present,
 * otherwise the Eventflow workspace (organization) name. Zoom allows 64 characters per field.
 */
export function zoomRegistrantNameParts(
  displayName: string,
  guestCompany: string | null | undefined,
  workspaceOrganizationName: string
): { firstName: string; lastName: string } {
  const orgRaw = guestCompany?.trim() || workspaceOrganizationName.trim() || "Org";
  const inner = orgRaw.slice(0, 61);
  const lastName = ` (${inner})`.slice(0, 64);
  const trimmed = displayName.trim() || "Guest";
  const firstName = trimmed.slice(0, 64);
  return { firstName, lastName };
}
