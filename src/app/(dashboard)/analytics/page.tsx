import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { GuestStatusChart } from "@/components/charts/GuestStatusChart";
import { TierChart } from "@/components/charts/TierChart";
import { TopEventsChart } from "@/components/charts/TopEventsChart";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getOrgAnalytics } from "@/lib/db/analytics";
import { isSalesRepRole, isStaffRole } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export default async function AnalyticsHubPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (isStaffRole(session.user.role)) redirect("/dashboard");

  const data = await getOrgAnalytics(session.user.orgId, session.user.id, session.user.role);
  const statusForChart = data.statusData.map((s) => ({ label: s.label, count: s.count }));
  const topEventsChart = data.topEvents.map((e) => ({
    name: e.name,
    guestCount: e.guestCount
  }));

  return (
    <WorkspacePageShell
      className="max-w-7xl"
      kicker="Analytics"
      title="Organization insights"
      description={
        <>
          {data.totalEvents} event{data.totalEvents !== 1 ? "s" : ""} · {data.totalGuests} guest
          {data.totalGuests !== 1 ? "s" : ""}
          {isStaffRole(session.user.role)
            ? ""
            : isSalesRepRole(session.user.role)
              ? " in your scope (assigned guests)."
              : " across your organization."}
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <TierChart title="Guests by tier" data={data.tierData} />
        <GuestStatusChart title="Guests by status" data={statusForChart} />
      </div>

      <TopEventsChart data={topEventsChart} />

      {data.topEvents.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Event deep-dives</h2>
          <ul className="mt-2 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white text-sm shadow-sm">
            {data.topEvents.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}/analytics`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 transition hover:bg-zinc-50"
                >
                  <span className="font-medium text-zinc-900">{e.name}</span>
                  <span className="text-zinc-500">
                    {formatDate(e.date)} · {e.guestCount} guests
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </WorkspacePageShell>
  );
}
