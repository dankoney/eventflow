import { notFound, redirect } from "next/navigation";
import { EventStatus } from "@prisma/client";

import { auth } from "@/auth";
import { PublicEventExperienceEditor } from "@/components/events/PublicEventExperienceEditor";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getEventForUser } from "@/lib/db/events";
import { getParsedMultiDayOrNull } from "@/lib/event-schedule/multiDayConfig";
import { isPublicEventExperienceEnabled } from "@/lib/features/publicEventExperience";
import { parsePublicEventExperience } from "@/lib/public-event/experience";

type PageProps = { params: { id: string } };

export default async function EventPublicExperiencePage({ params }: PageProps) {
  if (!isPublicEventExperienceEnabled()) {
    redirect(`/events/${params.id}/edit`);
  }
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "MARKETING") {
    redirect(`/events/${params.id}`);
  }

  const event = await getEventForUser(params.id, session.user.orgId, session.user.id, session.user.role);
  if (!event) notFound();

  const multiDay = getParsedMultiDayOrNull(event.scheduleMode, event.multiDayConfig);
  const locked = event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED;

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Public page"
      title="Public experience"
      description="Configure what attendees see on the public page: agenda, speakers, and downloadable resources."
    >
      <PublicEventExperienceEditor
        eventId={event.id}
        readOnly={locked}
        initial={parsePublicEventExperience(event.publicExperience)}
        programDays={
          multiDay?.days.map((d) => ({ dayIndex: d.dayIndex, startsAt: d.startsAt.toISOString() })) ?? [
            { dayIndex: 1, startsAt: event.date.toISOString() }
          ]
        }
      />
    </WorkspacePageShell>
  );
}

