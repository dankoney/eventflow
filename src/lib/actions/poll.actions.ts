"use server";

import { randomUUID } from "node:crypto";

import { Prisma, VoteConfidenceChoice } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/auth";
import { canManageEvents } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendPollBallotReceiptEmail, sendPollBallotReceiptSms } from "@/lib/poll/ballotReceiptEmail";
import { issuePollThanksCookie } from "@/lib/poll/pollThanksCookie";
import { classifyPollWindow, pollWindowMessage } from "@/lib/poll/openPoll";
import {
  broadcastPollResults,
  buildPollResultsSummary,
  type PollResultsBroadcastChannel
} from "@/lib/poll/resultsBroadcast";
import { getPollTallyForEvent } from "@/lib/db/pollTally";
import { getEventPollResultsAbsoluteUrl } from "@/lib/url";
import {
  POLL_OTP_MAX_ATTEMPTS,
  POLL_OTP_TTL_MS,
  generatePollOtpCode,
  hashPollOtpCode,
  verifyPollOtpCode
} from "@/lib/poll/otp";
import { deliverPollOtp, type PollOtpDeliveryChannel } from "@/lib/poll/otpDelivery";
import { hitSlidingWindow } from "@/lib/rateLimit/memorySlidingWindow";
import {
  clearVotingSession,
  issueVotingSession,
  readVotingSession
} from "@/lib/poll/votingSession";
import { guardModuleAction, guardModuleActionForOrg } from "@/lib/features/moduleGuards";
import type { ActionResult } from "@/types";

/**
 * Rate limit configs — keep the numbers conservative; the bucket is in-process so
 * a multi-instance deployment will need a shared store later, but the per-guest DB
 * checks below also defend independently.
 */
const RL_REQUEST_PER_GUEST_MAX = 3;
const RL_REQUEST_PER_GUEST_WINDOW_MS = 5 * 60 * 1000;
const RL_REQUEST_PER_IP_MAX = 8;
const RL_REQUEST_PER_IP_WINDOW_MS = 10 * 60 * 1000;
const RL_VERIFY_PER_GUEST_MAX = 10;
const RL_VERIFY_PER_GUEST_WINDOW_MS = 10 * 60 * 1000;

/**
 * Minimum interval between two OTP requests for the same guest. Defends against a
 * "spray a guest's inbox" attack without harming UX (legit resend after 30s wait).
 */
const REQUEST_COOLDOWN_MS = 30 * 1000;

const requestSchema = z.object({
  eventId: z.string().min(1, "Event id is required."),
  email: z.string().email("Enter a valid email address.").max(254)
});

const verifySchema = z.object({
  guestId: z.string().min(1, "Guest id is required."),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email or SMS.")
});

function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(" | ");
}

function clientIpForRateLimit(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || h.get("cf-connecting-ip")?.trim() || "unknown";
}

export type RequestVotingOtpResult = ActionResult<{
  guestId: string;
  channels: PollOtpDeliveryChannel[];
  expiresAt: Date;
  /** UI hint: lets the gate show "code sent to email + last 3 digits of phone". */
  emailHint: string | null;
  phoneHint: string | null;
}>;

/**
 * Phase 2 entry point. Resolves the email to a Guest on the event, mints a 6-digit
 * OTP, persists only the bcrypt hash, and dispatches via Resend (email) and mNotify
 * (SMS) in parallel. Returns the channels that actually succeeded.
 *
 * Anonymization note: this row carries `guestId` (the gate IS identity-gated). The
 * downstream {@link Vote} table does not — the verification row is invalidated
 * atomically with the ballot write in Phase 4.
 */
