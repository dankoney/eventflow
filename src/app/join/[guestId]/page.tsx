import { notFound } from "next/navigation";

import { GuestRegistrationPassPanel } from "@/components/join/GuestRegistrationPassPanel";
import { getGuestJoinPassContext } from "@/lib/db/guests";
import { appendZoomJoinUrlDisplayName, guestZoomJoinDisplayLabel } from "@/lib/join/zoomJoinDisplayName";
import { guestQrToPngBase64 } from "@/lib/qr";
import { getOpenZoomJoinAbsoluteUrl, resolveEmailBrandLogoUrl } from "@/lib/url";

type JoinPageProps = {
  params: { guestId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export async function generateMetadata({ params }: JoinPageProps) {
  const ctx = await getGuestJoinPassContext(params.guestId);
  if (!ctx) {
    return { title: "Join · Eventflow" };
  }
  return {
    title: `You're registered · ${ctx.eventName} · Eventflow`
  };
}

export default async function JoinPage({ params, searchParams }: JoinPageProps) {
  const ctx = await getGuestJoinPassContext(params.guestId);
  if (!ctx) notFound();

  const tracked = getOpenZoomJoinAbsoluteUrl(params.guestId);
  const rawZoom = ctx.zoomLink ?? ctx.eventZoomJoinUrl;
  const displayLabel = guestZoomJoinDisplayLabel(ctx.guestName, ctx.guestCompany, ctx.organizationName);
  const rawZoomWithDisplay = rawZoom ? appendZoomJoinUrlDisplayName(rawZoom, displayLabel) : null;
  const zoomJoinHref = tracked ?? rawZoomWithDisplay ?? null;
  const zoomJoinTracksAttendance = Boolean(tracked && rawZoom);

  const qrDataUrl = ctx.qrCode
    ? `data:image/png;base64,${await guestQrToPngBase64(ctx.qrCode)}`
    : null;

  const first = (v: string | string[] | undefined) =>
    v == null ? undefined : Array.isArray(v) ? v[0] : v;
  const zoomMsg = first(searchParams?.msg);
  const zoomFlag = first(searchParams?.zoom);
  const zoomRedirectError = zoomFlag === "1" && zoomMsg ? zoomMsg : null;
  const invite = first(searchParams?.invite);
  const invitationNotice =
    invite === "accepted" ? "accepted" : invite === "invalid" ? "invalid" : null;

  const brandLogoUrlResolved = resolveEmailBrandLogoUrl({
    eventBrandLogoUrl: ctx.brandLogoUrl,
    orgLogoUrl: ctx.orgLogoUrl,
    orgDefaultBrandLogoUrl: ctx.orgDefaultBrandLogoUrl
  });

  return (
    <main className="mx-auto min-h-[60vh] max-w-lg px-4 py-10">
      <GuestRegistrationPassPanel
        ctx={ctx}
        brandLogoUrlResolved={brandLogoUrlResolved}
        qrDataUrl={qrDataUrl}
        zoomJoinHref={zoomJoinHref}
        zoomJoinTracksAttendance={zoomJoinTracksAttendance}
        zoomRedirectError={zoomRedirectError}
        invitationNotice={invitationNotice}
      />
    </main>
  );
}
