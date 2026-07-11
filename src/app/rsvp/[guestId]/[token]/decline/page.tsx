import { notFound } from "next/navigation";
import { EventStatus, GuestStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { formatDate, formatLocationLine } from "@/lib/utils";

import { RsvpDeclineForm } from "./RsvpDeclineForm";

type PageProps = {
  params: { guestId: string; token: string };
};

export const dynamic = "force-dynamic";

export default async function RsvpDeclinePage({ params }: PageProps) {
  const guest = await prisma.guest.findFirst({
    where: { id: params.guestId, invitationToken: params.token },
    select: {
      id: true,
      name: true,
      status: true,
      declineReason: true,
      declineNote: true,
      eventId: true,
      event: {
        select: {
          name: true,
          date: true,
          status: true,
          type: true,
          brandPrimaryColor: true,
          brandLogoUrl: true,
          location: { select: { name: true, address: true } },
          org: { select: { name: true } }
        }
      }
    }
  });

  if (!guest) notFound();
  await syncEventStatusForEvent(guest.eventId);

  const event = guest.event;
  const eventCancelled =
    event.status === EventStatus.CANCELLED || event.status === EventStatus.COMPLETED;
  const alreadyDeclined = guest.status === GuestStatus.DECLINED;
  const isInPersonOnly = event.type === "IN_PERSON" || event.type === "HYBRID";

  const accent = event.brandPrimaryColor?.trim() || "#22d3ee";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-xl px-6 py-12">
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
          We&apos;ll miss you, {firstNameOf(guest.name)}.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Could you let us know why you can&apos;t attend? This helps us plan better events for you
          and your colleagues.
        </p>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-semibold text-zinc-900">{event.name}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {formatDate(event.date)} · {formatLocationLine(event.location)}
          </div>
        </div>

        {eventCancelled ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This event is no longer accepting changes. Your record has not been modified.
          </div>
        ) : (
          <div className="mt-6">
            <RsvpDeclineForm
              guestId={guest.id}
              token={params.token}
              accent={accent}
              alreadyDeclined={alreadyDeclined}
              priorReason={guest.declineReason}
              priorNote={guest.declineNote}
              showVirtualOption={isInPersonOnly}
            />
          </div>
        )}

        <p className="mt-10 text-[11px] uppercase tracking-wider text-zinc-400">
          Sent via Eventflow · Your response is shared only with the event organizer.
        </p>
      </div>
    </main>
  );
}

function firstNameOf(name: string): string {
  const f = name.trim().split(/\s+/)[0];
  return f && f.length > 0 ? f : "there";
}
