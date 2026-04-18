import { ZoomSessionKind } from "@prisma/client";

import { zoomFetch } from "@/lib/zoom";

/** Row from Zoom report or dashboard metrics (field names vary by endpoint). */
export type ZoomReportParticipant = {
  id?: string;
  user_id?: string;
  name?: string;
  user_name?: string;
  participant_user_name?: string;
  user_email?: string;
  email?: string;
  join_time?: string;
};

type ParticipantsPage = {
  participants?: ZoomReportParticipant[];
  next_page_token?: string;
};

function reportPathForSession(zoomSessionKind: ZoomSessionKind, meetingOrWebinarId: string): string {
  const id = encodeURIComponent(meetingOrWebinarId);
  return zoomSessionKind === ZoomSessionKind.WEBINAR
    ? `/report/webinars/${id}/participants`
    : `/report/meetings/${id}/participants`;
}

/**
 * Paginated participant list from Zoom Reports (past sessions).
 * Requires OAuth scope `report:read:admin` on the Server-to-Server app.
 * `user_email` may be empty depending on Zoom account settings and join method.
 */
export async function fetchZoomParticipantReport(
  zoomSessionKind: ZoomSessionKind,
  meetingOrWebinarId: string,
  orgId: string
): Promise<ZoomReportParticipant[]> {
  const basePath = reportPathForSession(zoomSessionKind, meetingOrWebinarId);
  const out: ZoomReportParticipant[] = [];
  let nextPageToken: string | undefined;

  do {
    const qs = new URLSearchParams({ page_size: "300" });
    if (nextPageToken) qs.set("next_page_token", nextPageToken);
    const data = await zoomFetch<ParticipantsPage>(`${basePath}?${qs.toString()}`, orgId);
    const batch = data.participants ?? [];
    out.push(...batch);
    nextPageToken = data.next_page_token && data.next_page_token.length > 0 ? data.next_page_token : undefined;
  } while (nextPageToken);

  return out;
}

export function participantEmailFromReport(p: ZoomReportParticipant): string | null {
  const raw = (p.user_email ?? p.email ?? "").trim().toLowerCase();
  return raw.length > 0 ? raw : null;
}

/** Zoom `id` or `user_id` — use for dedupe and `zoomParticipantReportId`. */
export function participantStableId(p: ZoomReportParticipant): string | null {
  const id = (p.id ?? p.user_id ?? "").trim();
  return id.length > 0 ? id : null;
}

/** @deprecated use {@link participantStableId} */
export function participantReportId(p: ZoomReportParticipant): string | null {
  return participantStableId(p);
}

function asOptionalString(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function normalizeDashboardParticipant(raw: Record<string, unknown>): ZoomReportParticipant {
  return {
    id: asOptionalString(raw.id) ?? asOptionalString(raw.participant_user_id),
    user_id: asOptionalString(raw.user_id),
    name: asOptionalString(raw.name) ?? asOptionalString(raw.user_name) ?? asOptionalString(raw.participant_user_name),
    user_email: asOptionalString(raw.user_email),
    email: asOptionalString(raw.email),
    join_time: asOptionalString(raw.join_time)
  };
}

/**
 * Dashboard metrics participants (often available **during** a live meeting).
 * Scopes: `dashboard_meetings:read:admin` or `dashboard_webinars:read:admin`.
 */
export async function fetchZoomDashboardParticipants(
  zoomSessionKind: ZoomSessionKind,
  meetingOrWebinarId: string,
  orgId: string,
  meetingType: "live" | "past" | "pastOne"
): Promise<ZoomReportParticipant[]> {
  const enc = encodeURIComponent(meetingOrWebinarId);
  const base =
    zoomSessionKind === ZoomSessionKind.WEBINAR
      ? `/metrics/webinars/${enc}/participants`
      : `/metrics/meetings/${enc}/participants`;
  const out: ZoomReportParticipant[] = [];
  let nextPageToken: string | undefined;

  do {
    const qs = new URLSearchParams({ page_size: "300", type: meetingType });
    if (nextPageToken) qs.set("next_page_token", nextPageToken);
    const data = await zoomFetch<{ participants?: Record<string, unknown>[] }>(
      `${base}?${qs.toString()}`,
      orgId
    );
    const batch = (data.participants ?? []).map((r) => normalizeDashboardParticipant(r));
    out.push(...batch);
    nextPageToken =
      (data as { next_page_token?: string }).next_page_token &&
      (data as { next_page_token?: string }).next_page_token!.length > 0
        ? (data as { next_page_token: string }).next_page_token
        : undefined;
  } while (nextPageToken);

  return out;
}

/** Merge report + dashboard rows; on key collision fills in missing name/email fields. */
export function mergeZoomParticipantRows(rows: ZoomReportParticipant[]): ZoomReportParticipant[] {
  const map = new Map<string, ZoomReportParticipant>();
  const displayRaw = (p: ZoomReportParticipant) =>
    (p.name ?? p.user_name ?? p.participant_user_name ?? "").trim();

  for (const p of rows) {
    const stable = participantStableId(p);
    const email = participantEmailFromReport(p);
    const disp = displayRaw(p);
    const key = stable ?? email ?? `anon:${(p.join_time ?? "").trim()}:${disp}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...p });
      continue;
    }
    map.set(key, {
      ...existing,
      ...p,
      id: existing.id ?? p.id,
      user_id: existing.user_id ?? p.user_id,
      name: existing.name ?? p.name ?? existing.user_name ?? p.user_name,
      user_name: existing.user_name ?? p.user_name,
      participant_user_name: existing.participant_user_name ?? p.participant_user_name,
      user_email: existing.user_email ?? p.user_email,
      email: existing.email ?? p.email,
      join_time: existing.join_time ?? p.join_time
    });
  }
  return [...map.values()];
}