export async function requestVotingOTP(
  input: z.input<typeof requestSchema>
): Promise<RequestVotingOtpResult> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const { eventId } = parsed.data;
  const emailLower = parsed.data.email.trim().toLowerCase();

  const ip = clientIpForRateLimit();
  const ipHit = hitSlidingWindow(
    `poll:otp:request:ip:${ip}`,
    RL_REQUEST_PER_IP_MAX,
    RL_REQUEST_PER_IP_WINDOW_MS
  );
  if (!ipHit.ok) {
    return { success: false, error: "Too many requests from this network. Try again in a few minutes." };
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      orgId: true,
      brandPrimaryColor: true,
      poll: true,
      org: {
        select: { id: true, name: true, resendApiKey: true }
      }
    }
  });
  if (!event) {
    return { success: false, error: "We couldn't find this event." };
  }

  const windowResult = classifyPollWindow(event.poll);
  if (windowResult.state !== "open") {
    return { success: false, error: pollWindowMessage(windowResult.state) };
  }
  const poll = windowResult.poll;

  const guest = await prisma.guest.findUnique({
    where: { eventId_email: { eventId, email: emailLower } },
    select: { id: true, name: true, email: true, phone: true, hasVoted: true }
  });
  if (!guest) {
    return {
      success: false,
      error: "We couldn't find a registration matching that email for this event."
    };
  }
  if (guest.hasVoted) {
    return {
      success: false,
      error: "Our records show you've already cast your ballot for this poll. Thank you for voting."
    };
  }

  const guestHit = hitSlidingWindow(
    `poll:otp:request:guest:${guest.id}`,
    RL_REQUEST_PER_GUEST_MAX,
    RL_REQUEST_PER_GUEST_WINDOW_MS
  );
  if (!guestHit.ok) {
    const seconds = Math.ceil(guestHit.retryAfterMs / 1000);
    return {
      success: false,
      error: `Too many code requests. Please wait ${seconds} second${seconds === 1 ? "" : "s"} before trying again.`
    };
  }

  const lastRow = await prisma.pollVerification.findFirst({
    where: { guestId: guest.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });
  if (lastRow && Date.now() - lastRow.createdAt.getTime() < REQUEST_COOLDOWN_MS) {
    const wait = Math.ceil(
      (REQUEST_COOLDOWN_MS - (Date.now() - lastRow.createdAt.getTime())) / 1000
    );
    return {
      success: false,
      error: `A code was just sent. Wait ${wait} second${wait === 1 ? "" : "s"} and check your email or SMS.`
    };
  }

  const code = generatePollOtpCode();
  const codeHash = await hashPollOtpCode(code);
  const expiresAt = new Date(Date.now() + POLL_OTP_TTL_MS);

  await prisma.pollVerification.updateMany({
    where: { guestId: guest.id, isUsed: false },
    data: { isUsed: true }
  });
  const verification = await prisma.pollVerification.create({
    data: {
      eventId: event.id,
      guestId: guest.id,
      email: emailLower,
      codeHash,
      expiresAt
    },
    select: { id: true }
  });

  const delivery = await deliverPollOtp({
    code,
    expiresMinutes: Math.round(POLL_OTP_TTL_MS / 60_000),
    guest: { name: guest.name, email: guest.email, phone: guest.phone },
    event: { name: event.name },
    org: {
      id: event.org.id,
      name: event.org.name,
      resendApiKey: event.org.resendApiKey,
      brandPrimaryColor: event.brandPrimaryColor
    },
    isAnonymous: poll.isAnonymous
  });

  if (delivery.channels.length === 0) {
    /**
     * Best-effort cleanup so a failed dispatch does not leak a usable but
     * undeliverable code row. We could leave it (it will expire in 10 minutes) but
     * deleting keeps the table tidy and avoids confusing the next request rate
     * limit check.
     */
    await prisma.pollVerification.delete({ where: { id: verification.id } }).catch(() => undefined);
    const detail =
      delivery.errors.email ?? delivery.errors.sms ?? "Delivery failed via every available channel.";
    return {
      success: false,
      error: `We could not deliver your voting code. ${detail}`
    };
  }

  return {
    success: true,
    data: {
      guestId: guest.id,
      channels: delivery.channels,
      expiresAt,
      emailHint: maskEmail(guest.email ?? ""),
      phoneHint: maskPhone(guest.phone)
    }
  };
}

export type VerifyVotingOtpResult = ActionResult<{
  eventId: string;
  pollId: string;
  /** When the issued voting session cookie expires. */
  sessionExpiresAt: Date;
}>;

/**
 * Phase 2 verification + gate. On success we issue an HMAC-signed cookie scoped to
 * `/events/` containing { guestId, eventId, pollId, verificationId } and return the
 * poll metadata so the client can transition to the ballot. We deliberately do NOT
 * mark the verification row `isUsed=true` here — that flip happens atomically with
 * the ballot write in Phase 4. The row's `id` is embedded in the cookie so the
 * Phase 4 transaction can confirm the bearer used the exact OTP it claims.
 */
