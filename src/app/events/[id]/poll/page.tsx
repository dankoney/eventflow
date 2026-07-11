import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { classifyPollWindow, pollWindowMessage } from "@/lib/poll/openPoll";
import { readPollThanksCookie } from "@/lib/poll/pollThanksCookie";
import { readVotingSession } from "@/lib/poll/votingSession";

import { EventPollBallotClient } from "./EventPollBallotClient";
import { EventPollGateClient } from "./EventPollGateClient";
import { EventPollShell } from "./EventPollShell";
import { EventPollVoteConfirmedClient } from "./EventPollVoteConfirmedClient";
import {
  type EventPollBranding,
  type EventPollEventSummary,
  type EventPollPositionView
} from "./pollPageTypes";

export const dynamic = "force-dynamic";

/**
 * URL param is named `id` (not `eventId`) to align with every other event route in
 * this project (`/events/[id]/...` dashboard tree). Next.js forbids two different
 * slug names at the same path depth, so this public ballot must use the same name.
 */
type PageProps = {
  params: { id: string };
};

/**
 * Public election & polling experience:
 *
 *   - "thanks" — signed thanks cookie + guest `hasVoted` (after submit or refresh).
 *   - "gate"   — no valid voting cookie. Email → OTP.
 *   - "ballot" — valid voting cookie + unused verification. Cast ballot.
 *
 * Closed states short-circuit before gate/ballot/thanks clients mount.
 */
export default async function EventPollPage({ params }: PageProps) {
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
        include: {
          positions: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              candidates: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
              }
            }
          }
        }
      }
    }
  });
  if (!event) notFound();

  const branding: EventPollBranding = {
    orgName: event.org.name,
    eventName: event.name,
    brandLogoUrl: event.brandLogoUrl,
    accent: (event.brandPrimaryColor?.trim() || "#22d3ee").trim()
  };
  const eventSummary: EventPollEventSummary = {
    id: event.id,
    name: event.name,
    description: event.description
  };

  const windowResult = classifyPollWindow(event.poll);

  if (windowResult.state !== "open") {
    return (
      <EventPollShell branding={branding} eventSummary={eventSummary} showEventHero>
        <ClosedNotice
          title={closedTitle(windowResult.state)}
          body={pollWindowMessage(windowResult.state)}
          opensAt={windowResult.state === "not_started" ? event.poll?.startTime ?? null : null}
          closedAt={windowResult.state === "ended" ? event.poll?.endTime ?? null : null}
        />
      </EventPollShell>
    );
  }

  /**
   * `windowResult.poll` is narrowed to the bare `Poll` shape (no relations) by the
   * classifier; use the originally-included reference for the positions/candidates
   * tree. We've already proven `event.poll` is non-null via the `windowResult.state`
   * branch, so the assertion is sound.
   */
  const pollWithPositions = event.poll!;
  const poll = windowResult.poll;
  const isAnonymous = pollWithPositions.isAnonymous;
  /**
   * Resolve the voting session cookie. Server components can only READ cookies in
   * Next 14 — `cookies().set()` is reserved for Server Actions and Route Handlers.
   * That's fine here: any cookie that fails the checks below (wrong event, expired,
   * burned verification row, guest already voted) simply falls through to the gate
   * UI. The stale cookie value remains in the browser jar but is functionally inert
   * — its HMAC payload is matched to a `vid` that no longer satisfies the DB query.
   * The next successful `verifyVotingOTP` call (a Server Action) overwrites it.
   */
  const cookieClaims = readVotingSession();
  let verifiedGuest: { id: string; name: string; email: string } | null = null;

  if (
    cookieClaims &&
    cookieClaims.eid === event.id &&
    cookieClaims.pid === poll.id
  ) {
    const verification = await prisma.pollVerification.findFirst({
      where: {
        id: cookieClaims.vid,
        guestId: cookieClaims.gid,
        eventId: event.id,
        isUsed: false,
        expiresAt: { gt: new Date() }
      },
      select: {
        guest: { select: { id: true, name: true, email: true, hasVoted: true } }
      }
    });
    if (verification && !verification.guest.hasVoted) {
      verifiedGuest = {
        id: verification.guest.id,
        name: verification.guest.name,
        email: verification.guest.email ?? ""
      };
    }
  }

  const positions: EventPollPositionView[] = pollWithPositions.positions.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    sortOrder: p.sortOrder,
    candidates: p.candidates.map((c) => ({
      id: c.id,
      name: c.name,
      bio: c.bio,
      photoUrl: c.photoUrl,
      sortOrder: c.sortOrder
    }))
  }));

  if (positions.length === 0) {
    return (
      <EventPollShell branding={branding} eventSummary={eventSummary} showEventHero isAnonymous={isAnonymous}>
        <ClosedNotice
          title="Ballot empty"
          body="The organizer has not added any positions to this ballot yet."
        />
      </EventPollShell>
    );
  }

  const thanksClaims = readPollThanksCookie();
  if (
    thanksClaims &&
    thanksClaims.eid === event.id &&
    thanksClaims.pid === poll.id
  ) {
    const thanksGuest = await prisma.guest.findFirst({
      where: {
        id: thanksClaims.gid,
        eventId: event.id,
        hasVoted: true
      },
      select: { email: true }
    });
    if (thanksGuest) {
      return (
        <EventPollShell branding={branding} eventSummary={eventSummary} showEventHero={false} isAnonymous={isAnonymous}>
          <EventPollVoteConfirmedClient
            emailHint={maskEmailHint(thanksGuest.email ?? "")}
            receiptRef={thanksClaims.ref}
            orgName={branding.orgName}
            brandLogoUrl={branding.brandLogoUrl}
            accent={branding.accent}
            isAnonymous={isAnonymous}
          />
        </EventPollShell>
      );
    }
  }

  if (!verifiedGuest) {
    return (
      <EventPollShell branding={branding} eventSummary={eventSummary} showEventHero={false} isAnonymous={isAnonymous}>
        <EventPollGateClient
          eventId={event.id}
          accent={branding.accent}
          pollTitle={poll.title}
          pollStartTime={poll.startTime.toISOString()}
          pollEndTime={poll.endTime.toISOString()}
          pollInstructions={pollWithPositions.instructions}
          orgName={branding.orgName}
          brandLogoUrl={branding.brandLogoUrl}
          isAnonymous={isAnonymous}
        />
      </EventPollShell>
    );
  }

  return (
    <EventPollShell branding={branding} eventSummary={eventSummary} showEventHero={false} isAnonymous={isAnonymous}>
      <EventPollBallotClient
        accent={branding.accent}
        eventName={event.name}
        pollTitle={poll.title}
        pollDescription={poll.description}
        pollInstructions={pollWithPositions.instructions}
        pollEndTime={poll.endTime.toISOString()}
        positions={positions}
        voter={{
          id: verifiedGuest.id,
          firstName: firstNameOf(verifiedGuest.name),
          emailHint: maskEmailHint(verifiedGuest.email)
        }}
        orgName={branding.orgName}
        brandLogoUrl={branding.brandLogoUrl}
        isAnonymous={isAnonymous}
      />
    </EventPollShell>
  );
}

