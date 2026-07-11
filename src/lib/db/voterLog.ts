import { VoteConfidenceChoice } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * A single row in the admin "Voter log" — exists only when the poll is non-anonymous
 * (i.e. `Poll.isAnonymous = false`). Each row is one guest's full ballot, with their
 * per-position selection. Grouped by guest at the application layer because Prisma's
 * groupBy can't reach across joined columns we need to display.
 */
export type VoterLogEntry = {
  guestId: string;
  guestName: string;
  guestEmail: string | null;
  /** Shared per-submission UUID — same as the receipt the guest received by email. */
  receiptRef: string;
  /** Timestamp of the first BallotChoice row for this guest in this poll. */
  votedAt: Date;
  choices: Array<{
    positionId: string;
    positionTitle: string;
    selection: string;
  }>;
};

/**
 * Build the attributed voter log for an event's poll. Returns an empty array when:
 *  - the event has no poll,
 *  - the poll is in anonymous mode (no `BallotChoice` rows are ever written),
 *  - no votes have been cast yet.
 *
 * The result is sorted newest first (most recent submission top).
 */
export async function getVoterLogForEvent(eventId: string): Promise<VoterLogEntry[]> {
  const poll = await prisma.poll.findUnique({
    where: { eventId },
    select: { id: true, isAnonymous: true }
  });
  if (!poll || poll.isAnonymous) return [];

  const rows = await prisma.ballotChoice.findMany({
    where: { pollId: poll.id },
    orderBy: [{ createdAt: "asc" }],
    select: {
      receiptRef: true,
      createdAt: true,
      positionId: true,
      confidenceChoice: true,
      candidateId: true,
      position: { select: { title: true } },
      candidate: { select: { name: true } },
      guest: { select: { id: true, name: true, email: true } }
    }
  });
  if (rows.length === 0) return [];

  const byGuest = new Map<string, VoterLogEntry>();
  for (const row of rows) {
    const guest = row.guest;
    if (!guest) continue;
    const existing = byGuest.get(guest.id);
    if (existing) {
      existing.choices.push({
        positionId: row.positionId,
        positionTitle: row.position.title,
        selection: renderSelection(row.confidenceChoice, row.candidate?.name ?? null)
      });
      continue;
    }
    byGuest.set(guest.id, {
      guestId: guest.id,
      guestName: guest.name,
      guestEmail: guest.email,
      receiptRef: row.receiptRef,
      votedAt: row.createdAt,
      choices: [
        {
          positionId: row.positionId,
          positionTitle: row.position.title,
          selection: renderSelection(row.confidenceChoice, row.candidate?.name ?? null)
        }
      ]
    });
  }

  return Array.from(byGuest.values()).sort(
    (a, b) => b.votedAt.getTime() - a.votedAt.getTime()
  );
}

function renderSelection(
  confidenceChoice: VoteConfidenceChoice | null,
  candidateName: string | null
): string {
  if (confidenceChoice === VoteConfidenceChoice.NO) return "No — no confidence";
  if (confidenceChoice === VoteConfidenceChoice.ABSTAIN) return "Abstain";
  if (confidenceChoice === VoteConfidenceChoice.YES) {
    return candidateName ? `Yes — confidence (${candidateName})` : "Yes — confidence";
  }
  return candidateName ?? "Selection recorded";
}
