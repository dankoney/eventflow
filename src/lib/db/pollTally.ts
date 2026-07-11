import { VoteConfidenceChoice } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Aggregated per-position tally for the admin dashboard. Anonymized — these counts
 * come from `Vote` rows which carry no Guest reference. Turnout numbers come from
 * `Guest.hasVoted` so we can show participation without leaking ballot content.
 */
export type PollPositionTally = {
  positionId: string;
  title: string;
  sortOrder: number;
  totalVotes: number;
  /** True when the position has exactly one candidate (confidence vote rendering). */
  isUnopposed: boolean;
  candidates: Array<{
    candidateId: string;
    name: string;
    role: string | null;
    photoUrl: string | null;
    bio: string | null;
    resourceUrl: string | null;
    resourceName: string | null;
    votes: number;
    /** Share of ballots cast for THIS position (0–100). */
    sharePct: number;
  }>;
  /** Only populated for unopposed positions. */
  confidence: {
    yes: number;
    no: number;
    abstain: number;
  } | null;
};

export type PollTally = {
  pollId: string;
  title: string;
  description: string | null;
  /** Mirrors `Poll.instructions` — procedural voting guidance (optional). */
  instructions: string | null;
  isActive: boolean;
  /** When true, the election section is visible on the public registration page. */
  publicElectionPublished: boolean;
  /**
   * Mirrors `Poll.isAnonymous`. Surfaced here so the admin page can:
   *  - prefill the setup-card toggle,
   *  - decide whether to render the "Voter log" panel (only meaningful for
   *    non-anonymous polls, where `BallotChoice` rows exist).
   */
  isAnonymous: boolean;
  startTime: Date;
  endTime: Date;
  turnout: {
    totalGuests: number;
    ballotsCast: number;
    /** Share of guests who voted (0–100). 0 when there are no guests. */
    turnoutPct: number;
  };
  positions: PollPositionTally[];
};

/**
 * Build the full tally view-model for an event's poll. Returns `null` when the
 * event has no poll row. Performs three queries:
 *   1. The Poll + Positions + Candidates tree (with sortOrder respected).
 *   2. A grouped Vote count by (positionId, candidateId) for opposed tallies.
 *   3. A grouped Vote count by (positionId, confidenceChoice) for unopposed tallies.
 *   4. Two Guest counts for the turnout strip.
 */
export async function getPollTallyForEvent(eventId: string): Promise<PollTally | null> {
  const poll = await prisma.poll.findUnique({
    where: { eventId },
    include: {
      positions: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          candidates: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              name: true,
              role: true,
              photoUrl: true,
              bio: true,
              resourceUrl: true,
              resourceName: true
            }
          }
        }
      }
    }
  });
  if (!poll) return null;

  const [candidateGroups, confidenceGroups, totalGuests, ballotsCast] = await Promise.all([
    prisma.vote.groupBy({
      by: ["positionId", "candidateId"],
      where: { pollId: poll.id },
      _count: { _all: true }
    }),
    prisma.vote.groupBy({
      by: ["positionId", "confidenceChoice"],
      where: { pollId: poll.id, confidenceChoice: { not: null } },
      _count: { _all: true }
    }),
    prisma.guest.count({ where: { eventId } }),
    prisma.guest.count({ where: { eventId, hasVoted: true } })
  ]);

  const candidateCountByKey = new Map<string, number>();
  for (const row of candidateGroups) {
    if (row.candidateId == null) continue;
    candidateCountByKey.set(`${row.positionId}:${row.candidateId}`, row._count._all);
  }
  const confidenceByPosition = new Map<
    string,
    { yes: number; no: number; abstain: number }
  >();
  for (const row of confidenceGroups) {
    if (!row.confidenceChoice) continue;
    const bucket =
      confidenceByPosition.get(row.positionId) ?? { yes: 0, no: 0, abstain: 0 };
    if (row.confidenceChoice === VoteConfidenceChoice.YES) bucket.yes = row._count._all;
    if (row.confidenceChoice === VoteConfidenceChoice.NO) bucket.no = row._count._all;
    if (row.confidenceChoice === VoteConfidenceChoice.ABSTAIN) bucket.abstain = row._count._all;
    confidenceByPosition.set(row.positionId, bucket);
  }

  const positions: PollPositionTally[] = poll.positions.map((position) => {
    const isUnopposed = position.candidates.length === 1;
    const confidence = confidenceByPosition.get(position.id) ?? null;
    /**
     * For opposed contests `totalVotes` = sum of candidate counts. For unopposed
     * contests `totalVotes` = YES + NO + ABSTAIN (the YES rows also carry a
     * `candidateId`, but they're counted via the confidence bucket here to avoid
     * double-counting).
     */
    const candidateVotes = position.candidates.map((c) => {
      const votes = candidateCountByKey.get(`${position.id}:${c.id}`) ?? 0;
      return {
        candidateId: c.id,
        name: c.name,
        role: c.role,
        photoUrl: c.photoUrl,
        bio: c.bio,
        resourceUrl: c.resourceUrl,
        resourceName: c.resourceName,
        votes
      };
    });
    const totalVotes = isUnopposed && confidence
      ? confidence.yes + confidence.no + confidence.abstain
      : candidateVotes.reduce((s, c) => s + c.votes, 0);

    return {
      positionId: position.id,
      title: position.title,
      sortOrder: position.sortOrder,
      totalVotes,
      isUnopposed,
      candidates: candidateVotes.map((c) => ({
        ...c,
        sharePct: totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0
      })),
      confidence: isUnopposed ? confidence ?? { yes: 0, no: 0, abstain: 0 } : null
    };
  });

  const turnoutPct =
    totalGuests > 0 ? Math.round((ballotsCast / totalGuests) * 100) : 0;

  return {
    pollId: poll.id,
    title: poll.title,
    description: poll.description,
    instructions: poll.instructions,
    isActive: poll.isActive,
    publicElectionPublished: poll.publicElectionPublished,
    isAnonymous: poll.isAnonymous,
    startTime: poll.startTime,
    endTime: poll.endTime,
    turnout: { totalGuests, ballotsCast, turnoutPct },
    positions
  };
}
