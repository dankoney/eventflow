import { notFound } from "next/navigation";
import { EventScheduleMode } from "@prisma/client";

import { auth } from "@/auth";
import { EventCheckInPanel } from "@/components/checkin/EventCheckInPanel";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { listCheckInsForEventPaginated } from "@/lib/db/checkins";
import { getEventForUser } from "@/lib/db/events";
import { listGuestsForCheckInCache } from "@/lib/db/guests";
import { resolveCheckInDayIndexForEvent } from "@/lib/event-schedule/multiDayConfig";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { canManageCheckInRoster, isStaffRole } from "@/lib/permissions";
import { coerceDate } from "@/lib/utils";

type EventCheckInPageProps = {
  params: { id: string };
};

export default async function EventCheckInPage({ params }: EventCheckInPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) notFound();

  await syncEventStatusForEvent(params.id);
  const event = await getEventForUser(
    params.id,
    session.user.orgId,
    session.user.id,
    session.user.role,
    session.sessionId
  );
  if (!event) notFound();

  const checkInWindow = resolveCheckInDayIndexForEvent(event.scheduleMode, event.multiDayConfig);

  const [initialCheckInsRaw, guestCache] = await Promise.all([
    listCheckInsForEventPaginated(event.id, session.user.orgId, session.user.id, session.user.role, {
      page: 1,
      pageSize: 20,
      sessionId: session.sessionId
    }),
    listGuestsForCheckInCache(
      event.id,
      session.user.orgId,
      session.user.id,
      session.user.role,
      session.sessionId
    )
  ]);

  const initialCheckIns = {
    ...initialCheckInsRaw,
    rows: initialCheckInsRaw.rows.map((row) => ({
      ...row,
      checkedInAt: coerceDate(row.checkedInAt).toISOString()
    }))
  };

  const initialGuestCache = guestCache.map((g) => ({
    id: g.id,
    name: g.name,
    email: g.email,
    phone: g.phone,
    company: g.company,
    jobTitle: g.jobTitle,
    repId: g.repId,
    qrCode: g.qrCode,
    status: g.status,
    checkedInAt: g.checkedInAt ? g.checkedInAt.toISOString() : null
  }));

  const isStaff = isStaffRole(session.user.role);

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Check-in"
      title="Onsite desk"
      description={
        isStaff
          ? "Scan QR codes or search by name to check in registered guests. Register walk-ins when someone arrives without a prior booking."
          : "Scan the attendee QR from the confirmation email, or search by name, email, company, or job title. Install as an app; search and check-in work from a cached guest list when offline."
      }
      headerActions={
        isStaff ? undefined : (
          <a
            href={`/events/${event.id}/door`}
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Live door dashboard
          </a>
        )
      }
    >
      {!checkInWindow.ok ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {checkInWindow.error}
        </p>
      ) : null}
      {checkInWindow.ok && event.scheduleMode === EventScheduleMode.MULTI_DAY ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600">
          Multi-day event: check-ins are recorded for session day {checkInWindow.dayIndex}.
        </p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <EventCheckInPanel
          eventId={event.id}
          canManageCheckInRoster={canManageCheckInRoster(session.user.role)}
          canRegisterStaffWalkIn={isStaff}
          emailMandatoryForRegistration={event.emailMandatoryForRegistration ?? true}
          initialCheckIns={initialCheckIns}
          initialGuestCache={initialGuestCache}
        />
      </div>
    </WorkspacePageShell>
  );
}
