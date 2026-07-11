import { EventBlueprintTemplate, EventStatus, EventType } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FlashEventEnterClient } from "@/components/flash-entry/FlashEventEnterClient";
import { prisma } from "@/lib/prisma";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { formatDate, formatLocationLine } from "@/lib/utils";

type PageProps = { params: { orgSlug: string; eventId: string } };

export default async function FlashEventEnterPage({ params }: PageProps) {
  const orgSlug = decodeURIComponent(params.orgSlug);
  const eventId = params.eventId;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true }
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
      blueprintTemplate: true,
      allowFlashEntry: true,
      status: true,
      type: true,
      date: true,
      location: { select: { name: true, address: true, city: true } }
    }
  });
  if (!event) notFound();

  const typeLabel: Record<EventType, string> = {
    IN_PERSON: "In person",
    VIRTUAL: "Virtual",
    HYBRID: "Hybrid"
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-lg shadow-slate-900/5 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{org.name}</p>
        <p className="mt-1 text-sm text-slate-600">
          {formatDate(event.date)} — {typeLabel[event.type]} · {event.status}
        </p>
        <p className="mt-1 text-sm text-slate-500">{formatLocationLine(event.location)}</p>
        <FlashEventEnterClient
          orgSlug={orgSlug}
          eventId={event.id}
          eventName={event.name}
          blueprintTemplate={event.blueprintTemplate}
          allowFlashEntry={event.allowFlashEntry}
        />
        <p className="mt-8 text-center text-xs text-slate-500">
          Prefer the full registration page?{" "}
          <Link href={`/register/${encodeURIComponent(event.id)}`} className="font-medium text-slate-700 underline">
            Open public registration
          </Link>
        </p>
      </div>
    </main>
  );
}
