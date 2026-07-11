import { EventStatus, EventType } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CheckInBoothShell } from "@/components/checkin-booth/CheckInBoothShell";
import { WalkInCheckInBoothClient } from "@/components/checkin-booth/WalkInCheckInBoothClient";
import { isWalkInBoothOpen, walkInBoothStatusMessage } from "@/lib/checkin/walkInBoothWindow";
import { parseRegistrationProfile } from "@/lib/event-wizard/registrationProfile";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { prisma } from "@/lib/prisma";
import { resolveEmailAssetUrl } from "@/lib/url";

type PageProps = { params: { orgSlug: string; eventId: string } };

export default async function WalkInCheckInBoothPage({ params }: PageProps) {
  const orgSlug = decodeURIComponent(params.orgSlug);
  const eventId = params.eventId;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, logo: true }
  });
  if (!org) notFound();

  await syncEventStatusForEvent(eventId);

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      orgId: org.id,
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] }
    },
    select: {
      id: true,
      name: true,
      date: true,
      endDate: true,
      blueprintTemplate: true,
      allowFlashEntry: true,
      emailMandatoryForRegistration: true,
      registrationProfile: true,
      brandLogoUrl: true,
      status: true,
      type: true
    }
  });
  if (!event) notFound();

  const boothWindow = {
    date: event.date,
    endDate: event.endDate,
    status: event.status,
    type: event.type
  };
  const boothOpen = isWalkInBoothOpen(boothWindow);
  const boothMessage = walkInBoothStatusMessage(boothWindow);
  const logoUrl = resolveEmailAssetUrl(event.brandLogoUrl) ?? resolveEmailAssetUrl(org.logo);
  const registrationProfile = parseRegistrationProfile(event.registrationProfile);

  return (
    <>
      {!boothOpen ? (
        <CheckInBoothShell>
          <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center text-sm text-amber-950 shadow-sm">
            {event.type === EventType.VIRTUAL ? (
              <p>This event is virtual only — there is no onsite check-in booth.</p>
            ) : (
              <p>{boothMessage}</p>
            )}
            <Link
              href={`/register/${encodeURIComponent(event.id)}`}
              className="mt-4 inline-block font-semibold text-amber-900 underline-offset-2 hover:underline"
            >
              Open registration page
            </Link>
          </div>
        </CheckInBoothShell>
      ) : (
        <WalkInCheckInBoothClient
          orgSlug={orgSlug}
          orgName={org.name}
          eventId={event.id}
          eventName={event.name}
          logoUrl={logoUrl}
          blueprintTemplate={event.blueprintTemplate}
          registrationProfile={registrationProfile}
          allowFlashEntry={event.allowFlashEntry}
          emailMandatoryForRegistration={event.emailMandatoryForRegistration}
        />
      )}
    </>
  );
}
