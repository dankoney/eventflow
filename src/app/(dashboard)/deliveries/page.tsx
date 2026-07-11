import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OrgDeliveryReportPanel } from "@/components/delivery/OrgDeliveryReportPanel";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getOrgDeliveryReport } from "@/lib/delivery/orgDeliveryReport";
import { canViewDeliveryReports, isSalesRepRole } from "@/lib/permissions";

export default async function OrgDeliveriesPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (!canViewDeliveryReports(session.user.role)) redirect("/dashboard");

  const report = await getOrgDeliveryReport(
    session.user.orgId,
    session.user.id,
    session.user.role
  );

  return (
    <WorkspacePageShell
      className="max-w-7xl"
      kicker="Deliveries"
      title="Email & SMS delivery reports"
      description={
        isSalesRepRole(session.user.role)
          ? "Delivery outcomes and data quality flags for guests assigned to you across events."
          : "Organization-wide view of send outcomes, failed deliveries, and guest records that need contact cleanup."
      }
    >
      <OrgDeliveryReportPanel report={report} />
    </WorkspacePageShell>
  );
}
