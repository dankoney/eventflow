import { Role } from "@prisma/client";
import { Activity, BarChart3, ShieldCheck, Users2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PollTallyChart } from "@/components/charts/PollTallyChart";
import { Badge } from "@/components/ui/Badge";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getEventForUser } from "@/lib/db/events";
import { getPollTallyForEvent } from "@/lib/db/pollTally";
import { getVoterLogForEvent } from "@/lib/db/voterLog";
import { classifyPollWindow } from "@/lib/poll/openPoll";
import { prisma } from "@/lib/prisma";
import { getEventPollAbsoluteUrl, getEventPollResultsAbsoluteUrl } from "@/lib/url";

import { PollDirectLinkCard } from "./PollDirectLinkCard";
import { PollPositionsManager } from "./PollPositionsManager";
import { PollResultsCard } from "./PollResultsCard";
import { PollSetupCard } from "./PollSetupCard";
import { PollVoterLogPanel } from "./PollVoterLogPanel";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default async function EventPollAdminPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    redirect(`/events/${params.id}`);
  }

  const event = await getEventForUser(
    params.id,
    session.user.orgId,
    session.user.id,
    session.user.role
  );
  if (!event) notFound();

  const tally = await getPollTallyForEvent(event.id);
  const voterLog =
    tally && !tally.isAnonymous ? await getVoterLogForEvent(event.id) : [];
  const pollUrl = getEventPollAbsoluteUrl(event.id);
  const resultsUrl = getEventPollResultsAbsoluteUrl(event.id);
  const voterLogCsvUrl = `/api/events/${event.id}/poll/voter-log.csv`;

  /**
   * Side queries used only by the Results card — pulled separately so the existing
   * tally helper stays focused on aggregation. `pollMeta` carries publish state;
   * `guestChannelCounts` shows the admin how many guests we can reach.
   */
  const [pollMeta, guestChannelCounts] = tally
    ? await Promise.all([
        prisma.poll.findUnique({
          where: { eventId: event.id },
          select: { resultsPublishedAt: true, resultsSummary: true }
        }),
        prisma.guest
          .findMany({
            where: { eventId: event.id },
            select: { email: true, phone: true }
          })
          .then((rows) => ({
            withEmail: rows.filter((r) => r.email?.trim()).length,
            withPhone: rows.filter((r) => r.phone?.trim()).length
          }))
      ])
    : [null, { withEmail: 0, withPhone: 0 }];
  const windowResult = tally
    ? classifyPollWindow({
        eventId: event.id,
        id: tally.pollId,
        title: tally.title,
        description: tally.description,
        instructions: tally.instructions,
        isActive: tally.isActive,
        publicElectionPublished: tally.publicElectionPublished,
        isAnonymous: tally.isAnonymous,
        startTime: tally.startTime,
        endTime: tally.endTime,
        resultsPublishedAt: null,
        resultsSummary: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    : { state: "missing" as const };

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Election & Polling"
      title={tally ? tally.title : "Configure the ballot"}
      description={
        tally
          ? tally.isAnonymous
            ? "Run an OTP-gated secret ballot on top of this event. Manage positions, candidates, and watch turnout live."
            : "Run an OTP-gated attributed ballot — each guest's selections are recorded with their identity. Manage positions, candidates, and watch turnout live."
          : "No poll is attached to this event yet. Configure the open/close window below to mint the ballot URL."
      }
      headerActions={
        tally ? (
          <Badge
            className={
              windowResult.state === "open"
                ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
                : windowResult.state === "not_started"
                  ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200"
                  : windowResult.state === "ended"
                    ? "bg-zinc-200 text-zinc-700 ring-1 ring-zinc-300"
                    : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
            }
          >
            {labelForWindowState(windowResult.state)}
          </Badge>
        ) : null
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PollSetupCard
            eventId={event.id}
            initial={
              tally
                ? {
                    title: tally.title,
                    description: tally.description,
                    instructions: tally.instructions,
                    isActive: tally.isActive,
                    publicElectionPublished: tally.publicElectionPublished,
                    isAnonymous: tally.isAnonymous,
                    startTime: tally.startTime.toISOString(),
                    endTime: tally.endTime.toISOString()
                  }
                : null
            }
            ballotsCast={tally?.turnout.ballotsCast ?? 0}
          />
        </div>
        <div className="lg:col-span-1">
          <PollDirectLinkCard pollUrl={pollUrl} isActive={tally?.isActive ?? false} />
        </div>
      </div>

      {tally ? (
        <>
          <TurnoutPanel turnout={tally.turnout} pollIsActive={tally.isActive} />

          <PollPositionsManager
            eventId={event.id}
            positions={tally.positions.map((p) => ({
              positionId: p.positionId,
              title: p.title,
              isUnopposed: p.isUnopposed,
              totalVotes: p.totalVotes,
              candidates: p.candidates.map((c) => ({
                candidateId: c.candidateId,
                name: c.name,
                role: c.role,
                photoUrl: c.photoUrl,
                bio: c.bio,
                resourceUrl: c.resourceUrl,
                resourceName: c.resourceName,
                votes: c.votes
              }))
            }))}
          />

          {!tally.isAnonymous ? (
            <PollVoterLogPanel entries={voterLog} voterLogCsvUrl={voterLogCsvUrl} />
          ) : null}

          {tally.positions.length > 0 ? (
            <section className="space-y-3">
              <header className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                <BarChart3 className="h-3.5 w-3.5" aria-hidden />
                Live tally
              </header>
              <div className="grid gap-4 lg:grid-cols-2">
                {tally.positions.map((position) => (
                  <PollTallyChart key={position.positionId} position={position} />
                ))}
              </div>
            </section>
          ) : (
            <WorkspaceNotice variant="info">
              Add at least one position above to start tracking the live tally here.
            </WorkspaceNotice>
          )}

          {tally.positions.length > 0 ? (
            <PollResultsCard
              eventId={event.id}
              resultsUrl={resultsUrl}
              resultsPublishedAt={pollMeta?.resultsPublishedAt?.toISOString() ?? null}
              resultsSummary={pollMeta?.resultsSummary ?? null}
              ballotsCast={tally.turnout.ballotsCast}
              totalGuests={tally.turnout.totalGuests}
              windowState={windowResult.state}
              guestEmailCount={guestChannelCounts.withEmail}
              guestPhoneCount={guestChannelCounts.withPhone}
            />
          ) : null}
        </>
      ) : null}
    </WorkspacePageShell>
  );
}

function TurnoutPanel({
  turnout,
  pollIsActive
}: {
  turnout: { totalGuests: number; ballotsCast: number; turnoutPct: number };
  pollIsActive: boolean;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <StatTile
        icon={<Users2 className="h-4 w-4" aria-hidden />}
        label="Eligible guests"
        value={turnout.totalGuests.toLocaleString()}
      />
      <StatTile
        icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        label="Ballots cast"
        value={turnout.ballotsCast.toLocaleString()}
      />
      <StatTile
        icon={<Activity className="h-4 w-4" aria-hidden />}
        label="Turnout"
        value={`${turnout.turnoutPct}%`}
        suffix={
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900 transition-[width] duration-500"
              style={{ width: `${turnout.turnoutPct}%` }}
              role="presentation"
            />
            <span className="sr-only">
              {turnout.ballotsCast} of {turnout.totalGuests} guests have voted
              {pollIsActive ? " (poll is currently open)" : " (poll is currently closed)"}
            </span>
          </div>
        }
      />
    </section>
  );
}

function StatTile({
  icon,
  label,
  value,
  suffix
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
      {suffix}
    </div>
  );
}

function labelForWindowState(state: ReturnType<typeof classifyPollWindow>["state"]): string {
  switch (state) {
    case "open":
      return "Open · accepting votes";
    case "not_started":
      return "Scheduled";
    case "ended":
      return "Closed";
    case "inactive":
      return "Paused";
    case "missing":
      return "Not configured";
  }
}
