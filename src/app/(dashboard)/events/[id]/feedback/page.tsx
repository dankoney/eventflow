import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { EventFeedbackPanel } from "@/components/events/EventFeedbackPanel";
import { getEventFeedbackAnalytics } from "@/lib/db/eventFeedback";
import { listEventGuestGroupsForEvent } from "@/lib/db/eventGuestGroups";
import { getOrgContactCategoryLabels } from "@/lib/db/orgContact";
import { getEventForUser } from "@/lib/db/events";
import { isEventFeedbackFormLocked } from "@/lib/event-feedback/feedbackFormLock";
import { ensureEventFeedbackShortCode } from "@/lib/event-feedback/feedbackLinks";
import { eventAllowsFeedbackRequestBlast } from "@/lib/event-feedback/window";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { prisma } from "@/lib/prisma";
import {
  canSendFeedbackBlast,
  canViewFeedbackAnalytics,
  isStaffRole
} from "@/lib/permissions";
import { getEventFeedbackPortalAbsoluteUrl, resolveEmailBrandLogoUrl } from "@/lib/url";
import { formatDate } from "@/lib/utils";

type PageProps = { params: { id: string } };

export default async function EventFeedbackPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.orgId) notFound();

  if (isStaffRole(session.user.role) || !canViewFeedbackAnalytics(session.user.role)) {
    notFound();
  }

  if (
    !(await getEventForUser(
      params.id,
      session.user.orgId,
      session.user.id,
      session.user.role,
      session.sessionId
    ))
  ) {
    notFound();
  }

  await syncEventStatusForEvent(params.id);

  const [eventMeta, feedbackAnalytics, eventGuestGroups, contactCategories] = await Promise.all([
    prisma.event.findFirst({
      where: { id: params.id, orgId: session.user.orgId },
      select: {
        name: true,
        status: true,
        date: true,
        endDate: true,
        brandPrimaryColor: true,
        brandLogoUrl: true,
        org: { select: { name: true, logo: true, defaultEventBrandLogoUrl: true } }
      }
    }),
    getEventFeedbackAnalytics(params.id, session.user.orgId, session.user.id, session.user.role),
    canSendFeedbackBlast(session.user.role)
      ? listEventGuestGroupsForEvent(params.id, session.user.orgId)
      : Promise.resolve([]),
    canSendFeedbackBlast(session.user.role)
      ? getOrgContactCategoryLabels(session.user.orgId)
      : Promise.resolve([])
  ]);

  if (!eventMeta || !feedbackAnalytics) notFound();

  const feedbackBlastOpen =
    canSendFeedbackBlast(session.user.role) && eventAllowsFeedbackRequestBlast(eventMeta);
  const feedbackQuestionsLocked = isEventFeedbackFormLocked({
    eventStatus: eventMeta.status,
    feedbackResponseCount: feedbackAnalytics.responseCount
  });

  const logoUrl = resolveEmailBrandLogoUrl({
    eventBrandLogoUrl: eventMeta.brandLogoUrl,
    orgLogoUrl: eventMeta.org.logo,
    orgDefaultBrandLogoUrl: eventMeta.org.defaultEventBrandLogoUrl
  });

  const feedbackShortCode = await ensureEventFeedbackShortCode(params.id);
  const feedbackPortalUrl = feedbackShortCode
    ? getEventFeedbackPortalAbsoluteUrl(feedbackShortCode)
    : null;

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Feedback"
      title="Guest feedback & follow-up questions"
      description={
        canSendFeedbackBlast(session.user.role)
          ? "Set up the guest form, send feedback requests, and review results with full exports."
          : "Review event feedback and export results. Free-text responses are privacy-scrubbed."
      }
    >
      <EventFeedbackPanel
        eventId={params.id}
        eventName={eventMeta.name}
        orgName={eventMeta.org.name}
        eventDateLabel={formatDate(eventMeta.date)}
        accentColor={eventMeta.brandPrimaryColor?.trim() || undefined}
        logoUrl={logoUrl}
        brandLogoUrl={eventMeta.brandLogoUrl}
        orgLogoUrl={eventMeta.org.logo}
        orgDefaultBrandLogoUrl={eventMeta.org.defaultEventBrandLogoUrl}
        feedbackQuestionsLocked={feedbackQuestionsLocked}
        feedbackBlastOpen={feedbackBlastOpen}
        analytics={feedbackAnalytics}
        feedbackPortalUrl={feedbackPortalUrl}
        feedbackShortCode={feedbackShortCode}
        eventGuestGroups={eventGuestGroups.map((g) => ({ id: g.id, name: g.name }))}
        contactCategories={contactCategories}
      />
    </WorkspacePageShell>
  );
}