export async function verifyVotingOTP(
  input: z.input<typeof verifySchema>
): Promise<VerifyVotingOtpResult> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;

  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guestId = parsed.data.guestId;
  const code = parsed.data.code;

  const ip = clientIpForRateLimit();
  const ipHit = hitSlidingWindow(
    `poll:otp:verify:ip:${ip}`,
    /** Higher than request because retries are expected. */
    RL_REQUEST_PER_IP_MAX * 3,
    RL_REQUEST_PER_IP_WINDOW_MS
  );
  if (!ipHit.ok) {
    return { success: false, error: "Too many verification attempts from this network. Try again later." };
  }
  const guestVerifyHit = hitSlidingWindow(
    `poll:otp:verify:guest:${guestId}`,
    RL_VERIFY_PER_GUEST_MAX,
    RL_VERIFY_PER_GUEST_WINDOW_MS
  );
  if (!guestVerifyHit.ok) {
    return { success: false, error: "Too many code attempts. Request a new code and try again." };
  }

  const row = await prisma.pollVerification.findFirst({
    where: { guestId, isUsed: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      eventId: true,
      codeHash: true,
      expiresAt: true,
      attemptCount: true,
      guest: { select: { id: true, hasVoted: true } },
      event: { select: { id: true, poll: true } }
    }
  });
  if (!row) {
    return { success: false, error: "No active code on file. Request a new one." };
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return { success: false, error: "That code expired. Request a new one." };
  }
  if (row.attemptCount >= POLL_OTP_MAX_ATTEMPTS) {
    /** Burn the row so subsequent attempts hit the "no active code" branch. */
    await prisma.pollVerification.update({
      where: { id: row.id },
      data: { isUsed: true }
    });
    return { success: false, error: "Too many incorrect attempts. Request a new code." };
  }

  const ok = await verifyPollOtpCode(code, row.codeHash);
  if (!ok) {
    const remaining = POLL_OTP_MAX_ATTEMPTS - (row.attemptCount + 1);
    await prisma.pollVerification.update({
      where: { id: row.id },
      data: { attemptCount: { increment: 1 } }
    });
    if (remaining <= 0) {
      return { success: false, error: "That code is incorrect. Request a new code." };
    }
    return {
      success: false,
      error: `That code is incorrect. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
    };
  }

  if (row.guest.hasVoted) {
    return {
      success: false,
      error: "Our records show you've already cast your ballot for this poll."
    };
  }
  const windowResult = classifyPollWindow(row.event.poll);
  if (windowResult.state !== "open") {
    return { success: false, error: pollWindowMessage(windowResult.state) };
  }

  const session = issueVotingSession({
    guestId: row.guest.id,
    eventId: row.eventId,
    pollId: windowResult.poll.id,
    verificationId: row.id
  });

  return {
    success: true,
    data: {
      eventId: row.eventId,
      pollId: windowResult.poll.id,
      sessionExpiresAt: session.expiresAt
    }
  };
}

const ballotPositionChoiceSchema = z
  .object({
    positionId: z.string().min(1),
    candidateId: z.string().min(1).nullable(),
    confidenceChoice: z.nativeEnum(VoteConfidenceChoice).nullable()
  })
  .refine(
    (v) => v.candidateId !== null || v.confidenceChoice !== null,
    "Each position needs either a candidate pick or a confidence vote."
  );

const submitBallotSchema = z.object({
  picks: z.array(ballotPositionChoiceSchema).min(1, "Cast at least one selection.")
});

export type SubmitBallotResult = ActionResult<{
  pollId: string;
  recorded: number;
  /** Opaque reference shown to the voter and echoed in the receipt email. */
  receiptRef: string;
  /** Mirrors `Poll.isAnonymous` at submission time — used to pick confirmation copy. */
  isAnonymous: boolean;
}>;

/**
 * Phase 4 ballot submission. Atomic by construction:
 *
 *   1. The action reads the HMAC-signed voting cookie (issued by verifyVotingOTP) to
 *      learn the bearer's `{ guestId, eventId, pollId, verificationId }`.
 *   2. A single `prisma.$transaction` then:
 *        - re-checks the verification row (still unused, not expired, matches cookie),
 *        - re-checks the guest (hasVoted=false, still belongs to event),
 *        - re-checks the poll window (active + within [startTime, endTime]),
 *        - validates each pick against the live position/candidate set,
 *        - asserts every position is covered exactly once,
 *        - inserts the `Vote` rows (anonymized — no guest FK, ALWAYS written),
 *        - if `poll.isAnonymous === false`, ALSO inserts `BallotChoice` rows linking
 *          the same selections to `guestId` for admin audit + receipt echo,
 *        - flips `Guest.hasVoted = true`,
 *        - flips `PollVerification.isUsed = true` + stamps `consumedAt`.
 *   3. The voting cookie is then cleared so a refresh after submit lands cleanly.
 *
 * Anonymization invariant in `Poll.isAnonymous === true` mode: nothing in the writes
 * references the guest beyond the participation flag. The cookie is the only artefact
 * that links voter → ballot, and it dies at step 3.
 */
export async function submitBallot(
  input: z.input<typeof submitBallotSchema>
): Promise<SubmitBallotResult> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;

  const parsed = submitBallotSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const session = readVotingSession();
  if (!session) {
    return {
      success: false,
      error: "Your voting session has expired. Request a fresh code and try again."
    };
  }

  /** Defensive: server-side pick map keyed by positionId; reject duplicates upfront. */
  const pickByPosition = new Map<string, z.output<typeof ballotPositionChoiceSchema>>();
  for (const pick of parsed.data.picks) {
    if (pickByPosition.has(pick.positionId)) {
      return {
        success: false,
        error: "Your ballot has two selections for the same position. Please refresh and try again."
      };
    }
    pickByPosition.set(pick.positionId, pick);
  }

  try {
    const receiptRef = randomUUID();

    const txResult = await prisma.$transaction(async (tx) => {
      const verification = await tx.pollVerification.findUnique({
        where: { id: session.vid },
        select: {
          id: true,
          eventId: true,
          guestId: true,
          expiresAt: true,
          isUsed: true
        }
      });
      if (
        !verification ||
        verification.isUsed ||
        verification.expiresAt.getTime() <= Date.now() ||
        verification.eventId !== session.eid ||
        verification.guestId !== session.gid
      ) {
        throw new BallotError(
          "Your voting session is no longer valid. Request a fresh code and try again."
        );
      }

      const guest = await tx.guest.findUnique({
        where: { id: verification.guestId },
        select: { id: true, eventId: true, hasVoted: true }
      });
      if (!guest || guest.eventId !== verification.eventId) {
        throw new BallotError("Guest record could not be re-verified.");
      }
      if (guest.hasVoted) {
        throw new BallotError(
          "Our records show your ballot has already been recorded. Thanks for voting."
        );
      }

      const poll = await tx.poll.findUnique({
        where: { id: session.pid },
        include: {
          positions: {
            include: { candidates: { select: { id: true, name: true } } }
          }
        }
      });
      if (!poll || poll.eventId !== verification.eventId) {
        throw new BallotError("Poll could not be re-verified.");
      }
      const windowResult = classifyPollWindow(poll);
      if (windowResult.state !== "open") {
        throw new BallotError(pollWindowMessage(windowResult.state));
      }

      if (poll.positions.length !== pickByPosition.size) {
        throw new BallotError(
          "Your ballot does not cover every position on this poll. Please refresh and try again."
        );
      }

      const voteRows: Prisma.VoteCreateManyInput[] = [];
      /**
       * Mirrors `voteRows` 1-to-1 — written ONLY when `poll.isAnonymous` is false.
       * Carries the same selection plus the guest link and a shared receiptRef.
       */
      const ballotChoiceRows: Prisma.BallotChoiceCreateManyInput[] = [];
      /** Pre-rendered "position → human-friendly choice" lines for the receipt email. */
      const receiptChoiceLines: { positionTitle: string; selection: string }[] = [];
      for (const position of poll.positions) {
        const pick = pickByPosition.get(position.id);
        if (!pick) {
          throw new BallotError(`Missing a selection for "${position.title}".`);
        }
        const isUnopposed = position.candidates.length === 1;
        const candidatesById = new Map(position.candidates.map((c) => [c.id, c]));

        if (isUnopposed) {
          if (!pick.confidenceChoice) {
            throw new BallotError(
              `"${position.title}" requires a Yes / No / Abstain selection.`
            );
          }
          if (pick.confidenceChoice === VoteConfidenceChoice.YES) {
            const sole = position.candidates[0]!.id;
            if (pick.candidateId !== sole) {
              throw new BallotError(
                `"${position.title}" — confidence vote does not match the sole candidate on the ballot. Please refresh.`
              );
            }
          } else if (pick.candidateId !== null) {
            throw new BallotError(
              `"${position.title}" — confidence vote should not carry a candidate selection.`
            );
          }
        } else {
          if (pick.confidenceChoice !== null) {
            throw new BallotError(
              `"${position.title}" is contested — a confidence vote isn't accepted here.`
            );
          }
          if (!pick.candidateId || !candidatesById.has(pick.candidateId)) {
            throw new BallotError(
              `"${position.title}" — candidate selection is not on the ballot. Please refresh.`
            );
          }
        }

        voteRows.push({
          pollId: poll.id,
          positionId: position.id,
          candidateId: pick.candidateId,
          confidenceChoice: pick.confidenceChoice
        });
        ballotChoiceRows.push({
          pollId: poll.id,
          positionId: position.id,
          candidateId: pick.candidateId,
          confidenceChoice: pick.confidenceChoice,
          guestId: guest.id,
          receiptRef
        });

        const candidateName = pick.candidateId
          ? candidatesById.get(pick.candidateId)?.name ?? null
          : null;
        let selectionLabel: string;
        if (isUnopposed) {
          switch (pick.confidenceChoice) {
            case VoteConfidenceChoice.YES:
              selectionLabel = candidateName
                ? `Yes — confidence (${candidateName})`
                : "Yes — confidence";
              break;
            case VoteConfidenceChoice.NO:
              selectionLabel = "No — no confidence";
              break;
            case VoteConfidenceChoice.ABSTAIN:
              selectionLabel = "Abstain";
              break;
            default:
              selectionLabel = "Abstain";
          }
        } else {
          selectionLabel = candidateName ?? "Selection recorded";
        }
        receiptChoiceLines.push({ positionTitle: position.title, selection: selectionLabel });
      }

      await tx.vote.createMany({ data: voteRows });
      /**
       * Attribution layer — only persisted when the organizer turned anonymity OFF.
       * In anonymous mode this table stays empty for the poll; guest attribution
       * literally never touches the database.
       */
      if (!poll.isAnonymous && ballotChoiceRows.length > 0) {
        await tx.ballotChoice.createMany({ data: ballotChoiceRows });
      }
      await tx.guest.update({
        where: { id: guest.id },
        data: { hasVoted: true }
      });
      await tx.pollVerification.update({
        where: { id: verification.id },
        data: { isUsed: true, consumedAt: new Date() }
      });

      return {
        pollId: poll.id,
        recorded: voteRows.length,
        isAnonymous: poll.isAnonymous,
        choiceLines: receiptChoiceLines
      };
    });

    /**
     * Cookie cleanup happens AFTER the transaction commits so a tx rollback doesn't
     * leave the voter in a half-clean state. Best-effort — if the cookie write fails
     * (rare; only inside an unsupported context) the vote is still recorded and the
     * client redirect will land on the gate next time.
     */
    try {
      clearVotingSession();
    } catch {
      /* no-op — see comment above */
    }

    try {
      issuePollThanksCookie({
        guestId: session.gid,
        eventId: session.eid,
        pollId: txResult.pollId,
        receiptRef
      });
    } catch (err) {
      console.error("[submitBallot] thanks cookie failed", err);
    }

    /** Best-effort receipt email — must not fail an already-recorded ballot. */
    try {
      const guestRow = await prisma.guest.findUnique({
        where: { id: session.gid },
        select: {
          email: true,
          phone: true,
          name: true,
          event: {
            select: {
              name: true,
              orgId: true,
              brandPrimaryColor: true,
              org: { select: { name: true, resendApiKey: true } }
            }
          }
        }
      });
      const pollRow = await prisma.poll.findUnique({
        where: { id: txResult.pollId },
        select: { title: true }
      });
      if (guestRow?.email?.trim() && pollRow) {
        const guestFirstName =
          guestRow.name.trim().split(/\s+/)[0]?.length > 0
            ? guestRow.name.trim().split(/\s+/)[0]!
            : "there";
        await sendPollBallotReceiptEmail({
          to: guestRow.email.trim(),
          guestFirstName,
          eventName: guestRow.event.name,
          orgName: guestRow.event.org.name,
          pollTitle: pollRow.title,
          receiptRef,
          brandPrimaryColor: guestRow.event.brandPrimaryColor,
          /**
           * Anonymous polls: pass null so the email never echoes a selection back.
           * Attributed polls: pass the per-position choice labels so the voter has
           * a written reference of how they voted.
           */
          choices: txResult.isAnonymous ? null : txResult.choiceLines,
          resendApiKeyOverride: guestRow.event.org.resendApiKey?.trim() || undefined
        });
      }
      /**
       * Attributed polls only: echo the ballot back over SMS when the guest has a
       * usable phone and mNotify is configured for the org.
       */
      if (!txResult.isAnonymous && guestRow && pollRow && txResult.choiceLines.length > 0) {
        await sendPollBallotReceiptSms({
          orgId: guestRow.event.orgId,
          phone: guestRow.phone,
          eventName: guestRow.event.name,
          pollTitle: pollRow.title,
          receiptRef,
          choices: txResult.choiceLines
        });
      }
    } catch (err) {
      console.error("[submitBallot] receipt notifications failed", err);
    }

    /** Refresh the admin tab for any organizer watching the tally live. */
    revalidatePath(`/events/${session.eid}/election`);

    return {
      success: true,
      data: {
        pollId: txResult.pollId,
        recorded: txResult.recorded,
        receiptRef,
        isAnonymous: txResult.isAnonymous
      }
    };
  } catch (error) {
    if (error instanceof BallotError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "We couldn't record your ballot. Please try again in a moment."
    };
  }
}

