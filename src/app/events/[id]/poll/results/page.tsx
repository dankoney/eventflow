import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getPollTallyForEvent } from "@/lib/db/pollTally";

import { EventPollShell } from "../EventPollShell";
import { PollPublicHeader } from "../PollPublicHeader";

import { PollResultsView } from "./PollResultsView";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      name: true,
      poll: { select: { title: true, resultsPublishedAt: true } }
    }
  });
  if (!event) {
    return { title: "Results · Eventflow" };
  }
  return {
    title: `${event.poll?.title ?? "Results"} · ${event.name} · Eventflow`,
    robots: event.poll?.resultsPublishedAt ? undefined : { index: false, follow: false }
  };
}

/**
 * Public results page — anyone with the link can view results, but only AFTER the
 * admin publishes them. While `Poll.resultsPublishedAt` is null the page renders a
 * "results not yet published" notice so admins can safely share the URL in advance.
 */
export default async function EventPollResultsPage({ params }: PageProps) {
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      description: true,
      brandLogoUrl: true,
      brandPrimaryColor: true,
      org: { select: { name: true } },
      poll: {
        select: {
          id: true,
          title: true,
          description: true,
          resultsPublishedAt: true,
          resultsSummary: true
        }
      }
    }
  });
  if (!event) notFound();

  const branding = {
    orgName: event.org.name,
    eventName: event.name,
    brandLogoUrl: event.brandLogoUrl,
    accent: (event.brandPrimaryColor?.trim() || "#00677e").trim()
  } as const;

  const eventSummary = {
    id: event.id,
    name: event.name,
    description: event.description
  };

  if (!event.poll) {
    return (
      <EventPollShell branding={branding} eventSummary={eventSummary} showEventHero>
        <NotPublishedNotice
          orgName={branding.orgName}
          brandLogoUrl={branding.brandLogoUrl}
          accent={branding.accent}
          title="No ballot here"
          body="The organizer has not configured a poll for this event."
        />
      </EventPollShell>
    );
  }

  if (!event.poll.resultsPublishedAt) {
    return (
      <EventPollShell branding={branding} eventSummary={eventSummary} showEventHero>
        <NotPublishedNotice
          orgName={branding.orgName}
          brandLogoUrl={branding.brandLogoUrl}
          accent={branding.accent}
          title="Results not published yet"
          body="The organizer will publish the official tally once voting closes. Check back here, or watch for an email or SMS announcement."
        />
      </EventPollShell>
    );
  }

  const tally = await getPollTallyForEvent(event.id);
  if (!tally) {
    return (
      <EventPollShell branding={branding} eventSummary={eventSummary} showEventHero>
        <NotPublishedNotice
          orgName={branding.orgName}
          brandLogoUrl={branding.brandLogoUrl}
          accent={branding.accent}
          title="Results unavailable"
          body="We could not load the tally for this poll. Please try again later."
        />
      </EventPollShell>
    );
  }

  return (
    <EventPollShell branding={branding} eventSummary={eventSummary} showEventHero={false}>
      <PollPublicHeader
        orgName={branding.orgName}
        brandLogoUrl={branding.brandLogoUrl}
        accent={branding.accent}
        context={`${event.name} · official results`}
      />
      <PollResultsView
        title={tally.title}
        description={event.poll.description}
        summary={event.poll.resultsSummary}
        publishedAt={event.poll.resultsPublishedAt.toISOString()}
        turnout={tally.turnout}
        positions={tally.positions}
        accent={branding.accent}
      />
    </EventPollShell>
  );
}

function NotPublishedNotice({
  orgName,
  brandLogoUrl,
  accent,
  title,
  body
}: {
  orgName: string;
  brandLogoUrl: string | null;
  accent: string;
  title: string;
  body: string;
}) {
  return (
    <>
      <PollPublicHeader orgName={orgName} brandLogoUrl={brandLogoUrl} accent={accent} context="Results" />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-lg border border-outline-variant/50 bg-surface-container-lowest p-8 text-center shadow-sm sm:p-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5e5e5e]">
            Results status
          </p>
          <h2 className="mt-2 font-[Manrope,Inter,system-ui] text-2xl font-extrabold tracking-tight text-[#1b1b1b]">
            {title}
          </h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-on-surface-variant">{body}</p>
        </div>
      </main>
    </>
  );
}
