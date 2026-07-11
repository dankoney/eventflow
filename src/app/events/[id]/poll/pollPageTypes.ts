/**
 * View-model shapes shared between the server page and the gate/ballot clients.
 * Keeping them in their own file lets the client components import freely without
 * pulling in Prisma types or server-only modules.
 */
export type EventPollBranding = {
  orgName: string;
  eventName: string;
  brandLogoUrl: string | null;
  accent: string;
};

export type EventPollEventSummary = {
  id: string;
  name: string;
  description: string | null;
};

export type EventPollCandidateView = {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  sortOrder: number;
};

export type EventPollPositionView = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  candidates: EventPollCandidateView[];
};

export type BallotConfidenceChoice = "YES" | "NO" | "ABSTAIN";

export type BallotSelection = {
  positionId: string;
  candidateId: string | null;
  confidenceChoice: BallotConfidenceChoice | null;
};