class BallotError extends Error {}

// =====================================================================
// Admin CRUD actions — gated on canManageEvents + event.orgId match.
// All mutations revalidate `/events/[id]/election` (the admin Poll tab) so
// the tally + setup form reflect the latest state on next render. The public
// ballot route at `/events/[id]/poll` is `dynamic = "force-dynamic"` and does
// not need explicit revalidation.
// =====================================================================

const upsertPollSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required.").max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  /**
   * Procedural voting instructions (how the OTP works, ballot rules, etc.).
   * Distinct from the editorial `description` preamble. Up to 4000 chars.
   */
  instructions: z.string().trim().max(4000).nullable().optional(),
  isActive: z.boolean().optional(),
  /**
   * Anonymity mode. Optional in the schema so older callers that don't pass it
   * fall through to the DB default (`true`). The setup form always submits a
   * boolean value once the form is mounted.
   */
  isAnonymous: z.boolean().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date()
});

export type UpsertEventPollResult = ActionResult<{ pollId: string }>;

async function requireEventForOrg(eventId: string): Promise<
  | { ok: true; orgId: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.orgId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!canManageEvents(session.user.role)) {
    return { ok: false, error: "You don't have permission to manage this poll." };
  }
  const planBlocked = await guardModuleActionForOrg(session.user.orgId, "polling");
  if (planBlocked) {
    return { ok: false, error: planBlocked.error };
  }
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId: session.user.orgId },
    select: { id: true, orgId: true }
  });
  if (!event) {
    return { ok: false, error: "Event not found in your workspace." };
  }
  return { ok: true, orgId: event.orgId };
}

