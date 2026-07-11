import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";
import { EventGuestsSidebar } from "@/components/guests/EventGuestsSidebar";
import { GuestManagementPanel } from "@/components/guests/GuestManagementPanel";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { prisma } from "@/lib/prisma";
import { listOrgContactGroupsForOrg, type OrgContactGroupListRow } from "@/lib/db/crm";
import { getEventDeclineReasonCounts } from "@/lib/db/eventDeclineAnalytics";
import { countGuestsUngrouped, listEventGuestGroupsForEvent } from "@/lib/db/eventGuestGroups";
import { listEventWaitlistForDashboard } from "@/lib/db/eventWaitlist";
import { listGuestsForEventManagement } from "@/lib/db/guests";
import { getOrgContactCategoryLabels, listOrgContactsForGuestInvitePicker, type OrgContactGuestInvitePickRow } from "@/lib/db/orgContact";
import { listAssignableReps } from "@/lib/db/users";
import { resolveActiveTeamMemberForPii, resolveGuestExportCapability } from "@/lib/permissions";
import { EventStatus, GuestStatus, Role } from "@prisma/client";

type EventGuestsPageProps = {
  params: { id: string };
  searchParams?: { guest?: string };
};

export default async function EventGuestsPage({ params, searchParams }: EventGuestsPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const showWaitlistDashboard =
    session.user.role === Role.ADMIN || session.user.role === Role.MARKETING;

  const [guests, salesReps, zoomMeta, eventGuestGroups, ungroupedGuestCount, declineDistribution, teamMember] =
    await Promise.all([
      listGuestsForEventManagement(
        params.id,
        session.user.orgId,
        session.user.id,
        session.user.role,
        session.sessionId
      ),
      listAssignableReps(session.user.orgId),
      prisma.event.findFirst({
        where: { id: params.id, orgId: session.user.orgId },
        select: {
          name: true,
          brandLogoUrl: true,
          zoomMeetingId: true,
          capacity: true,
          virtualCapacity: true,
          type: true,
          status: true,
          emailMandatoryForRegistration: true,
          endDate: true
        }
      }),
      listEventGuestGroupsForEvent(params.id, session.user.orgId),
      countGuestsUngrouped(params.id, session.user.orgId),
      getEventDeclineReasonCounts(params.id, session.user.orgId),
      resolveActiveTeamMemberForPii(params.id, session.user.id)
    ]);

  const guestExportCapability = zoomMeta
    ? resolveGuestExportCapability(
        { role: session.user.role },
        {
          eventId: params.id,
          eventEndDate: zoomMeta.endDate,
          teamMember
        }
      )
    : "none";

  const [org, contactCategories] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: { name: true, logo: true }
    }),
    getOrgContactCategoryLabels(session.user.orgId)
  ]);

  const waitlistRows = showWaitlistDashboard
    ? await listEventWaitlistForDashboard(params.id, session.user.orgId)
    : [];

  const statusCounts: Partial<Record<GuestStatus, number>> = {};
  for (const g of guests) {
    if (!(Object.values(GuestStatus) as string[]).includes(g.status)) continue;
    const s = g.status as GuestStatus;
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  const showZoomParticipantSync =
    (session.user.role === Role.ADMIN || session.user.role === Role.MARKETING) &&
    Boolean(zoomMeta?.zoomMeetingId);

  const openGuestId = typeof searchParams?.guest === "string" ? searchParams.guest : undefined;

  const showCrmInvite = session.user.role === Role.ADMIN || session.user.role === Role.MARKETING;
  let crmInviteContacts: OrgContactGuestInvitePickRow[] = [];
  let crmGroups: OrgContactGroupListRow[] = [];
  if (showCrmInvite) {
    [crmInviteContacts, crmGroups] = await Promise.all([
      listOrgContactsForGuestInvitePicker(session.user.orgId, 800),
      listOrgContactGroupsForOrg(session.user.orgId)
    ]);
  }

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Guests"
      title="All registrations"
      description="View status in the left column, add guests, or run a file or manual import. Sales roles may only see their assigned guests."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start">
        <Suspense
          fallback={
            <div className="h-40 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 lg:h-auto lg:min-h-[12rem]" />
          }
        >
          <EventGuestsSidebar
            eventId={params.id}
            guestTotal={guests.length}
            capacityInPerson={zoomMeta?.capacity ?? 0}
            capacityVirtual={zoomMeta?.virtualCapacity ?? 0}
            statusCounts={statusCounts}
            eventGuestGroups={eventGuestGroups}
            ungroupedGuestCount={ungroupedGuestCount}
          />
        </Suspense>
        <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <Suspense fallback={<p className="text-sm text-zinc-500">Loading guest list…</p>}>
            <GuestManagementPanel
              eventId={params.id}
              eventName={zoomMeta?.name ?? undefined}
              organizationName={org?.name ?? undefined}
              organizationLogoUrl={zoomMeta?.brandLogoUrl ?? org?.logo ?? undefined}
              guests={guests}
              salesReps={salesReps}
              role={session.user.role}
              currentUserId={session.user.id}
              showZoomParticipantSync={showZoomParticipantSync}
              openGuestId={openGuestId}
              showCrmInvite={showCrmInvite}
              crmInviteContacts={crmInviteContacts}
              crmGroups={crmGroups.map((g) => ({ id: g.id, name: g.name }))}
              eventType={zoomMeta?.type}
              eventGuestGroups={eventGuestGroups.map((g) => ({ id: g.id, name: g.name }))}
              contactCategories={contactCategories}
              emailMandatoryForRegistration={zoomMeta?.emailMandatoryForRegistration ?? true}
              eventStatus={zoomMeta?.status ?? EventStatus.DRAFT}
              waitlistRows={waitlistRows}
              declineDistribution={declineDistribution}
              canPromoteWaitlist={showWaitlistDashboard}
              guestExportCapability={guestExportCapability}
            />
          </Suspense>
        </div>
      </div>
    </WorkspacePageShell>
  );
}
