import { notFound } from "next/navigation";

import { EventFeedbackForm } from "@/app/feedback/[guestId]/[token]/EventFeedbackForm";
import { FeedbackPageHeader } from "@/components/feedback/FeedbackPageHeader";
import {
  parseEventFeedbackAnswersJson,
  parseEventFeedbackQuestionsJson
} from "@/lib/event-feedback/feedbackQuestions";
import { getEventFeedbackPhoneDialOptions } from "@/lib/event-feedback/eventPhoneDialCodes";
import { getFeedbackMarketingOptInForEvent } from "@/lib/event-feedback/feedbackMarketingOptIn";
import { resolveFeedbackPageBranding } from "@/lib/event-feedback/feedbackPageBranding";
import { getEventFeedbackWindow, guestFeedbackClosedMessage } from "@/lib/event-feedback/window";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

type PageProps = { params: { code: string } };

export const dynamic = "force-dynamic";

const orgBrandingSelect = {
  name: true,
  defaultEventBrandLogoUrl: true,
  logoUrl: true,
  logo: true,
  defaultEventBrandPrimaryColor: true
} as const;

export default async function FeedbackPortalPage({ params }: PageProps) {
  const shortCode = params.code?.trim();
  if (!shortCode) notFound();

  const event = await prisma.event.findFirst({
    where: { feedbackShortCode: shortCode },
    select: {
      id: true,
      name: true,
      date: true,
      status: true,
      endDate: true,
      type: true,
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
  const windowOpen = window.phase === "open";
  const branding = resolveFeedbackPageBranding(event.org, event);
  const feedbackQuestions = parseEventFeedbackQuestionsJson(event.feedbackQuestions);
  const phoneDialOptions = await getEventFeedbackPhoneDialOptions(event.id);
  const marketingOptIn = await getFeedbackMarketingOptInForEvent(event.id);

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
          {!windowOpen ? (
            <div className="text-center">
              <h1 className="text-lg font-bold text-zinc-900">{event.name}</h1>
              <p className="mt-3 text-sm text-zinc-600">{guestFeedbackClosedMessage(window)}</p>
              {window.phase === "not_yet_open" ? (
                <p className="mt-2 text-xs text-zinc-500">Opens {formatDate(window.opensAt)}</p>
              ) : null}
            </div>
          ) : (
            <EventFeedbackForm
              mode="portal"
              shortCode={shortCode}
              eventId={event.id}
              eventName={event.name}
              eventType={event.type}
              phoneDialOptions={phoneDialOptions}
              accent={branding.accent}
              initialRating={null}
              feedbackClosesAt={window.closesAt}
              feedbackQuestions={feedbackQuestions}
              feedbackAnonymous={event.feedbackAnonymous}
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