async function requirePositionForOrg(positionId: string): Promise<
  | { ok: true; eventId: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.orgId) return { ok: false, error: "You must be signed in." };
  if (!canManageEvents(session.user.role)) {
    return { ok: false, error: "You don't have permission." };
  }
  const position = await prisma.pollPosition.findUnique({
    where: { id: positionId },
    select: { poll: { select: { event: { select: { id: true, orgId: true } } } } }
  });
  const event = position?.poll.event;
  if (!event || event.orgId !== session.user.orgId) {
    return { ok: false, error: "Position not found in your workspace." };
  }
  return { ok: true, eventId: event.id };
}

async function requireCandidateForOrg(candidateId: string): Promise<
  | { ok: true; eventId: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.orgId) return { ok: false, error: "You must be signed in." };
  if (!canManageEvents(session.user.role)) {
    return { ok: false, error: "You don't have permission." };
  }
  const candidate = await prisma.pollCandidate.findUnique({
    where: { id: candidateId },
    select: {
      position: { select: { poll: { select: { event: { select: { id: true, orgId: true } } } } } }
    }
  });
  const event = candidate?.position.poll.event;
  if (!event || event.orgId !== session.user.orgId) {
    return { ok: false, error: "Candidate not found in your workspace." };
  }
  return { ok: true, eventId: event.id };
}

/**
 * Create the poll row for an event if absent, otherwise update its metadata.
 * `isActive=true` is only honored when `startTime < endTime` and the window is
 * meaningful — defensive guard against a typo locking voters out.
 */
