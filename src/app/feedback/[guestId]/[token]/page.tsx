import { notFound } from "next/navigation";

import { EventFeedbackForm } from "@/app/feedback/[guestId]/[token]/EventFeedbackForm";
import { FeedbackPageHeader } from "@/components/feedback/FeedbackPageHeader";
import { parseFeedbackRatingParam } from "@/lib/event-feedback/recordFeedback";
import { getFeedbackMarketingOptInForGuest } from "@/lib/event-feedback/feedbackMarketingOptIn";
import {
  parseEventFeedbackAnswersJson,
  parseEventFeedbackQuestionsJson
} from "@/lib/event-feedback/feedbackQuestions";
import { resolveFeedbackPageBranding } from "@/lib/event-feedback/feedbackPageBranding";
import {
  getEventFeedbackWindow,
  guestFeedbackClosedMessage
} from "@/lib/event-feedback/window";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

type PageProps = {
  params: { guestId: string; token: string };
  searchParams?: { rating?: string };
};

export const dynamic = "force-dynamic";

const orgBrandingSelect = {
  name: true,
  defaultEventBrandLogoUrl: true,
  logoUrl: true,
  logo: true,
  defaultEventBrandPrimaryColor: true
} as const;

export default async function EventFeedbackPage({ params, searchParams }: PageProps) {
  const guest = await prisma.guest.findFirst({
    where: {
      id: params.guestId,
      feedbackToken: params.token
    },
    select: {
      id: true,
      name: true,
      eventId: true,
      event: {
        select: {
          name: true,
          date: true,
          status: true,
          endDate: true,
          brandLogoUrl: true,
          brandPrimaryColor: true,
          feedbackQuestions: true,
          feedbackAnonymous: true,
          org: { select: orgBrandingSelect }
        }
      }
    }
  });

  if (!guest) notFound();
  await syncEventStatusForEvent(guest.eventId);

  const event = guest.event;
  const window = getEventFeedbackWindow(event);
  const open = window.phase === "open";

  const ratingFromEmail = parseFeedbackRatingParam(searchParams?.rating);

  const existingResponse = await prisma.eventFeedbackResponse.findUnique({
    where: { eventId_guestId: { eventId: guest.eventId, guestId: guest.id } },
    select: { rating: true, comment: true, answers: true, submittedAnonymously: true }
  });

  const marketingOptIn = await getFeedbackMarketingOptInForGuest(guest.id);
  const branding = resolveFeedbackPageBranding(event.org, event);

  const initialRating = existingResponse?.rating ?? ratingFromEmail ?? null;
  const initialComment = existingResponse?.comment ?? "";
  const ratingPrefilledFromEmail = Boolean(open && ratingFromEmail && !existingResponse);
  const initialAnswers = parseEventFeedbackAnswersJson(existingResponse?.answers);
  const feedbackQuestions = parseEventFeedbackQuestionsJson(event.feedbackQuestions);

  return (
    <main className="min-h-dvh bg-zinc-100 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-lg">
        <FeedbackPageHeader
          orgName={branding.orgName}
          logoUrl={branding.logoUrl}
          accent={branding.accent}
          eventDateLabel={formatDate(event.date)}
        />

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          {!open ? (
            <div className="text-center">
              <h1 className="text-lg font-bold text-zinc-900">
                {window.phase === "closed" ? "Feedback period ended" : "Feedback not available"}
              </h1>
              <p className="mt-2 text-sm text-zinc-600">{guestFeedbackClosedMessage(window)}</p>
              {window.phase === "not_yet_open" ? (
                <p className="mt-2 text-xs text-zinc-500">Opens {formatDate(window.opensAt)}</p>
              ) : null}
            </div>
          ) : (
            <EventFeedbackForm
              guestId={guest.id}
              token={params.token}
              guestName={guest.name}
              eventName={event.name}
              accent={branding.accent}
              initialRating={initialRating}
              initialComment={initialComment}
              ratingPrefilledFromEmail={ratingPrefilledFromEmail}
              feedbackClosesAt={window.closesAt}
              initialAnswers={initialAnswers}
              feedbackQuestions={feedbackQuestions}
              feedbackAnonymous={event.feedbackAnonymous}
              hasExistingResponse={Boolean(existingResponse)}
              existingSubmittedAnonymously={existingResponse?.submittedAnonymously ?? false}
              showMarketingOptIn={marketingOptIn?.show ?? false}
              marketingConsentLabel={marketingOptIn?.label}
              marketingPrivacyPolicyUrl={marketingOptIn?.privacyPolicyUrl}
            />
          )}
        </div>
      </div>
    </main>
  );
}
