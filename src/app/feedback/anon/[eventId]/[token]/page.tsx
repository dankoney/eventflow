import { notFound } from "next/navigation";

import { FeedbackPageHeader } from "@/components/feedback/FeedbackPageHeader";
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

import { EventFeedbackForm } from "../../../[guestId]/[token]/EventFeedbackForm";

type PageProps = { params: { eventId: string; token: string } };

export const dynamic = "force-dynamic";

const orgBrandingSelect = {
  name: true,
  defaultEventBrandLogoUrl: true,
  logoUrl: true,
  logo: true,
  defaultEventBrandPrimaryColor: true
} as const;

export default async function AnonymousEventFeedbackPage({ params }: PageProps) {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: {
      id: true,
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
  });
  if (!event) notFound();

  await syncEventStatusForEvent(event.id);

  const refreshed = await prisma.event.findUnique({
    where: { id: event.id },
    select: { status: true, date: true, endDate: true }
  });
  if (!refreshed) notFound();

  const window = getEventFeedbackWindow(refreshed);
  const open = window.phase === "open";
  const branding = resolveFeedbackPageBranding(event.org, event);

  const existingResponse = await prisma.eventFeedbackResponse.findFirst({
    where: { eventId: event.id, portalAnonymousToken: params.token },
    select: { rating: true, comment: true, answers: true }
  });

  const feedbackQuestions = parseEventFeedbackQuestionsJson(event.feedbackQuestions);
  const initialAnswers = parseEventFeedbackAnswersJson(existingResponse?.answers);

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
              mode="anonymous"
              eventId={event.id}
              portalToken={params.token}
              eventName={event.name}
              accent={branding.accent}
              initialRating={existingResponse?.rating ?? null}
              initialComment={existingResponse?.comment ?? ""}
              feedbackClosesAt={window.closesAt}
              initialAnswers={initialAnswers}
              feedbackQuestions={feedbackQuestions}
              feedbackAnonymous
            />
          )}
        </div>
      </div>
    </main>
  );
}
