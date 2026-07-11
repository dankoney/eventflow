"use client";

import { EventFeedbackRating, EventType } from "@prisma/client";
import { useState } from "react";

import { FeedbackSubmitIdentityStep } from "@/components/feedback/FeedbackSubmitIdentityStep";
import { FeedbackSubmitVisibilityStep } from "@/components/feedback/FeedbackSubmitVisibilityStep";
import { FeedbackMarketingOptInFields } from "@/components/feedback/FeedbackMarketingOptInFields";
import { Button } from "@/components/ui/Button";
import { FeedbackOptionalQuestionFields } from "@/components/feedback/FeedbackOptionalQuestionFields";
import {
  submitAnonymousEventFeedback,
  submitEventFeedback,
  submitPortalFeedbackAnonymous,
  submitPortalFeedbackLinked
} from "@/lib/actions/eventFeedback.actions";
import type { EventFeedbackQuestion } from "@/lib/event-feedback/feedbackQuestions";
import { feedbackPortalTagline } from "@/lib/event-feedback/portalCopy";
import {
  EVENT_FEEDBACK_RATINGS,
  EVENT_FEEDBACK_RATING_META
} from "@/lib/event-feedback/ratings";
import type { PhoneDialOption } from "@/lib/register/phoneDialOptions";
import { cn, formatDate } from "@/lib/utils";

type EventFeedbackFormProps = {
  mode?: "guest" | "anonymous" | "portal";
  guestId?: string;
  token?: string;
  eventId?: string;
  portalToken?: string;
  shortCode?: string;
  eventType?: EventType;
  phoneDialOptions?: PhoneDialOption[];
  accent?: string;
  guestName?: string;
  eventName: string;
  initialRating: EventFeedbackRating | null;
  initialComment?: string | null;
  ratingPrefilledFromEmail?: boolean;
  feedbackClosesAt?: Date | string;
  feedbackQuestions?: EventFeedbackQuestion[] | null;
  initialAnswers?: Record<string, string> | null;
  feedbackAnonymous?: boolean;
  /** True when guest already has a saved response (skip visibility choice on update). */
  hasExistingResponse?: boolean;
  existingSubmittedAnonymously?: boolean;
  showMarketingOptIn?: boolean;
  marketingConsentLabel?: string;
  marketingPrivacyPolicyUrl?: string | null;
};