function closedTitle(state: Exclude<ReturnType<typeof classifyPollWindow>["state"], "open">): string {
  switch (state) {
    case "missing":
      return "No ballot here";
    case "inactive":
      return "Voting is closed";
    case "not_started":
      return "Voting hasn't opened yet";
    case "ended":
      return "Voting has closed";
  }
}

function maskEmailHint(email: string): string {
  const [user, domain] = email.trim().split("@");
  if (!user || !domain) return "your email on file";
  const vis = user.slice(0, Math.min(2, user.length));
  return `${vis}***@${domain}`;
}

function ClosedNotice({
  title,
  body,
  opensAt,
  closedAt
}: {
  title: string;
  body: string;
  opensAt?: Date | null;
  closedAt?: Date | null;
}) {
  const stamp = opensAt ?? closedAt;
  const label = opensAt ? "Opens" : closedAt ? "Closed" : null;
  return (
    <div className="mx-auto max-w-lg border border-outline-variant/50 bg-surface-container-lowest p-8 text-center shadow-sm sm:p-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5e5e5e]">Ballot status</p>
      <h2 className="mt-2 font-[Manrope,Inter,system-ui] text-2xl font-extrabold tracking-tight text-[#1b1b1b]">
        {title}
      </h2>
      <p className="mt-3 text-sm font-medium leading-relaxed text-on-surface-variant">{body}</p>
      {stamp && label ? (
        <p className="mt-4 text-xs text-zinc-500">
          {label}: {stamp.toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

function firstNameOf(name: string): string {
  const f = name.trim().split(/\s+/)[0];
  return f && f.length > 0 ? f : "there";
}