export async function upsertEventPoll(
  input: z.input<typeof upsertPollSchema>
): Promise<UpsertEventPollResult> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;

  const parsed = upsertPollSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guard = await requireEventForOrg(parsed.data.eventId);
  if (!guard.ok) return { success: false, error: guard.error };

  if (parsed.data.endTime.getTime() <= parsed.data.startTime.getTime()) {
    return { success: false, error: "End time must be after start time." };
  }

  const description = parsed.data.description?.trim() || null;
  const instructions = parsed.data.instructions?.trim() || null;

  const existing = await prisma.poll.findUnique({
    where: { eventId: parsed.data.eventId },
    select: { id: true }
  });

  /**
   * Anonymity rule: organizers can freely switch from anonymous → non-anonymous
   * BEFORE any vote is cast. Once one vote has been recorded the toggle is
   * frozen for the rest of the poll so we never end up with a partial
   * attribution dataset (e.g. only the late voters are linked to their
   * choices). The check uses `Guest.hasVoted` because it's the only Guest-side
   * trace we keep in either mode.
   */
  let isAnonymous: boolean | undefined = parsed.data.isAnonymous;
  if (existing && typeof isAnonymous === "boolean") {
    const currentPoll = await prisma.poll.findUnique({
      where: { id: existing.id },
      select: { isAnonymous: true }
    });
    if (currentPoll && currentPoll.isAnonymous !== isAnonymous) {
      const submittedCount = await prisma.guest.count({
        where: { eventId: parsed.data.eventId, hasVoted: true }
      });
      if (submittedCount > 0) {
        return {
          success: false,
          error:
            "Voting has already started — the anonymity setting is locked for the rest of this poll."
        };
      }
    }
  }

  const poll = existing
    ? await prisma.poll.update({
        where: { id: existing.id },
        data: {
          title: parsed.data.title,
          description,
          instructions,
          isActive: parsed.data.isActive ?? false,
          ...(typeof isAnonymous === "boolean" ? { isAnonymous } : {}),
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime
        },
        select: { id: true }
      })
    : await prisma.poll.create({
        data: {
          eventId: parsed.data.eventId,
          title: parsed.data.title,
          description,
          instructions,
          isActive: parsed.data.isActive ?? false,
          ...(typeof isAnonymous === "boolean" ? { isAnonymous } : {}),
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime
        },
        select: { id: true }
      });

  revalidatePath(`/events/${parsed.data.eventId}/election`);
  revalidatePath(`/events/${parsed.data.eventId}/publish`);
  revalidatePath(`/register/${parsed.data.eventId}`);
  revalidatePath(`/events/${parsed.data.eventId}/poll`);
  return { success: true, data: { pollId: poll.id } };
}

const setActiveSchema = z.object({
  eventId: z.string().min(1),
  isActive: z.boolean()
});

export async function setPollActive(
  input: z.input<typeof setActiveSchema>
): Promise<ActionResult<{ isActive: boolean }>> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;
  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guard = await requireEventForOrg(parsed.data.eventId);
  if (!guard.ok) return { success: false, error: guard.error };

  const poll = await prisma.poll.findUnique({
    where: { eventId: parsed.data.eventId },
    select: { id: true }
  });
  if (!poll) {
    return { success: false, error: "Configure the poll window before activating it." };
  }
  await prisma.poll.update({
    where: { id: poll.id },
    data: { isActive: parsed.data.isActive }
  });
  revalidatePath(`/events/${parsed.data.eventId}/election`);
  revalidatePath(`/events/${parsed.data.eventId}/publish`);
  revalidatePath(`/register/${parsed.data.eventId}`);
  return { success: true, data: { isActive: parsed.data.isActive } };
}

const setPublicElectionPublishedSchema = z.object({
  eventId: z.string().min(1),
  published: z.boolean()
});

/** Show or hide the election block on the public registration page (independent of voting pause). */
export async function setPollPublicElectionPublished(
  input: z.input<typeof setPublicElectionPublishedSchema>
): Promise<ActionResult<{ publicElectionPublished: boolean }>> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;
  const parsed = setPublicElectionPublishedSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guard = await requireEventForOrg(parsed.data.eventId);
  if (!guard.ok) return { success: false, error: guard.error };

  const poll = await prisma.poll.findUnique({
    where: { eventId: parsed.data.eventId },
    select: { id: true, _count: { select: { positions: true } } }
  });
  if (!poll) {
    return { success: false, error: "Configure the poll before publishing it on the registration page." };
  }
  if (parsed.data.published && poll._count.positions === 0) {
    return {
      success: false,
      error: "Add at least one position before publishing the election on the public page."
    };
  }

  await prisma.poll.update({
    where: { id: poll.id },
    data: { publicElectionPublished: parsed.data.published }
  });
  revalidatePath(`/events/${parsed.data.eventId}/election`);
  revalidatePath(`/events/${parsed.data.eventId}/publish`);
  revalidatePath(`/register/${parsed.data.eventId}`);
  return { success: true, data: { publicElectionPublished: parsed.data.published } };
}

const positionInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional()
});

export async function createPollPosition(
  input: { eventId: string } & z.input<typeof positionInputSchema>
): Promise<ActionResult<{ positionId: string }>> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;
  const guard = await requireEventForOrg(input.eventId);
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = positionInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const poll = await prisma.poll.findUnique({
    where: { eventId: input.eventId },
    select: { id: true, _count: { select: { positions: true } } }
  });
  if (!poll) {
    return { success: false, error: "Configure the poll window first." };
  }

  const position = await prisma.pollPosition.create({
    data: {
      pollId: poll.id,
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      sortOrder: parsed.data.sortOrder ?? poll._count.positions
    },
    select: { id: true }
  });
  revalidatePath(`/events/${input.eventId}/election`);
  revalidatePath(`/register/${input.eventId}`);
  return { success: true, data: { positionId: position.id } };
}

export async function updatePollPosition(
  input: { positionId: string } & z.input<typeof positionInputSchema>
): Promise<ActionResult<null>> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;
  const guard = await requirePositionForOrg(input.positionId);
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = positionInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  await prisma.pollPosition.update({
    where: { id: input.positionId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      ...(parsed.data.sortOrder != null ? { sortOrder: parsed.data.sortOrder } : {})
    }
  });
  revalidatePath(`/events/${guard.eventId}/election`);
  revalidatePath(`/register/${guard.eventId}`);
  return { success: true, data: null };
}