function FeedbackRatingPicker({
  selected,
  busy,
  onSelect
}: {
  selected: EventFeedbackRating | null;
  busy: boolean;
  onSelect: (rating: EventFeedbackRating) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3"
      role="radiogroup"
      aria-label="Rate your experience"
    >
      {EVENT_FEEDBACK_RATINGS.map((rating) => {
        const meta = EVENT_FEEDBACK_RATING_META[rating];
        const active = selected === rating;
        return (
          <button
            key={rating}
            type="button"
            disabled={busy}
            role="radio"
            aria-checked={active}
            aria-label={meta.label}
            onClick={() => onSelect(rating)}
            className={cn(
              "flex min-w-[4.75rem] max-w-[5.5rem] flex-1 flex-col items-center justify-center rounded-2xl border-2 px-1.5 py-3 transition sm:min-w-[5.25rem] sm:max-w-none sm:px-2 sm:py-3.5",
              active
                ? "border-zinc-900 bg-zinc-900 text-white shadow-lg scale-[1.02]"
                : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 hover:scale-[1.02]",
              busy && "pointer-events-none opacity-60"
            )}
          >
            <span className="text-3xl leading-none sm:text-4xl" aria-hidden>
              {meta.emoji}
            </span>
            <span
              className={cn(
                "mt-2 text-center text-[10px] font-semibold leading-tight sm:text-xs",
                active ? "text-white" : "text-zinc-600"
              )}
            >
              {meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function EventFeedbackForm({
  mode = "guest",
  guestId,
  token,
  eventId,
  portalToken,
  shortCode,
  eventType = EventType.HYBRID,
  phoneDialOptions = [],
  accent = "#0f172a",
  guestName = "",
  eventName,
  initialRating,
  initialComment = "",
  ratingPrefilledFromEmail = false,
  feedbackClosesAt,
  feedbackQuestions = null,
  initialAnswers = null,
  feedbackAnonymous = false,
  hasExistingResponse = false,
  existingSubmittedAnonymously = false,
  showMarketingOptIn = false,
  marketingConsentLabel = "",
  marketingPrivacyPolicyUrl = null
}: EventFeedbackFormProps) {
  const [selected, setSelected] = useState<EventFeedbackRating | null>(initialRating);
  const [comment, setComment] = useState(initialComment ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(Boolean(initialRating) && !ratingPrefilledFromEmail);
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialAnswers ?? {});
  const [error, setError] = useState<string | null>(null);
  const [showIdentityStep, setShowIdentityStep] = useState(false);
  const [showVisibilityStep, setShowVisibilityStep] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [marketingEmail, setMarketingEmail] = useState("");

  const optionalQuestions = feedbackQuestions ?? [];
  const optionalCount = optionalQuestions.length;
  const isPortal = mode === "portal";
  const isAnonymous = mode === "anonymous";
  const isGuestLink = mode === "guest";
  const needsVisibilityChoice = isGuestLink && !hasExistingResponse;

  function validateMarketingInput(): boolean {
    if (!showMarketingOptIn || !marketingOptIn) return true;
    if (isPortal && !marketingEmail.trim()) {
      setError("Enter your email to receive marketing updates.");
      return false;
    }
    return true;
  }

  function buildAnswerPayload() {
    if (!optionalCount) return undefined;
    return Object.fromEntries(
      optionalQuestions
        .map((q) => {
          const v = answers[q.key]?.trim() ?? "";
          return v ? [q.key, v] : null;
        })
        .filter((x): x is [string, string] => x !== null)
    );
  }

  async function persistGuestFeedback(submittedAnonymously: boolean) {
    return submitEventFeedback({
      guestId: guestId!,
      token: token!,
      rating: selected!,
      comment: comment.trim() || undefined,
      answers: buildAnswerPayload(),
      submittedAnonymously,
      marketingOptIn: showMarketingOptIn ? marketingOptIn : false
    });
  }

  async function persistFeedback(
    identity: "anonymous" | "linked",
    linkInput?: { email?: string; phoneDialCode?: string; phoneNational?: string },
    submittedAnonymously = false
  ) {
    if (!selected) return;

    const payload = {
      rating: selected,
      comment: comment.trim() || undefined,
      answers: buildAnswerPayload()
    };

    if (isPortal) {
      if (identity === "anonymous") {
        return submitPortalFeedbackAnonymous({
          shortCode: shortCode!,
          ...payload,
          marketingOptIn: showMarketingOptIn ? marketingOptIn : false,
          marketingEmail: marketingOptIn ? marketingEmail.trim() : undefined
        });
      }
      return submitPortalFeedbackLinked({
        shortCode: shortCode!,
        ...linkInput,
        ...payload,
        marketingOptIn: showMarketingOptIn ? marketingOptIn : false,
        marketingEmail: marketingOptIn ? marketingEmail.trim() : undefined
      });
    }

    if (isAnonymous) {
      return submitAnonymousEventFeedback({
        eventId: eventId!,
        portalToken: portalToken!,
        ...payload
      });
    }

    return persistGuestFeedback(submittedAnonymously);
  }

  async function finalizeSubmit(
    identity: "anonymous" | "linked",
    linkInput?: { email?: string; phoneDialCode?: string; phoneNational?: string },
    submittedAnonymously = false
  ) {
    setBusy(true);
    const res = await persistFeedback(identity, linkInput, submittedAnonymously);
    setBusy(false);
    if (!res?.success) {
      setError(res?.error ?? "Could not save your feedback.");
      return;
    }
    setSaved(true);
    setShowIdentityStep(false);
    setShowVisibilityStep(false);
  }

  async function handleSubmit() {
    if (!selected) {
      setError("Please choose an emoji rating first.");
      return;
    }
    if (!validateMarketingInput()) return;
    setError(null);

    if (isPortal) {
      setShowIdentityStep(true);
      return;
    }

    if (needsVisibilityChoice) {
      setShowVisibilityStep(true);
      return;
    }

    const submittedAnonymously = isGuestLink ? existingSubmittedAnonymously : false;
    await finalizeSubmit("anonymous", undefined, submittedAnonymously);
  }

  async function handlePortalAnonymous() {
    setError(null);
    await finalizeSubmit("anonymous");
  }

  async function handlePortalLink(linkInput: {
    email?: string;
    phoneDialCode?: string;
    phoneNational?: string;
  }) {
    setError(null);
    await finalizeSubmit("linked", linkInput, false);
  }

  async function handleGuestNamed() {
    setError(null);
    await finalizeSubmit("anonymous", undefined, false);
  }

  async function handleGuestAnonymous() {
    setError(null);
    await finalizeSubmit("anonymous", undefined, true);
  }

  const firstName = guestName.trim().split(/\s+/)[0] || guestName;
  const activeMeta = selected ? EVENT_FEEDBACK_RATING_META[selected] : null;
  const shouldShowSavedCard = Boolean(saved && activeMeta);

  if (showVisibilityStep && isGuestLink) {
    return (
      <FeedbackSubmitVisibilityStep
        guestFirstName={firstName}
        accent={accent}
        busy={busy}
        error={error}
        onSubmitNamed={() => void handleGuestNamed()}
        onSubmitAnonymous={() => void handleGuestAnonymous()}
        onBack={() => {
          setShowVisibilityStep(false);
          setError(null);
        }}
      />
    );
  }

  if (showIdentityStep && isPortal) {
    return (
      <FeedbackSubmitIdentityStep
        eventType={eventType}
        phoneDialOptions={phoneDialOptions}
        accent={accent}
        busy={busy}
        error={error}
        onAnonymous={() => void handlePortalAnonymous()}
        onLink={(input) => void handlePortalLink(input)}
        onBack={() => {
          setShowIdentityStep(false);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-[min(70dvh,640px)] flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-4">
        <div className="text-center">
          {isPortal ? (
            <p className="text-sm font-medium text-zinc-500">{feedbackPortalTagline()}</p>
          ) : isAnonymous ? (
            <p className="text-sm font-medium text-zinc-500">Anonymous feedback</p>
          ) : (
            <p className="text-sm font-medium text-zinc-500">Hi {firstName}</p>
          )}
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">How was {eventName}?</h2>
          {saved && activeMeta ? (
            <p className="mt-2 text-sm text-zinc-600">
              Thanks — we saved your feedback. You can update it anytime.
            </p>
          ) : ratingPrefilledFromEmail ? (
            <p className="mt-2 text-sm text-zinc-600">
              We prefilled your rating from your email. Review it and tap{" "}
              <strong>Submit feedback</strong> to save.
            </p>
          ) : isPortal ? null : (
            <p className="mt-2 text-sm text-zinc-600">
              {isAnonymous
                ? "Your response is not linked to your name or contact details."
                : "Each emoji shows what it means. Pick one, add an optional comment, then submit."}
            </p>
          )}
          {feedbackClosesAt ? (
            <p className="mt-1 text-xs text-zinc-500">
              You can update your feedback until {formatDate(feedbackClosesAt)}.
            </p>
          ) : null}
        </div>

        {shouldShowSavedCard && activeMeta ? (
          <div
            className={cn(
              "rounded-xl border px-4 py-4 text-center border-emerald-200 bg-emerald-50 text-emerald-950"
            )}
            role="status"
          >
            <p className="text-4xl" aria-hidden>
              {activeMeta.emoji}
            </p>
            <p className="mt-2 text-base font-bold">{activeMeta.label}</p>
            <p className="mt-2 text-sm opacity-90">Thank you — your feedback has been recorded.</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-center text-xs font-medium text-zinc-500">
            Tap the option that best matches your experience
          </p>
          <FeedbackRatingPicker
            selected={selected}
            busy={busy}
            onSelect={(rating) => {
              setSelected(rating);
              setError(null);
            }}
          />
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Optional comment
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            disabled={busy}
            placeholder="Anything we should know? (optional)"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
        </label>

        {feedbackAnonymous && !isPortal ? (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            Your written answers to optional questions are collected anonymously and are not shown with
            your name to organizers.
          </p>
        ) : null}

        {optionalCount > 0 ? (
          <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Optional questions ({optionalCount})
            </p>
            <FeedbackOptionalQuestionFields
              questions={optionalQuestions}
              answers={answers}
              onAnswersChange={setAnswers}
              disabled={busy}
              showNumbers
            />
          </div>
        ) : null}

        {showMarketingOptIn && marketingConsentLabel ? (
          <FeedbackMarketingOptInFields
            checked={marketingOptIn}
            onCheckedChange={(checked) => {
              setMarketingOptIn(checked);
              setError(null);
            }}
            label={marketingConsentLabel}
            privacyPolicyUrl={marketingPrivacyPolicyUrl}
            disabled={busy}
            showEmailField={isPortal}
            marketingEmail={marketingEmail}
            onMarketingEmailChange={setMarketingEmail}
            idPrefix={isPortal ? "feedback-portal-marketing" : "feedback-guest-marketing"}
          />
        ) : null}
      </div>

      <footer className="sticky bottom-0 z-10 -mx-6 shrink-0 border-t border-zinc-200 bg-white/95 px-6 pb-1 pt-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
        {error ? (
          <p className="mb-2 text-center text-sm font-medium text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            className="w-full max-w-sm"
            disabled={busy || !selected}
            onClick={() => void handleSubmit()}
          >
            {busy ? "Saving…" : saved ? "Update feedback" : "Submit feedback"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
