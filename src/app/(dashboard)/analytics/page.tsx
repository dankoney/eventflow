import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { GuestStatusChart } from "@/components/charts/GuestStatusChart";
import { TierChart } from "@/components/charts/TierChart";
import { TopEventsChart } from "@/components/charts/TopEventsChart";
import { getOrgAnalytics } from "@/lib/db/analytics";
import { formatDate } from "@/lib/utils";

export default async function AnalyticsHubPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const data = await getOrgAnalytics(session.user.orgId, session.user.id, session.user.role);
  const statusForChart = data.statusData.map((s) => ({ label: s.label, count: s.count }));
  const topEventsChart = data.topEvents.map((e) => ({
    name: e.name,
    guestCount: e.guestCount
  }));

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.totalEvents} event{data.totalEvents !== 1 ? "s" : ""} · {data.totalGuests} guest
          {data.totalGuests !== 1 ? "s" : ""}
          {session.user.role === "SALES_REP" ? " in your scope (assigned guests)." : " across your organization."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TierChart title="Guests by tier" data={data.tierData} />
        <GuestStatusChart title="Guests by status" data={statusForChart} />
      </div>

      <TopEventsChart data={topEventsChart} />

      {data.topEvents.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Event deep-dives</h2>
          <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
            {data.topEvents.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}/analytics`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 transition hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{e.name}</span>
                  <span className="text-slate-500">
                    {formatDate(e.date)} · {e.guestCount} guests
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
