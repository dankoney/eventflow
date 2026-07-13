import { EventStatus, EventType } from "@prisma/client";
import { Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isWalkInBoothOpen } from "@/lib/checkin/walkInBoothWindow";
import { prisma } from "@/lib/prisma";
import { formatDate, formatLocationLine } from "@/lib/utils";

type PageProps = { params: { orgSlug: string } };

const statusLabel: Record<EventStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  LIVE: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

const typeLabel: Record<EventType, string> = {
  IN_PERSON: "In person",
  VIRTUAL: "Virtual",
  HYBRID: "Hybrid"
};

export default async function OrgCommandCenterPage({ params }: PageProps) {
  const orgSlug = decodeURIComponent(params.orgSlug);

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true
    }
  });
  if (!org) notFound();

  const events = await prisma.event.findMany({
    where: {
      orgId: org.id,
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] }
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      name: true,
      date: true,
      endDate: true,
      status: true,
      type: true,
      allowFlashEntry: true,
      location: { select: { name: true, address: true, city: true } }
    }
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-12 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {org.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- org logos are arbitrary HTTPS URLs from settings
              <img
                src={org.logo}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl border border-white/10 bg-white object-contain p-1"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-bold">
                {org.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">Programs</p>
              <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-white">{org.name}</h1>
              <p className="mt-1 text-sm text-slate-400">Active and live programs you can join right now.</p>
            </div>
          </div>
        </header>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            <p className="font-medium text-slate-200">No published or live events</p>
            <p className="mt-2 text-sm">When your team publishes a program, it will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {events.map((ev) => {
              const locLine = formatLocationLine(ev.location);
              const boothOpen = isWalkInBoothOpen({
                date: ev.date,
                endDate: ev.endDate,
                status: ev.status,
                type: ev.type
              });
              const boothHref = `/o/${encodeURIComponent(org.slug)}/${encodeURIComponent(ev.id)}/checkin`;
              return (
                <li key={ev.id}>
                  <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-amber-400/40 hover:bg-white/[0.07]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-white">{ev.name}</h2>
                        <p className="mt-1 text-sm text-slate-400">
                          {formatDate(ev.date)} · {typeLabel[ev.type]}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{locLine}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
                          {statusLabel[ev.status]}
                        </span>
                        {ev.allowFlashEntry ? (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            Walk-ins allowed
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            Invitation only
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
                      <Link
                        href={`/o/${encodeURIComponent(org.slug)}/${encodeURIComponent(ev.id)}/enter`}
                        className="text-amber-200/90 underline-offset-2 hover:text-amber-100 hover:underline"
                      >
                        RSVP / join →
                      </Link>
                      {boothOpen ? (
                        <Link
                          href={boothHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-300 underline-offset-2 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Open check-in booth
                        </Link>
                      ) : ev.type !== EventType.VIRTUAL ? (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Booth opens 2h before start
                        </span>
                      ) : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-10 text-center text-xs text-slate-500">Powered by Eventflow</p>
      </div>
    </main>
  );
}
