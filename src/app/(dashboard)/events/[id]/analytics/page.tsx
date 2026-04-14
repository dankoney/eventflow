import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { AttendanceChart } from "@/components/charts/AttendanceChart";
import { GuestStatusChart } from "@/components/charts/GuestStatusChart";
import { RegistrationChart } from "@/components/charts/RegistrationChart";
import { TierChart } from "@/components/charts/TierChart";
import { getEventAnalytics } from "@/lib/db/analytics";
import { getEventForUser } from "@/lib/db/events";

type EventAnalyticsPageProps = {
  params: { id: string };
};

export default async function EventAnalyticsPage({ params }: EventAnalyticsPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) notFound();

  const event = await getEventForUser(
    params.id,
    session.user.orgId,
    session.user.id,
    session.user.role
  );
  if (!event) notFound();

  const analytics = await getEventAnalytics(
    params.id,
    session.user.orgId,
    session.user.id,
    session.user.role
  );
  if (!analytics) notFound();

  const statusForChart = analytics.statusData.map((s) => ({ label: s.label, count: s.count }));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Analytics</h2>
        <p className="mt-1 text-sm text-slate-600">
          {analytics.totalGuests} guest{analytics.totalGuests !== 1 ? "s" : ""} in scope for this event
          {session.user.role === "SALES_REP" ? " (assigned to you)" : ""}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TierChart data={analytics.tierData} title="Guests by tier" />
        <GuestStatusChart data={statusForChart} title="Guests by status" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RegistrationChart data={analytics.registrationByDay} />
        <AttendanceChart
          data={analytics.hourlyData.map((h) => ({ label: h.label, count: h.count }))}
        />
      </div>
    </section>
  );
}
