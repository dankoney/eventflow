import { BarChart3, Calendar, Percent, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { StatCard } from "@/components/dashboard/StatCard";
import { getDashboardStats } from "@/lib/db/dashboard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/login");
  }

  const stats = await getDashboardStats(session.user.orgId, session.user.id, session.user.role);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">
        Overview for your organization
        {session.user.role === "SALES_REP" ? " — scoped to guests assigned to you." : ""}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Events"
          value={stats.totalEvents}
          description={session.user.role === "SALES_REP" ? "Events where you have guests" : "All events in org"}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          title="Total Guests"
          value={stats.totalGuests}
          description="Guests in scope"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Tier A Count"
          value={stats.tierACount}
          description="Guests with tier A"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          title="Avg Show Rate"
          value={`${stats.avgShowRate}%`}
          description="Checked in or joined ÷ total guests"
          icon={<Percent className="h-5 w-5" />}
        />
      </div>
    </section>
  );
}
