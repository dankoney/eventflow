import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { EventTeamPanel } from "@/components/events/EventTeamPanel";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { listEventTeamMembers } from "@/lib/actions/eventTeam.actions";
import { getEventForUser } from "@/lib/db/events";
import { listAssignableReps } from "@/lib/db/users";
import { canManageEventTeam, canToggleRepPiiOverride } from "@/lib/permissions";

type PageProps = { params: { id: string } };

export default async function EventTeamSettingsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.orgId) notFound();

  const event = await getEventForUser(
    params.id,
    session.user.orgId,
    session.user.id,
    session.user.role,
    session.sessionId
  );
  if (!event) notFound();

  const [teamMembers, teamCandidates] = await Promise.all([
    listEventTeamMembers(event.id),
    listAssignableReps(session.user.orgId)
  ]);

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Settings"
      title="Event team"
      description="Manage who is on the team for this event and control temporary sales-rep access to the full guest roster."
    >
      <EventTeamPanel
        eventId={event.id}
        eventEndDateIso={event.endDate.toISOString()}
        members={teamMembers.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          dataAccessOverride: m.dataAccessOverride,
          toggleEnabledAt: m.toggleEnabledAt?.toISOString() ?? null,
          toggleExpiresAt: m.toggleExpiresAt?.toISOString() ?? null,
          user: m.user
        }))}
        candidates={teamCandidates}
        canManageTeam={canManageEventTeam(session.user.role)}
        canTogglePii={canToggleRepPiiOverride(session.user.role)}
      />
    </WorkspacePageShell>
  );
}
