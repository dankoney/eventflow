import { BarChart3, Calendar, Percent, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { StatCard } from "@/components/dashboard/StatCard";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getDashboardStats } from "@/lib/db/dashboard";
import { isEventLinkedRole, isSalesRepRole } from "@/lib/permissions";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/login");
  }

  const stats = await getDashboardStats(session.user.orgId, session.user.id, session.user.role);

  return (
    <WorkspacePageShell
      className="max-w-7xl"
      kicker="Workspace"
      title="Dashboard"
      description={
        <>
          Overview for your organization
          {isSalesRepRole(session.user.role) ? " — scoped to guests assigned to you." : ""}
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Events"
          value={stats.totalEvents}
          description={isEventLinkedRole(session.user.role) ? "Events linked to you" : "All events in org"}
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
    </WorkspacePageShell>
  );
}
