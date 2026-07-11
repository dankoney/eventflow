import { notFound } from "next/navigation";
import { AttendMode, EventStatus, GuestStatus } from "@prisma/client";

import { formatMarketingConsentLabel, shouldShowMarketingOptIn } from "@/lib/email/marketingOptIn";
import { prisma } from "@/lib/prisma";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { eventHasVirtualJoinFromConfig } from "@/lib/event-schedule/multiDayConfig";
import { formatDate, formatLocationLine } from "@/lib/utils";

import { RsvpAcceptForm } from "./RsvpAcceptForm";
import { RsvpPresenceConfirmCard } from "./RsvpPresenceConfirmCard";
import { rsvpPageHero } from "./rsvpPageCopy";

type PageProps = {
  params: { guestId: string; token: string };
  searchParams?: { edit?: string };
};

export const dynamic = "force-dynamic";

export default async function RsvpAcceptPage({ params, searchParams }: PageProps) {
  const editMode = searchParams?.edit === "1";
  const guest = await prisma.guest.findFirst({
    where: { id: params.guestId, invitationToken: params.token },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      mode: true,
      status: true,
      rsvpConfirmedAt: true,
      accommodationRequested: true,
      accommodationDetails: true,
      eventId: true,
      event: {
        select: {
          id: true,
          name: true,
          date: true,
          status: true,
          type: true,
          description: true,
          blueprintTemplate: true,
          accommodationTravelNotes: true,
          virtualCapacity: true,
          scheduleMode: true,
          multiDayConfig: true,
          zoomJoinUrl: true,
          zoomMeetingId: true,
          brandLogoUrl: true,
          brandPrimaryColor: true,
          location: { select: { name: true, address: true, city: true } },
          org: {
            select: {
              name: true,
              marketingEmailEnabled: true,
              marketingConsentCopy: true,
              marketingPrivacyPolicyUrl: true
            }
          }
        }
      }
    }
  });

  if (!guest) notFound();
  await syncEventStatusForEvent(guest.eventId);

  const event = guest.event;
  const cancelled =
    event.status === EventStatus.CANCELLED || event.status === EventStatus.COMPLETED;
  const accent = event.brandPrimaryColor?.trim() || "#22d3ee";
  const allowsInPerson = event.type === "IN_PERSON" || event.type === "HYBRID";
  const allowsVirtual =
    (event.type === "VIRTUAL" || event.type === "HYBRID") &&
    event.virtualCapacity > 0 &&
    eventHasVirtualJoinFromConfig({
      virtualCapacity: event.virtualCapacity,
      scheduleMode: event.scheduleMode,
      multiDayConfig: event.multiDayConfig,
      zoomJoinUrl: event.zoomJoinUrl,
      zoomMeetingId: event.zoomMeetingId
    });
  const eventIsLive = event.status === EventStatus.LIVE;
  // Phase 3 — show the single big "Confirm my presence" card instead of the full
  // RSVP form when this guest already picked in-person and the event is now LIVE.
  // Already-checked-in guests land on the success state, so a re-click still
  // looks coherent. Doesn't apply for VIRTUAL-only events.
  const showPresenceConfirm =
    !editMode &&
    eventIsLive &&
    event.type !== "VIRTUAL" &&
    guest.mode === AttendMode.IN_PERSON &&
    guest.status !== GuestStatus.DECLINED &&
    guest.status !== GuestStatus.NO_SHOW;
  const startAsCheckedIn = guest.status === GuestStatus.CHECKED_IN;

  const hero = rsvpPageHero({
    blueprint: event.blueprintTemplate,
    firstName: firstNameOf(guest.name),
    alreadyConfirmed: Boolean(guest.rsvpConfirmedAt),
    eventIsLive
  });

  const marketingOrg = {
    name: event.org.name,
    marketingEmailEnabled: event.org.marketingEmailEnabled,
    marketingConsentCopy: event.org.marketingConsentCopy,
    marketingPrivacyPolicyUrl: event.org.marketingPrivacyPolicyUrl
  };
  const showMarketingOptIn = shouldShowMarketingOptIn(
    { blueprintTemplate: event.blueprintTemplate },
    marketingOrg
  );

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-center gap-3">
          {event.brandLogoUrl ? (
            <img
              src={event.brandLogoUrl}
              alt={event.org.name}
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: accent }}
            >
              {event.org.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {event.org.name}
          </div>
        </div>

        <h1 className="mt-8 font-[Manrope,Inter,system-ui] text-3xl font-extrabold tracking-tight text-zinc-900">
          {hero.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{hero.subtitle}</p>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-base font-semibold text-zinc-900">{event.name}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {formatDate(event.date)} · {formatLocationLine(event.location)}
          </div>
          {event.description?.trim() ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-700">
              {event.description.trim().slice(0, 320)}
              {event.description.length > 320 ? "…" : ""}
            </p>
          ) : null}
        </div>

        {cancelled ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This event is no longer accepting RSVPs.
          </div>
        ) : showPresenceConfirm ? (
          <div className="mt-6">
            <RsvpPresenceConfirmCard
              guestId={guest.id}
              token={params.token}
              accent={accent}
              firstName={firstNameOf(guest.name)}
              eventName={event.name}
              startAsCheckedIn={startAsCheckedIn}
              editRsvpHref={`/rsvp/${guest.id}/${params.token}?edit=1`}
            />
          </div>
        ) : (
          <div className="mt-6">
            <RsvpAcceptForm
              guestId={guest.id}
              token={params.token}
              accent={accent}
              prefill={{
                name: guest.name,
                email: guest.email ?? "",
                phone: guest.phone ?? "",
                company: guest.company,
                jobTitle: guest.jobTitle,
                mode: guest.mode,
                accommodationRequested: guest.accommodationRequested,
                accommodationDetails: guest.accommodationDetails
              }}
              allowsInPerson={allowsInPerson}
              allowsVirtual={allowsVirtual}
              blueprintTemplate={event.blueprintTemplate}
              eventIsLive={eventIsLive}
              accommodationTravelNotes={event.accommodationTravelNotes}
              alreadyConfirmed={Boolean(guest.rsvpConfirmedAt)}
              showMarketingOptIn={showMarketingOptIn}
              marketingConsentLabel={formatMarketingConsentLabel(marketingOrg)}
              marketingPrivacyPolicyUrl={marketingOrg.marketingPrivacyPolicyUrl}
            />
          </div>
        )}

        <p className="mt-10 text-[11px] uppercase tracking-wider text-zinc-400">
          This link is unique to you. Sent via Eventflow.
        </p>
      </div>
    </main>
  );
}

function firstNameOf(name: string): string {
  const f = name.trim().split(/\s+/)[0];
  return f && f.length > 0 ? f : "there";
}
