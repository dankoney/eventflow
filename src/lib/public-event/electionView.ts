import { prisma } from "@/lib/prisma";
import { isModuleEnabled } from "@/lib/features/modules";
import { isPollBallotWindowOpen } from "@/lib/poll/openPoll";

export type PublicElectionCandidate = {
  id: string;
  name: string;
  role: string | null;
  photoUrl: string | null;
  bio: string | null;
  resourceUrl: string | null;
  resourceName: string | null;
};

export type PublicElectionPosition = {
  id: string;
  title: string;
  description: string | null;
  candidates: PublicElectionCandidate[];
};

/**
 * Read-only view of an event's poll for the public registration page. Only safe,
 * voter-facing fields are included — never the OTP/verification rows or any
 * candidate-level vote counts. The `isOpen` flag is the result of
 * {@link isPollBallotWindowOpen} so the "Cast your ballot" CTA can be hidden
 * outside the voting window without re-implementing the rules.
 */
export type PublicElectionView = {
  pollId: string;
  title: string;
  description: string | null;
  /**
   * Optional procedural instructions for voters (OTP flow, deadlines, rules…).
   * Rendered as a highlighted callout above the positions list on the public
   * registration page's election section. Authored by the organizer.
   */
  instructions: string | null;
  startTime: string;
  endTime: string;
  isOpen: boolean;
  ballotHref: string;
  positions: PublicElectionPosition[];
};

/**
 * Returns the public election view for an event, or null when there is no
 * configured poll or the organizer has not published it on the registration page.
 * Returns the view (without the ballot CTA being enabled) when voting is paused
 * or outside its window, so registrants can still preview the ballot.
 */
export async function getPublicElectionView(
  eventId: string
): Promise<PublicElectionView | null> {
  if (!isModuleEnabled("polling")) return null;

  const poll = await prisma.poll.findUnique({
    where: { eventId },
    select: {
      id: true,
      title: true,
      description: true,
      instructions: true,
      isActive: true,
      publicElectionPublished: true,
      startTime: true,
      endTime: true,
      positions: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
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
  if (!poll || !poll.publicElectionPublished) return null;

  return {
    pollId: poll.id,
    title: poll.title,
    description: poll.description,
    instructions: poll.instructions,
    startTime: poll.startTime.toISOString(),
    endTime: poll.endTime.toISOString(),
    isOpen: isPollBallotWindowOpen(poll),
    ballotHref: `/events/${encodeURIComponent(eventId)}/poll`,
    positions: poll.positions.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      candidates: p.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        photoUrl: c.photoUrl,
        bio: c.bio,
        resourceUrl: c.resourceUrl,
        resourceName: c.resourceName
      }))
    }))
  };
}
