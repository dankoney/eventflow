import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { AttendanceChart } from "@/components/charts/AttendanceChart";
import { GuestStatusChart } from "@/components/charts/GuestStatusChart";
import { RegistrationChart } from "@/components/charts/RegistrationChart";
import { TierChart } from "@/components/charts/TierChart";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getEventAnalytics } from "@/lib/db/analytics";
import { getEventForUser } from "@/lib/db/events";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { prisma } from "@/lib/prisma";
import { isSalesRepRole } from "@/lib/permissions";

type EventAnalyticsPageProps = {
  params: { id: string };
};

export default async function EventAnalyticsPage({ params }: EventAnalyticsPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) notFound();

  if (!(await getEventForUser(params.id, session.user.orgId, session.user.id, session.user.role))) {
    notFound();
  }

  await syncEventStatusForEvent(params.id);

  const [analytics, eventMeta] = await Promise.all([
    getEventAnalytics(params.id, session.user.orgId, session.user.id, session.user.role),
    prisma.event.findFirst({
      where: { id: params.id, orgId: session.user.orgId },
      select: { name: true, status: true, endDate: true }
    })
  ]);

  if (!analytics || !eventMeta) notFound();

  const statusForChart = analytics.statusData.map((s) => ({ label: s.label, count: s.count }));

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Analytics"
      title="Attendance & registration"
      description={`${analytics.totalGuests} guest${analytics.totalGuests !== 1 ? "s" : ""} in scope for this event${
        isSalesRepRole(session.user.role) ? " (assigned to you)" : ""
      }. Charts below respect your role’s data scope.`}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <TierChart data={analytics.tierData} title="Guests by tier" />
        <GuestStatusChart data={statusForChart} title="Guests by status" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RegistrationChart data={analytics.registrationByDay} />
        <AttendanceChart data={analytics.hourlyData.map((h) => ({ label: h.label, count: h.count }))} />
      </div>
    </WorkspacePageShell>
  );
}
