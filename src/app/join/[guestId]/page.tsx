import { notFound } from "next/navigation";

import { VirtualJoinPanel } from "@/components/join/VirtualJoinPanel";
import { getGuestJoinContext } from "@/lib/db/guests";
import { appendZoomJoinUrlDisplayName, guestZoomJoinDisplayLabel } from "@/lib/join/zoomJoinDisplayName";
import { getOpenZoomJoinAbsoluteUrl } from "@/lib/url";

type JoinPageProps = {
  params: { guestId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export async function generateMetadata({ params }: JoinPageProps) {
  const ctx = await getGuestJoinContext(params.guestId);
  if (!ctx) {
    return { title: "Join · Eventflow" };
  }
  return {
    title: `${ctx.eventName} · ${ctx.mode === "VIRTUAL" ? "Virtual join" : "Event"} · Eventflow`
  };
}

export default async function JoinPage({ params, searchParams }: JoinPageProps) {
  const ctx = await getGuestJoinContext(params.guestId);
  if (!ctx) notFound();

  const tracked = getOpenZoomJoinAbsoluteUrl(params.guestId);
  const rawZoom = ctx.zoomLink ?? ctx.eventZoomJoinUrl;
  const displayLabel = guestZoomJoinDisplayLabel(ctx.guestName, ctx.guestCompany, ctx.organizationName);
  const rawZoomWithDisplay = rawZoom ? appendZoomJoinUrlDisplayName(rawZoom, displayLabel) : null;
  const zoomJoinHref = tracked ?? rawZoomWithDisplay ?? null;
  const zoomJoinTracksAttendance = Boolean(tracked && rawZoom);
  const first = (v: string | string[] | undefined) =>
    v == null ? undefined : Array.isArray(v) ? v[0] : v;
  const zoomMsg = first(searchParams?.msg);
  const zoomFlag = first(searchParams?.zoom);
  const zoomRedirectError = zoomFlag === "1" && zoomMsg ? zoomMsg : null;

  return (
    <main className="mx-auto min-h-[60vh] max-w-2xl px-4 py-10">
      <VirtualJoinPanel
        guestId={params.guestId}
        guestName={ctx.guestName}
        mode={ctx.mode}
        status={ctx.status}
        zoomJoinHref={zoomJoinHref}
        zoomJoinTracksAttendance={zoomJoinTracksAttendance}
        zoomRedirectError={zoomRedirectError}
        eventName={ctx.eventName}
        eventDateIso={ctx.eventDate.toISOString()}
        eventLocation={ctx.eventLocation}
        zoomMeetingId={ctx.zoomMeetingId}
        zoomPasscode={ctx.zoomPasscode}
        zoomSessionKind={ctx.zoomSessionKind}
        organizationName={ctx.organizationName}
        eventStatus={ctx.eventStatus}
      />
    </main>
  );
}