export async function deletePollPosition(
  input: { positionId: string }
): Promise<ActionResult<null>> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;
  const guard = await requirePositionForOrg(input.positionId);
  if (!guard.ok) return { success: false, error: guard.error };

  /** Hard-block delete once any votes are on file for this position to preserve audit. */
  const existingVotes = await prisma.vote.count({ where: { positionId: input.positionId } });
  if (existingVotes > 0) {
    return {
      success: false,
      error: "Cannot delete a position that already has votes on the ballot. Close the poll instead."
    };
  }
  await prisma.pollPosition.delete({ where: { id: input.positionId } });
  revalidatePath(`/events/${guard.eventId}/election`);
  revalidatePath(`/register/${guard.eventId}`);
  return { success: true, data: null };
}

/**
 * Photo / resource URLs accept either an absolute https URL OR a workspace-relative
 * `/uploads/…` path (returned by the candidate-photo / candidate-resource upload
 * routes). The `.refine` below validates either shape without forcing organizers to
 * host on a CDN.
 */
const mediaUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .nullable()
  .optional()
  .refine(
    (v) => {
      if (v == null || v.length === 0) return true;
      return /^https?:\/\//i.test(v) || v.startsWith("/uploads/");
    },
    { message: "Use an uploaded file or a full https URL." }
  );

const candidateInputSchema = z.object({
  name: z.string().trim().min(1, "Candidate name is required.").max(160),
  role: z.string().trim().max(160).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  photoUrl: mediaUrlSchema,
  resourceUrl: mediaUrlSchema,
  resourceName: z.string().trim().max(160).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional()
});

function normalizePhotoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function createPollCandidate(
  input: { positionId: string } & z.input<typeof candidateInputSchema>
): Promise<ActionResult<{ candidateId: string }>> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;
  const guard = await requirePositionForOrg(input.positionId);
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = candidateInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const existingVotes = await prisma.vote.count({ where: { positionId: input.positionId } });
  if (existingVotes > 0) {
    return {
      success: false,
      error: "Cannot add a candidate to a position that already has votes. Close and reopen the poll with a fresh ballot."
    };
  }

  const position = await prisma.pollPosition.findUnique({
    where: { id: input.positionId },
    select: { _count: { select: { candidates: true } } }
  });
  if (!position) return { success: false, error: "Position not found." };

  const candidate = await prisma.pollCandidate.create({
    data: {
      positionId: input.positionId,
      name: parsed.data.name,
      role: normalizeText(parsed.data.role),
      bio: normalizeText(parsed.data.bio),
      photoUrl: normalizePhotoUrl(parsed.data.photoUrl),
      resourceUrl: normalizePhotoUrl(parsed.data.resourceUrl),
      resourceName: normalizeText(parsed.data.resourceName),
      sortOrder: parsed.data.sortOrder ?? position._count.candidates
    },
    select: { id: true }
  });
  revalidatePath(`/events/${guard.eventId}/election`);
  revalidatePath(`/register/${guard.eventId}`);
  return { success: true, data: { candidateId: candidate.id } };
}

export async function updatePollCandidate(
  input: { candidateId: string } & z.input<typeof candidateInputSchema>
): Promise<ActionResult<null>> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;
  const guard = await requireCandidateForOrg(input.candidateId);
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = candidateInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  await prisma.pollCandidate.update({
    where: { id: input.candidateId },
    data: {
      name: parsed.data.name,
      role: normalizeText(parsed.data.role),
      bio: normalizeText(parsed.data.bio),
      photoUrl: normalizePhotoUrl(parsed.data.photoUrl),
      resourceUrl: normalizePhotoUrl(parsed.data.resourceUrl),
      resourceName: normalizeText(parsed.data.resourceName),
      ...(parsed.data.sortOrder != null ? { sortOrder: parsed.data.sortOrder } : {})
    }
  });
  revalidatePath(`/events/${guard.eventId}/election`);
  revalidatePath(`/register/${guard.eventId}`);
  return { success: true, data: null };
}

export async function deletePollCandidate(
  input: { candidateId: string }
): Promise<ActionResult<null>> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;
  const guard = await requireCandidateForOrg(input.candidateId);
  if (!guard.ok) return { success: false, error: guard.error };

  const existingVotes = await prisma.vote.count({ where: { candidateId: input.candidateId } });
  if (existingVotes > 0) {
    return {
      success: false,
      error: "Cannot delete a candidate that already has votes. Close the poll instead."
    };
  }
  await prisma.pollCandidate.delete({ where: { id: input.candidateId } });
  revalidatePath(`/events/${guard.eventId}/election`);
  revalidatePath(`/register/${guard.eventId}`);
  return { success: true, data: null };
}

const publishResultsSchema = z.object({
  eventId: z.string().min(1),
  channels: z.array(z.enum(["email", "sms"])).min(1, "Pick at least one delivery channel."),
  customMessage: z.string().trim().max(2000).optional().nullable(),
  /** When true and the poll is already published, re-runs the broadcast (idempotent for `publishedAt`). */
  rebroadcast: z.boolean().optional().default(false)
});

export type PublishPollResultsResult = {
  publishedAt: string;
  resultsUrl: string | null;
  emailsAttempted: number;
  emailsSent: number;
  emailsSkipped: number;
  smsAttempted: number;
  smsSent: number;
  smsSkipped: number;
  errors: string[];
};

