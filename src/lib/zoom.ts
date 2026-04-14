const ZOOM_API_BASE = "https://api.zoom.us/v2";

type ZoomTokenResponse = {
  access_token: string;
  expires_in: number;
};

export async function getZoomAccessToken() {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const accountId = process.env.ZOOM_ACCOUNT_ID;

  if (!clientId || !clientSecret || !accountId) {
    throw new Error("Missing Zoom credentials");
  }

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
    throw new Error("Failed to get Zoom token");
  }

  const data = (await response.json()) as ZoomTokenResponse;
  return data.access_token;
}

export async function zoomFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getZoomAccessToken();
  const response = await fetch(`${ZOOM_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Zoom API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

/** Create a Zoom webinar and return IDs/URLs for the Event record. Uses `ZOOM_HOST_USER_ID` (default `me`). */
export async function createZoomWebinar(params: {
  topic: string;
  startTime: Date;
  endDate: Date | null;
  description?: string | null;
}): Promise<{
  zoomMeetingId: string;
  zoomJoinUrl: string;
  zoomPasscode: string | null;
}> {
  const userId = process.env.ZOOM_HOST_USER_ID ?? "me";
  const durationMinutes = params.endDate
    ? Math.max(15, Math.round((params.endDate.getTime() - params.startTime.getTime()) / 60000))
    : 60;

  const token = await getZoomAccessToken();
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
          approval_type: 0
        }
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zoom webinar creation failed (${response.status})`);
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
  params: { email: string; firstName: string; lastName: string }
): Promise<string> {
  const data = await zoomFetch<{ join_url: string }>(
    `/webinars/${encodeURIComponent(webinarId)}/registrants`,
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