/**
 * Publish the poll's results: set `Poll.resultsPublishedAt`, save an optional admin
 * message, and broadcast the results URL via email and/or SMS to every guest in the
 * event. Re-running with `rebroadcast: true` re-sends without changing `publishedAt`.
 *
 * Permissions: ADMIN / MARKETING (canManageEvents) with the event in the user's org.
 */
export async function publishPollResults(
  input: z.input<typeof publishResultsSchema>
): Promise<ActionResult<PublishPollResultsResult>> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;

  const parsed = publishResultsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guard = await requireEventForOrg(parsed.data.eventId);
  if (!guard.ok) return { success: false, error: guard.error };

  const eventRow = await prisma.event.findUnique({
    where: { id: parsed.data.eventId },
    select: {
      id: true,
      name: true,
      brandPrimaryColor: true,
      org: { select: { id: true, name: true, resendApiKey: true } },
      poll: {
        select: { id: true, title: true, resultsPublishedAt: true }
      }
    }
  });
  if (!eventRow?.poll) {
    return { success: false, error: "No poll is configured for this event yet." };
  }

  const tally = await getPollTallyForEvent(parsed.data.eventId);
  if (!tally) {
    return { success: false, error: "Could not load the tally for this poll." };
  }

  const guests = await prisma.guest.findMany({
    where: { eventId: parsed.data.eventId },
    select: { id: true, name: true, email: true, phone: true }
  });

  const resultsUrl = getEventPollResultsAbsoluteUrl(parsed.data.eventId);
  if (!resultsUrl) {
    return {
      success: false,
      error:
        "Public site URL is not configured (set NEXTAUTH_URL or PUBLIC_BASE_URL) so we cannot generate the shareable results link."
    };
  }

  const customMessage = parsed.data.customMessage?.trim() || null;
  /** Stamp publishedAt + persist the admin's note BEFORE broadcasting so the public page is live in time for inbound clicks. */
  const publishedAt = new Date();
  const wasAlreadyPublished = Boolean(eventRow.poll.resultsPublishedAt);
  if (!wasAlreadyPublished || parsed.data.rebroadcast) {
    await prisma.poll.update({
      where: { id: eventRow.poll.id },
      data: {
        resultsPublishedAt: wasAlreadyPublished
          ? eventRow.poll.resultsPublishedAt
          : publishedAt,
        resultsSummary: customMessage
      }
    });
  }

  const summary = buildPollResultsSummary({
    totalGuests: tally.turnout.totalGuests,
    ballotsCast: tally.turnout.ballotsCast,
    turnoutPct: tally.turnout.turnoutPct,
    positions: tally.positions.map((p) => ({
      title: p.title,
      isUnopposed: p.isUnopposed,
      totalVotes: p.totalVotes,
      candidates: p.candidates.map((c) => ({ name: c.name, votes: c.votes, sharePct: c.sharePct })),
      confidence: p.confidence
    }))
  });

  const broadcast = await broadcastPollResults({
    channels: parsed.data.channels as PollResultsBroadcastChannel[],
    targets: guests,
    pollTitle: eventRow.poll.title,
    eventName: eventRow.name,
    org: {
      id: eventRow.org.id,
      name: eventRow.org.name,
      brandPrimaryColor: eventRow.brandPrimaryColor,
      resendApiKey: eventRow.org.resendApiKey
    },
    resultsUrl,
    summary,
    customMessage
  });

  revalidatePath(`/events/${parsed.data.eventId}/election`);
  revalidatePath(`/events/${parsed.data.eventId}/poll/results`);

  return {
    success: true,
    data: {
      publishedAt: (eventRow.poll.resultsPublishedAt ?? publishedAt).toISOString(),
      resultsUrl,
      emailsAttempted: broadcast.emailsAttempted,
      emailsSent: broadcast.emailsSent,
      emailsSkipped: broadcast.emailsSkipped,
      smsAttempted: broadcast.smsAttempted,
      smsSent: broadcast.smsSent,
      smsSkipped: broadcast.smsSkipped,
      errors: broadcast.errors
    }
  };
}

const unpublishResultsSchema = z.object({ eventId: z.string().min(1) });

/**
 * Hides the public results page again. Useful if the admin needs to correct an error
 * before sharing a fresh broadcast. Does NOT clear `Vote` rows.
 */
export async function unpublishPollResults(
  input: z.input<typeof unpublishResultsSchema>
): Promise<ActionResult<null>> {
  const moduleBlocked = guardModuleAction("polling");
  if (moduleBlocked) return moduleBlocked;

  const parsed = unpublishResultsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const guard = await requireEventForOrg(parsed.data.eventId);
  if (!guard.ok) return { success: false, error: guard.error };

  const poll = await prisma.poll.findUnique({
    where: { eventId: parsed.data.eventId },
    select: { id: true }
  });
  if (!poll) return { success: false, error: "No poll is configured for this event." };

  await prisma.poll.update({
    where: { id: poll.id },
    data: { resultsPublishedAt: null }
  });
  revalidatePath(`/events/${parsed.data.eventId}/election`);
  revalidatePath(`/events/${parsed.data.eventId}/poll/results`);
  return { success: true, data: null };
}

function maskEmail(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (local.length <= 2) return `${local[0] ?? "*"}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return `••• •• ${digits.slice(-3)}`;
}
